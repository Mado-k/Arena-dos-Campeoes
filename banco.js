const fs = require('node:fs');
const mysql = require('mysql2/promise');
const Motor = require('./public/motor');

function configuracao(env = process.env) {
  const port = Number(env.DB_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DB_PORT deve ser uma porta entre 1 e 65535.');
  const opcoes = {
    host: env.DB_HOST || 'localhost', port,
    user: env.DB_USER || 'root', password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'arena_campeoes', connectTimeout: 15000,
    waitForConnections: true, connectionLimit: 5
  };
  const caArquivo = env.DB_SSL_CA || env.DB_CA_FILE;
  const nuvem = /(?:^|\.)aivencloud\.com$/i.test(opcoes.host);
  if (env.DB_SSL === 'true' || caArquivo || env.DB_CA_CERT || (nuvem && env.DB_SSL !== 'false')) {
    opcoes.ssl = { rejectUnauthorized: true };
    if (caArquivo) opcoes.ssl.ca = fs.readFileSync(caArquivo, 'utf8');
    else if (env.DB_CA_CERT) opcoes.ssl.ca = env.DB_CA_CERT.replace(/\\n/g, '\n');
  }
  return opcoes;
}

function criarPool() { return mysql.createPool(configuracao()); }
function normalizar(carta) {
  const c = Motor.normalizarCarta(carta);
  c.habilidade = Motor.descricao(c).texto;
  return c;
}

async function colunasAtributos(pool) {
  const [colunas] = await pool.query('SHOW COLUMNS FROM cartas');
  const nomes = new Set(colunas.map(c => c.Field));
  if (nomes.has('ataque') && nomes.has('defesa')) return ['ataque', 'defesa'];
  if (nomes.has('dano') && nomes.has('vida')) return ['dano', 'vida'];
  throw new Error('A tabela cartas não tem as colunas de ataque e defesa esperadas.');
}

module.exports = { configuracao, criarPool, normalizar, colunasAtributos };
