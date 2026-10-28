// Atualiza no banco o texto das habilidades com a versão revisada (ortografia e gramática)
// que está em public/motor.js. Não mexe em mais nada.
// Uso: node --env-file=.env atualizar-textos.js
const mysql = require('mysql2/promise');
const { configBanco, garantirTabela } = require('./db');
const { TEXTOS } = require('./public/motor.js');

(async () => {
  const pool = mysql.createPool(configBanco());
  let n = 0;
  for (const [codigo, texto] of Object.entries(TEXTOS)) {
    const [r] = await pool.query('UPDATE cartas SET habilidade = ? WHERE codigo = ?', [texto, codigo]);
    n += r.affectedRows;
  }
  console.log(`${n} cartas atualizadas.`);
  await pool.end();
})().catch((err) => { console.error('Erro:', err); process.exit(1); });