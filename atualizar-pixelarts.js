// Atualiza somente imagens vazias. Não executa seed nem altera regras.
// node --env-file-if-exists=.env atualizar-pixelarts.js
const { criarPool } = require('./banco');
const { atualizarPixelArts } = require('./pixelarts');

(async () => {
  const pool = criarPool();
  try {
    const quantidade = await atualizarPixelArts(pool);
    console.log(`${quantidade} imagens de cartas atualizadas no banco.`);
  } finally {
    await pool.end();
  }
})().catch(erro => {
  console.error('Não foi possível atualizar as pixel arts:', erro.code || erro.message);
  process.exitCode = 1;
});
