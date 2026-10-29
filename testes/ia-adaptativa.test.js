const{test}=require('node:test'),assert=require('node:assert/strict');
const Partida=require('../partida'),M=require('../public/motor'),IA=require('../public/ia');
const cartas=Array.from({length:48},(_,i)=>({codigo:'ia'+i,nome:'Campeão '+i,classe:'campeão',ataque:3,defesa:20}));
const criar=(n=1)=>new Partida(Array.from({length:n},(_,i)=>({id:'p'+i,nome:'Pessoa '+i})),cartas,'coop',20);
const campo=(p,i)=>{const j=p.estado.jogadores[i],c=j.mao.shift();j.campo=[c];return c;};
for(const nivel of IA.NIVEIS)test(`IA ${nivel} usa cartas antes de comprar e nunca passa com invocação disponível`,()=>{
 const p=criar();p.estado.turno=1;
 const antes=structuredClone(p.estado),r=IA.escolher(p.estado,nivel,()=>.99);
 assert(r?.res.ok);assert.equal(r.tipo,'invocar');assert.equal(r.copia.acoes,1);assert.deepEqual(p.estado,antes);
});
for(const nivel of IA.NIVEIS)test(`IA ${nivel} compra no máximo uma vez, mesmo restando ação e cartas no baralho`,()=>{
 const p=criar();campo(p,1);p.estado.turno=1;
 const r=IA.escolher(p.estado,nivel,()=>0);assert.equal(r.tipo,'comprar');p.estado=r.copia;
 assert.equal(p.estado.acoes,1);assert(p.estado.jogadores[1].baralho.length>0);
 assert.equal(IA.escolher(p.estado,nivel),null);
 const n=p.estado.jogadores[1].mao.length;assert(p.passoComputador());assert.equal(p.estado.turno,0);assert.equal(p.estado.jogadores[1].mao.length,n);
 M.encerrarTurno(p.estado);assert.equal(p.estado.turno,1);assert.equal(IA.escolher(p.estado,nivel).tipo,'comprar');
});
test('se a compra revelar uma carta que pode ser jogada, a IA usa a ação restante nela',()=>{
 const p=criar();campo(p,1);p.estado.turno=1;
 const carta=p.estado.jogadores[1].baralho.at(-1);carta.base={...carta.base,classe:'item',defesa:5};
 const r=IA.escolher(p.estado);assert.equal(r.tipo,'comprar');p.estado=r.copia;
 assert.equal(IA.escolher(p.estado).tipo,'equipar');
});
test('repetir ataques é permitido; a máquina não fica comprando enquanto pode atacar',()=>{
 const p=criar();campo(p,0);campo(p,1);p.estado.turno=1;
 const r=IA.escolher(p.estado);assert.equal(r.tipo,'atacar');const r2=IA.escolher(r.copia);assert.equal(r2.tipo,'atacar');
 assert.equal(r2.copia.jogadores[1].iaTurno.compras,0);assert.equal(r2.copia.acoes,0);
});
test('limite de compra não bloqueia habilidades que compram cartas',()=>{
 const p=criar();campo(p,1);p.estado.turno=1;p.estado.acoes=1;p.estado.jogadores[1].iaTurno={turno:p.estado.numTurno,compras:1};
 const pergaminho=p.estado.jogadores[1].mao[0];pergaminho.base={...pergaminho.base,codigo:'n031',nome:'Pergaminho',classe:'item',ataque:0,defesa:0};
 const antes=p.estado.jogadores[1].mao.length,r=IA.escolher(p.estado);assert.equal(r.tipo,'habilidade');assert(r.copia.jogadores[1].mao.length>antes);assert.equal(r.copia.jogadores[1].iaTurno.compras,1);
});
test('a memória de compras pertence a cada máquina e sobrevive à restauração',()=>{
 const p=criar(2);campo(p,2);campo(p,3);p.estado.turno=2;
 const r=IA.escolher(p.estado);assert.equal(r.tipo,'comprar');p.estado=r.copia;
 const restaurada=Partida.restaurar(JSON.parse(JSON.stringify(p.salvar())));assert.equal(IA.escolher(restaurada.estado),null);
 restaurada.estado.turno=3;restaurada.estado.acoes=2;restaurada.estado.numTurno++;
 assert.equal(IA.escolher(restaurada.estado).tipo,'comprar');
});
test('a IA responde a um padrão público de ataques preparando defesa',()=>{
 const p=criar(),a=campo(p,1),b=campo(p,0);p.estado.turno=1;a.ataqueBase=4;a.defesa=a.defesaMax=5;b.ataqueBase=3;b.defesa=b.defesaMax=20;
 const item=p.estado.jogadores[1].mao[0];item.base={...item.base,classe:'item',defesa:10,ataque:0};
 assert.equal(IA.escolher(p.estado,'normal').tipo,'atacar');
 p.estado.padroesIA={0:Array.from({length:4},(_,i)=>({tipo:'atacar',alvo:1,turno:i}))};
 assert.equal(IA.escolher(p.estado,'normal').tipo,'equipar');
});
test('máquinas coordenam o alvo a partir do ataque público de um aliado',()=>{
 const p=criar(2);for(let i=0;i<4;i++)campo(p,i);p.estado.turno=2;
 assert.equal(IA.escolher(p.estado).pedido.alvo,0);
 p.estado.padroesIA={3:[{tipo:'atacar',alvo:1,turno:p.estado.numTurno}]};
 assert.equal(IA.escolher(p.estado).pedido.alvo,1);
});
test('padrões são registrados apenas em ações confirmadas e não revelam mãos na visão pública',()=>{
 const p=criar();assert(p.agir('p0',{tipo:'comprar',revisao:0}).ok);
 assert.equal(p.estado.padroesIA[0].at(-1).tipo,'comprar');const antes=structuredClone(p.estado.padroesIA);
 assert(p.agir('p0',{tipo:'invocar',uid:-1,revisao:p.revisao}).erro);assert.deepEqual(p.estado.padroesIA,antes);
 assert(p.agir('p0',{tipo:'encerrar',revisao:p.revisao}).ok);assert(p.passoComputador());
 assert(p.estado.padroesIA[1].length);assert(p.estado.jogadores[1].iaTurno);
 const publica=JSON.stringify(p.visao('p0'));assert(!publica.includes('padroesIA'));assert(!publica.includes('iaTurno'));
 const r=Partida.restaurar(JSON.parse(JSON.stringify(p.salvar())));assert.deepEqual(r.estado.padroesIA,p.estado.padroesIA);
});
test('observação não armazena identidade das cartas compradas e tem tamanho limitado',()=>{
 let antes=criar().estado;
 for(let i=0;i<40;i++){const depois=structuredClone(antes);IA.observar(antes,depois,0,'comprar',1);antes=depois;}
 assert.equal(antes.padroesIA[0].length,16);assert(antes.padroesIA[0].every(a=>a.tipo==='comprar'&&a.alvo===null));
 assert(antes.padroesIA[0].every(a=>Object.keys(a).length===3));
});
test('aprendizado e decisões não dependem das mãos e baralhos de adversários ou aliados',()=>{
 const p=criar(2);for(let i=0;i<4;i++)campo(p,i);p.estado.turno=2;
 p.estado.padroesIA={3:[{tipo:'atacar',alvo:1,turno:1}],1:[{tipo:'comprar',alvo:null,turno:1}]};
 const pedido=IA.escolher(p.estado,'dificil').pedido;
 for(const i of[0,1,3]){p.estado.jogadores[i].mao.forEach(c=>{c.base={...c.base,nome:'SEGREDO',classe:'feitiço',ataque:99999};});p.estado.jogadores[i].baralho.reverse();}
 assert.deepEqual(IA.escolher(p.estado,'dificil').pedido,pedido);
});
