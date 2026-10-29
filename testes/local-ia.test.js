const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../public/motor'),IA=require('../public/ia'),Partida=require('../partida');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const catalogo=Array.from({length:40},(_,i)=>({codigo:'local'+i,nome:'Campeão '+i,classe:'campeão',ataque:4,defesa:20}));
const pessoas=n=>Array.from({length:n},(_,i)=>({id:'p'+i,nome:'Pessoa '+i}));
const todas=e=>[...e.reservaCentral,...e.jogadores.flatMap(j=>[...j.mao,...j.baralho,...j.campo,...j.apoio,...j.descarte].flatMap(c=>[c,...c.equip]))];
for(const n of [1,2,3,4])test(`cinco cartas totais para cada humano e máquina com ${n} pessoas`,()=>{
 const p=new Partida(pessoas(n),catalogo,'coop',20),e=p.estado;
 assert.equal(e.tamanhoBaralho,Math.max(20,10*n));
 for(const j of e.jogadores){assert(j.mao.length+j.baralho.length>=5);assert.equal(j.mao.length,3);assert(j.baralho.length>=2);}
 assert.equal(todas(e).length,e.tamanhoBaralho);assert.equal(new Set(todas(e).map(c=>c.uid)).size,e.tamanhoBaralho);
});
for(const n of [2,3,4])test(`Local com ${n} pessoas separa mãos e distribui sem repetições`,()=>{
 const p=new Partida(pessoas(n),catalogo,'local',20),e=p.estado;
 assert.equal(e.jogadores.length,n);assert.equal(e.jogadores.filter(j=>j.maquina).length,0);
 assert(e.jogadores.every(j=>j.mao.length+j.baralho.length>=5));
 assert.equal(new Set(todas(e).map(c=>c.base.codigo)).size,20);
 for(let i=0;i<n;i++){const v=p.visao('p'+i);for(let j=0;j<n;j++)assert.equal(v.jogadores[j].mao.length,j===i?3:0);}
});
test('Local todos contra todos elimina, descarta recursos, pula turnos e só premia o último jogador',()=>{
 const p=new Partida(pessoas(4),catalogo,'local',20),e=p.estado;e.turno=0;
 for(let i=0;i<4;i++){const j=e.jogadores[i],c=j.mao.shift();j.campo=[c];c.defesa=c.defesaMax=1;c.ataqueBase=i===0?100:0;if(i)j.derrotados=2;}
 function agir(i,d){return p.agir('p'+i,{...d,revisao:p.revisao});}
 assert(agir(0,{tipo:'atacar',alvo:3}).ok);assert.equal(p.estado.vencedor,null);assert(p.estado.jogadores[3].eliminado);
 assert.equal(p.estado.jogadores[3].mao.length,0);assert.equal(p.estado.jogadores[3].baralho.length,0);
 assert(!M.adversarios(p.estado).includes(3));
 assert(agir(0,{tipo:'atacar',alvo:2}).ok);assert(agir(0,{tipo:'encerrar'}).ok);assert.equal(p.estado.turno,1);
 assert(agir(1,{tipo:'encerrar'}).ok);assert.equal(p.estado.turno,0);
 assert(agir(0,{tipo:'atacar',alvo:1}).ok);assert.equal(p.estado.vencedor,0);
 assert.equal(todas(p.estado).length,20);assert.equal(new Set(todas(p.estado).map(c=>c.uid)).size,20);
});
test('estado completo pode ser restaurado sem compartilhar referências nem perder revisão',()=>{
 const p=new Partida(pessoas(3),catalogo,'coop',20,{dificuldade:'dificil'});assert(p.agir('p0',{tipo:'comprar',revisao:0}).ok);
 const salvo=JSON.parse(JSON.stringify(p.salvar())),r=Partida.restaurar(salvo);
 assert.deepEqual(r.visao('p0'),p.visao('p0'));assert.equal(r.dificuldade,'dificil');
 assert(r.agir('p0',{tipo:'encerrar',revisao:1}).ok);assert.equal(p.revisao,1);assert.notEqual(r.revisao,p.revisao);
});
test('dificuldades preservam regras, não alteram o estado ao avaliar e ignoram mãos inimigas',()=>{
 const p=new Partida(pessoas(1),catalogo,'coop',20);p.estado.turno=1;
 for(const nivel of IA.NIVEIS){
  const e=structuredClone(p.estado),antes=structuredClone(e),r=IA.escolher(e,nivel,()=>0);
  assert(r?.res.ok);assert.deepEqual(e,antes);
  e.jogadores[0].mao.forEach(c=>{c.base.nome='SEGREDO';c.base.ataque=99999;c.base.classe='feitiço';});
  e.jogadores[0].baralho.reverse();assert.deepEqual(IA.escolher(e,nivel,()=>0).pedido,r.pedido);
 }
 assert.throws(()=>new Partida(pessoas(1),catalogo,'coop',20,{dificuldade:'impossivel'}),/Dificuldade/);
});
test('Difícil prefere preparar defesa ao ataque que deixaria a criatura exposta',()=>{
 const p=new Partida(pessoas(1),catalogo,'coop',20),e=p.estado;e.turno=1;
 const a=e.jogadores[1].mao.shift(),b=e.jogadores[0].mao.shift();e.jogadores[1].campo=[a];e.jogadores[0].campo=[b];
 a.ataqueBase=4;a.defesa=a.defesaMax=5;b.ataqueBase=3;b.defesa=b.defesaMax=20;
 const item=e.jogadores[1].mao[0];item.base={...item.base,classe:'item',ataque:0,defesa:10};
 assert.equal(IA.escolher(e,'normal').tipo,'atacar');assert.equal(IA.escolher(e,'dificil').tipo,'equipar');
});
test('Oni Zumbi dobra o ataque com item e continua impedida de equipar arma',()=>{
 const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/cartas-offline.js'),'utf8'),ctx);
 const p=new Partida(pessoas(2),JSON.parse(JSON.stringify(ctx.window.CARTAS_OFFLINE)),'local',40),e=p.estado;e.turno=0;
 function mover(codigo,zona){let c;for(const j of e.jogadores)for(const z of ['mao','baralho']){const i=j[z].findIndex(x=>x.base.codigo===codigo);if(i>=0)c=j[z].splice(i,1)[0];}assert(c);e.jogadores[0][zona].push(c);return c;}
 const oni=mover('n033','campo'),arma=mover('n006','mao'),item=mover('n026','mao'),base=oni.ataqueBase;
 assert.equal(M.ataqueTotal(oni,null,e),base);assert(M.equipar(e,arma.uid).erro);assert.equal(e.acoes,2);
 assert(M.equipar(e,item.uid).ok);assert.equal(M.ataqueTotal(oni,null,e),2*base);assert.match(M.descricao(oni.base).texto,/item/);
});
