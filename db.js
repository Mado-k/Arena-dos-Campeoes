// Conexão com o banco MySQL, usada pelo servidor e pelos scripts (seed, exportar, atualizar-textos).
// Funciona no MariaDB local (Codespaces) e em bancos na nuvem como o Aiven.

const fs = require('fs');

function configSSL(host) {
  let ca = process.env.DB_CA_CERT ? process.env.DB_CA_CERT.replace(/\\n/g, '\n') : null;
  if (!ca && process.env.DB_CA_FILE && fs.existsSync(process.env.DB_CA_FILE)) {
    ca = fs.readFileSync(process.env.DB_CA_FILE, 'utf8');
  }
  if (ca) return { ca, rejectUnauthorized: true };            // conexão segura e verificada

  const nuvem = /aivencloud\.com$/i.test(host);
  if (process.env.DB_SSL === 'true' || (nuvem && process.env.DB_SSL !== 'false')) {
    return { rejectUnauthorized: false };                      // criptografada, sem verificar o certificado
  }
  return undefined;                                            // banco local, sem SSL
}

function configBanco() {
  const host = process.env.DB_HOST || 'localhost';
  return {
    host,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'arena_campeoes',
    ssl: configSSL(host),
    connectTimeout: 15000,
    waitForConnections: true,
    connectionLimit: 5
  };
}

// Cria a tabela se ela ainda não existir (no Aiven o banco já existe; só falta a tabela).
const SQL_TABELA = `
CREATE TABLE IF NOT EXISTS cartas (
    numero     INT AUTO_INCREMENT PRIMARY KEY,
    codigo     VARCHAR(10) UNIQUE,
    nome       VARCHAR(60) NOT NULL,
    elemento   VARCHAR(30),
    classe     VARCHAR(30) NOT NULL,
    universo   VARCHAR(30),
    origem     VARCHAR(30),
    ataque     INT NOT NULL DEFAULT 0,
    defesa     INT NOT NULL DEFAULT 0,
    habilidade TEXT,
    imagem     VARCHAR(255)
) DEFAULT CHARSET = utf8mb4`;

async function garantirTabela(pool) {
  await pool.query(SQL_TABELA);
}

module.exports = { configBanco, garantirTabela };