const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../public/motor'),Treino=require('../public/treino'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../public/cartas-offline.js'),'utf8'),ctx);
const cartas=JSON.parse(JSON.stringify(ctx.window.CARTAS_OFFLINE));
const todas=e=>e.jogadores.flatMap(j=>['mao','baralho','campo','apoio','descarte','feiticos'].flatMap(z=>j[z].flatMap(c=>[c,...c.equip])));
test('treino tem dez cartas únicas, cinco por lado e três campeões fracos na mão da IA',()=>{
 const t=new Treino(cartas),e=t.partida.estado;
 assert.equal(e.tamanhoBaralho,10);assert.equal(todas(e).length,10);assert.equal(new Set(todas(e).map(c=>c.uid)).size,10);
 for(const j of e.jogadores){assert.equal(j.mao.length,3);assert.equal(j.baralho.length,2);}
 assert(e.jogadores[1].mao.every(M.ehCampeao));assert(e.jogadores[1].mao.every(c=>c.base.defesa<=13));
 assert(e.jogadores[0].mao.some(c=>c.base.codigo==='n032'));
 for(const c of todas(e)){const original=cartas.find(x=>x.codigo===c.base.codigo);assert.equal(c.base.ataque,original.ataque);assert.equal(c.base.defesa,original.defesa);}
 assert.deepEqual(t.visao().jogadores[1].mao,[]);assert.equal(t.visao().jogadores[1].maoTotal,3);
});
test('jogada fora do roteiro não gasta ação, altera cartas ou avança a etapa',()=>{
 const t=new Treino(cartas),antes=t.partida.salvar();assert(t.agir({tipo:'encerrar',revisao:0}).erro);assert.deepEqual(t.partida.salvar(),antes);assert.equal(t.etapa.numero,1);
});
test('aprender a alternar a visão exige abrir a mesa e voltar ao foco, sem gastar ações',()=>{
 const t=new Treino(cartas),antes=t.partida.salvar();
 assert.equal(t.etapa.tipo,'visao-completa');assert.equal(t.confirmarVisualizacao(false),false);
 assert.equal(t.confirmarVisualizacao('completa'),false);assert.deepEqual(t.partida.salvar(),antes);
 assert(t.confirmarVisualizacao(true));assert.equal(t.etapa.tipo,'visao-foco');
 assert.equal(t.confirmarVisualizacao(true),false);assert(t.agir({tipo:'comprar',revisao:0}).erro);
 assert(t.confirmarVisualizacao(false));assert.equal(t.etapa.tipo,'invocar');
 assert.equal(t.confirmarVisualizacao(true),false);assert.deepEqual(t.partida.salvar(),antes);
 assert.equal(t.totalEtapas,20);
});
test('roteiro inteiro vence pelos três campeões sem modificar atributos ou fabricar cartas',()=>{
 for(let repeticao=0;repeticao<15;repeticao++){
  const t=new Treino(cartas),uids=todas(t.partida.estado).map(c=>c.uid).sort((a,b)=>a-b);let passos=0,compras=new Map();
  while(t.partida.estado.vencedor===null&&passos++<50){
   const e=t.partida.estado;
   if(e.turno===1){const n=e.jogadores[1].baralho.length,turno=e.numTurno;assert(t.passoComputador());if(e.jogadores[1].baralho.length<n)compras.set(turno,(compras.get(turno)||0)+1);}
   else if(t.etapa.tipo.startsWith('visao-')){const antes=t.partida.salvar();assert(t.confirmarVisualizacao(t.etapa.tipo==='visao-completa'));assert.deepEqual(t.partida.salvar(),antes);}
   else if(t.etapa.tipo==='descarte'){const antes=t.partida.salvar();assert(t.consultarDescarte(0));assert.deepEqual(t.partida.salvar(),antes);}
   else {const p=t.etapa,c=[...e.jogadores[0].mao,...e.jogadores[0].campo].find(c=>c.base.codigo===p.codigo);assert(t.agir({tipo:p.tipo,uid:p.tipo==='atacar'?undefined:c?.uid,revisao:t.partida.revisao}).ok);}
   assert.deepEqual(todas(t.partida.estado).map(c=>c.uid).sort((a,b)=>a-b),uids);
  }
  assert.equal(t.partida.estado.vencedor,0);assert.equal(t.partida.estado.jogadores[1].derrotados,3);assert.equal(t.partida.estado.jogadores[0].derrotados,1);
  assert.equal(t.partida.estado.jogadores[0].campo[0].base.codigo,'n034');assert.equal(t.partida.estado.jogadores[0].campo[0].defesa,12);assert.equal(t.etapa,null);assert([...compras.values()].every(n=>n===1));
 }
});
