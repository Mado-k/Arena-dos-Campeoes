// Conexão com o banco MySQL, usada pelo servidor e pelos scripts (seed, exportar, atualizar-textos).
// Funciona no MariaDB local (Codespaces) e em bancos na nuvem como o Aiven.

const { configuracao } = require('./banco');

function configBanco() { return configuracao(); }

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
  await require('./pixelarts').atualizarPixelArts(pool);
}

function preparadorBanco(pool) {
  let pronta;
  return () => pronta ||= garantirTabela(pool).catch(erro => {
    pronta = null;
    throw erro;
  });
}

module.exports = { configBanco, garantirTabela, preparadorBanco };
