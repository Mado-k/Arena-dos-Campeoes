// As sessões ficam no mesmo MySQL/Aiven das cartas, fora das rotas públicas.
module.exports = function criarArmazenamento(pool) {
  let pronto=null;
  function preparar(){
    if(!pronto)pronto=Promise.resolve().then(()=>pool.query(`CREATE TABLE IF NOT EXISTS arena_sessoes (
    codigo VARCHAR(5) PRIMARY KEY,
    estado LONGTEXT NOT NULL,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`)).catch(err=>{pronto=null;throw err;});
    return pronto;
  }
  const filas = new Map();
  function enfileirar(codigo, acao) {
    const anterior=filas.get(codigo)||Promise.resolve();
    const atual=anterior.catch(()=>{}).then(preparar).then(acao);
    filas.set(codigo,atual);
    atual.finally(()=>{if(filas.get(codigo)===atual)filas.delete(codigo);}).catch(()=>{});
    return atual;
  }
  return {
    async carregar() {
      await preparar();
      const [rows]=await pool.query('SELECT codigo, estado FROM arena_sessoes');
      const sessoes=[];
      for(const r of rows){try{sessoes.push(JSON.parse(r.estado));}catch{console.error('Sessão salva inválida ignorada:',r.codigo);}}
      return sessoes;
    },
    salvar(sala) {
      const json=JSON.stringify(sala);
      return enfileirar(sala.codigo,()=>pool.query('INSERT INTO arena_sessoes (codigo, estado) VALUES (?, ?) ON DUPLICATE KEY UPDATE estado = VALUES(estado)',[sala.codigo,json]));
    },
    excluir(codigo) {return enfileirar(codigo,()=>pool.query('DELETE FROM arena_sessoes WHERE codigo = ?',[codigo]));}
  };
};
