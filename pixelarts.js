// Caminhos persistidos em cartas.imagem; artes cadastradas têm prioridade.
const Sprites = require('./public/sprites');
const imagens = Object.fromEntries(Object.keys(Sprites.perfis).map(codigo =>
  [codigo, `/assets/cartas/${codigo}.svg`]));

async function atualizarPixelArts(pool) {
  const conexao = await pool.getConnection();
  let atualizadas = 0;
  try {
    await conexao.beginTransaction();
    for (const [codigo, imagem] of Object.entries(imagens)) {
      const [resultado] = await conexao.execute(
        `UPDATE cartas SET imagem = ? WHERE codigo = ?
         AND (imagem IS NULL OR TRIM(imagem) = '')`, [imagem, codigo]);
      atualizadas += resultado.affectedRows;
    }
    await conexao.commit();
    return atualizadas;
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}

module.exports = { imagens, atualizarPixelArts };
