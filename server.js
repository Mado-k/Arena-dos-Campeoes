const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const servidor = http.createServer(app);
const io = new Server(servidor, { cors: { origin: '*' } });

// CORS: permite que o site aberto pelo Live Server (porta 5500) fale com este servidor (porta 3000)
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, x-admin-senha');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---------- configuração ----------
const SENHA_ADMIN = process.env.SENHA_ADMIN;
if (!SENHA_ADMIN) {
  console.error('Defina SENHA_ADMIN no arquivo .env antes de iniciar.');
  process.exit(1);
}

// Listas fixas: única fonte da verdade (o admin.html busca daqui via /opcoes)
const OPCOES = {
  universo: ['cyberpunk', 'zumbi', 'mágico', 'normal', 'menção honrosa', 'game', 'void'],
  origem: ['mitologia grega', 'folclore brasileiro', 'folclore japonês', 'mitologia nórdica', 'memes', 'humanidade'],
  classe: ['campeão', 'besta', 'item', 'arma', 'auxiliar', 'feitiço', 'representante'],
  elemento: ['fogo', 'planta', 'água', 'fantasma', 'metálico', 'sombrio', 'divino', 'sonoro']
};

const UPLOADS = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'arena_campeoes'
});

pool.getConnection()
  .then((conn) => {
    console.log('Conectado ao banco MySQL');
    conn.release();
  })
  .catch((err) => console.error('Erro ao conectar ao banco:', err));

// ---------- upload de imagem ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, crypto.randomBytes(12).toString('hex') + ext);
    }
  }),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
  fileFilter: (req, file, cb) => {
    const ok = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.mimetype);
    cb(ok ? null : new Error('Envie uma imagem PNG, JPG, WEBP ou GIF'), ok);
  }
});

// A senha vai no cabeçalho para ser checada ANTES de salvar qualquer arquivo
function exigirSenha(req, res, next) {
  if (req.get('x-admin-senha') !== SENHA_ADMIN) {
    return res.status(401).json({ erro: 'Senha incorreta' });
  }
  next();
}

const inteiroOuNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};

// ---------- rotas ----------
app.get('/opcoes', (req, res) => res.json(OPCOES));

app.get('/cartas', async (req, res) => {
  try {
    const [cartas] = await pool.query('SELECT * FROM cartas ORDER BY numero');
    res.json(cartas);
  } catch (err) {
    console.error('Erro ao buscar cartas:', err);
    res.status(500).json({ erro: 'Não foi possível buscar as cartas' });
  }
});

app.get('/cartas/:numero', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM cartas WHERE numero = ?', [req.params.numero]);
    if (rows.length === 0) return res.status(404).json({ erro: 'Carta não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro no servidor' });
  }
});

app.post('/cartas', exigirSenha, upload.single('imagem'), async (req, res) => {
  const apagarImagem = () => {
    if (req.file) fs.unlink(req.file.path, () => {});
  };

  const { nome, elemento, origem, universo, classe, habilidade } = req.body;

  if (!nome || !classe) {
    apagarImagem();
    return res.status(400).json({ erro: 'Nome e classe são obrigatórios' });
  }

  // valida contra as listas fixas (campos vazios são aceitos, exceto classe)
  for (const campo of ['elemento', 'origem', 'universo', 'classe']) {
    const valor = req.body[campo];
    if (valor && !OPCOES[campo].includes(valor)) {
      apagarImagem();
      return res.status(400).json({ erro: `Valor inválido em ${campo}: ${valor}` });
    }
  }

  const imagem = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const [resultado] = await pool.query(
      `INSERT INTO cartas (nome, elemento, origem, universo, classe, dano, vida, habilidade, imagem)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nome.trim(),
        elemento || null,
        origem || null,
        universo || null,
        classe,
        inteiroOuNull(req.body.dano),
        inteiroOuNull(req.body.vida),
        habilidade || null,
        imagem
      ]
    );
    res.status(201).json({ numero: resultado.insertId, imagem });
  } catch (err) {
    apagarImagem();
    console.error('Erro ao inserir carta:', err);
    res.status(500).json({ erro: 'Não foi possível salvar a carta' });
  }
});

// ---------- arquivos estáticos ----------
// Só a pasta public e as imagens são públicas (server.js e .env ficam fora)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS));

// erros do multer (arquivo grande, tipo inválido...)
app.use((err, req, res, next) => {
  res.status(400).json({ erro: err.message || 'Erro no envio' });
});

// salas de multiplayer e co-op
require('./salas')(io);

servidor.listen(3000, () => {
  console.log('Arena dos Campeões rodando em http://localhost:3000');
});
