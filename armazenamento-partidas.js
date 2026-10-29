// As sessões ficam no mesmo MySQL/Aiven das cartas, fora das rotas públicas.
module.exports = function criarArmazenamento(pool) {
  const pronto = pool.query(`CREATE TABLE IF NOT EXISTS arena_sessoes (
    codigo VARCHAR(5) PRIMARY KEY,
    estado LONGTEXT NOT NULL,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  const filas = new Map();
  function enfileirar(codigo, acao) {
    const anterior=filas.get(codigo)||Promise.resolve();
    const atual=anterior.catch(()=>{}).then(()=>pronto).then(acao);
    filas.set(codigo,atual);
    atual.finally(()=>{if(filas.get(codigo)===atual)filas.delete(codigo);}).catch(()=>{});
    return atual;
  }
  return {
    async carregar() {
      await pronto;
      const [rows]=await pool.query('SELECT codigo, estado FROM arena_sessoes');
      return rows.map(r=>JSON.parse(r.estado));
    },
    salvar(sala) {
      const json=JSON.stringify(sala);
      return enfileirar(sala.codigo,()=>pool.query('INSERT INTO arena_sessoes (codigo, estado) VALUES (?, ?) ON DUPLICATE KEY UPDATE estado = VALUES(estado)',[sala.codigo,json]));
    },
    excluir(codigo) {return enfileirar(codigo,()=>pool.query('DELETE FROM arena_sessoes WHERE codigo = ?',[codigo]));}
  };
};
