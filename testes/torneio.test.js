const {test}=require('node:test'),assert=require('node:assert/strict');
const Partida=require('../partida'),M=require('../public/motor'),IA=require('../public/ia');
const cartas=Array.from({length:48},(_,i)=>({codigo:'arena'+i,nome:'Campeão '+i,classe:'campeão',ataque:10,defesa:1}));
const pessoas=n=>Array.from({length:n},(_,i)=>({id:'p'+i,nome:'Pessoa '+i}));
const criar=n=>new Partida(pessoas(n),cartas,'local',20);
const todas=e=>[...e.reservaCentral,...e.jogadores.flatMap(j=>[...j.mao,...j.baralho,...j.campo,...j.apoio,...j.descarte].flatMap(c=>[c,...c.equip]))];
function campo(p,i,ataque=100){const j=p.estado.jogadores[i],c=j.campo[0]||j.mao.shift()||j.baralho.pop();j.campo=[c];c.defesa=c.defesaMax=1;c.ataqueBase=ataque;return c;}
function derrubar(p,a,b){campo(p,a);campo(p,b,0);p.estado.turno=a;p.estado.acoes=2;p.estado.jogadores[b].derrotados=2;return p.agir('p'+a,{tipo:'atacar',alvo:b,revisao:p.revisao});}
for(const n of [3,4])test(`mata-mata com ${n} pessoas: adversário fixo e folga quando necessário`,()=>{
 const p=criar(n),e=p.estado;
 assert.deepEqual(e.torneio.duelos,n===4?[[0,2],[1,3]]:[[0,2]]);
 assert.deepEqual(e.torneio.aguardando,n===4?[]:[1]);
 for(const d of e.torneio.duelos)for(const i of d)assert.deepEqual(M.adversarios(e,i),d.filter(k=>k!==i));
 e.turno=0;const antes=structuredClone(e);
 assert(p.agir('p0',{tipo:'comprar',alvo:1,revisao:0}).erro);assert.deepEqual(p.estado,antes);
});
test('vencedor da semifinal aguarda, turnos o pulam e final mantém campo e mão com derrotas zeradas',()=>{
 const p=criar(4),mao=p.estado.jogadores[0].mao.map(c=>c.uid);campo(p,0);const c=p.estado.jogadores[0].campo[0].uid;
 p.estado.jogadores[0].derrotados=2;
 assert(derrubar(p,0,2).ok);assert.equal(p.estado.vencedor,null);assert(p.estado.torneio.aguardando.includes(0));
 assert.equal(p.estado.turno,1);assert(p.agir('p0',{tipo:'comprar',revisao:p.revisao}).erro);
 const tamanho=p.estado.jogadores[0].baralho.length;
 assert(derrubar(p,1,3).ok);const e=p.estado;
 assert.equal(e.torneio.rodada,2);assert.deepEqual(e.torneio.duelos,[[0,1]]);assert.deepEqual(e.torneio.aguardando,[]);
 assert.equal(e.jogadores[0].campo[0].uid,c);assert.deepEqual(e.jogadores[0].mao.map(c=>c.uid),mao.slice(1));
 assert.equal(e.jogadores[0].derrotados,0);assert.equal(e.jogadores[1].derrotados,0);
 assert(e.jogadores[0].baralho.length>tamanho);assert(e.jogadores[2].descarte.length===0&&e.jogadores[3].descarte.length===0);
 assert.equal(todas(e).length,20);assert.equal(new Set(todas(e).map(c=>c.uid)).size,20);
 assert(p.log.some(l=>l.includes('A final começou')));assert(e.acoes>=0&&e.acoes<=2);
 const r=Partida.restaurar(JSON.parse(JSON.stringify(p.salvar())));assert.deepEqual(r.visao('p0'),p.visao('p0'));
 // A primeira derrota na final não encerra o novo duelo.
 campo(p,1,0);p.estado.turno=0;p.estado.acoes=2;
 assert(p.agir('p0',{tipo:'atacar',alvo:1,revisao:p.revisao}).ok);assert.equal(p.estado.jogadores[1].derrotados,1);assert.equal(p.estado.vencedor,null);
});
test('três e cinco invocadores avançam com folga até a final sem perder cartas',()=>{
 for(const n of [3,5]){
  const p=n===3?criar(n):new Partida(pessoas(1),cartas,'local',20,{maquinas:4});
  assert.equal(p.estado.jogadores.length,n);
  // Os confrontos são os mesmos independentemente de humanos ou máquinas.
  while(p.estado.vencedor===null&&p.estado.torneio.rodada<4){
   const duelo=p.estado.torneio.duelos.find(d=>d.every(i=>!p.estado.jogadores[i].eliminado));
   if(!duelo)break;const[a,b]=duelo;
   campo(p,a);campo(p,b,0);p.estado.turno=a;p.estado.acoes=2;p.estado.jogadores[b].derrotados=2;
   assert(M.atacar(p.estado).ok);
   assert.equal(todas(p.estado).length,p.estado.tamanhoBaralho);
   assert.equal(new Set(todas(p.estado).map(c=>c.uid)).size,p.estado.tamanhoBaralho);
  }
  assert.equal(p.estado.vencedor,0);assert(p.estado.torneio.rodada>=2);
 }
});
test('redistribuição de uma semifinal independe do baralho do outro duelo',()=>{
 const p=criar(4),e=p.estado;
 for(const i of [0,2])e.jogadores[i].descarte.push(...e.jogadores[i].baralho.splice(0));
 e.turno=0;const rival=e.jogadores[1].baralho.map(c=>c.uid);
 assert(M.podeComprar(e));assert(M.comprarAcao(e).ok);
 assert.deepEqual(e.jogadores[1].baralho.map(c=>c.uid),rival);
 assert(e.jogadores[2].baralho.length>0);assert.equal(todas(e).length,20);
});
test('cartas permanentemente descartadas não são recuperadas na final',()=>{
 const p=criar(4),j=p.estado.jogadores[2],c=j.mao.pop();c.base={...c.base,codigo:'n002'};c.usos.n002=3;j.descarte.push(c);
 assert(derrubar(p,0,2).ok);assert(derrubar(p,1,3).ok);
 assert(p.estado.jogadores[2].descarte.some(x=>x.uid===c.uid));
 assert.equal(todas(p.estado).length,20);
});
for(const maquinas of [1,2,3,4])test(`solo contra ${maquinas} máquina(s) tem mãos individuais, IA e quantidade mínima`,()=>{
 const p=new Partida(pessoas(1),cartas,'local',20,{maquinas});
 assert.equal(p.estado.jogadores.length,maquinas+1);assert.equal(p.estado.jogadores.filter(j=>j.maquina).length,maquinas);
 assert(p.estado.jogadores.every(j=>j.mao.length===3&&j.mao.length+j.baralho.length>=5));
 assert.equal(p.estado.tamanhoBaralho%(maquinas+1),0);assert.equal(p.estado.turno,0);
 assert(p.agir('p0',{tipo:'encerrar',revisao:0}).ok);assert(p.passoComputador());
});
test('2v2 solo coloca uma máquina aliada, duas adversárias e premia a equipe correta',()=>{
 const p=new Partida(pessoas(1),cartas,'local',20,{formato:'2v2',maquinas:3}),e=p.estado;
 assert(e.equipes2v2&&e.cooperativo&&!e.todosContraTodos);assert.equal(e.torneio,null);
 assert.deepEqual(e.equipes,[0,1,0,1]);assert.deepEqual(M.adversarios(e,0),[1,3]);
 assert.throws(()=>new Partida(pessoas(1),cartas,'local',20,{formato:'2v2',maquinas:4}),/quatro/);
 campo(p,0);campo(p,1,0);campo(p,3,0);e.jogadores[1].derrotados=e.jogadores[3].derrotados=2;
 assert(p.agir('p0',{tipo:'atacar',alvo:2,revisao:0}).erro);
 assert(p.agir('p0',{tipo:'atacar',alvo:1,revisao:0}).ok);assert.equal(p.estado.vencedor,null);
 assert(p.agir('p0',{tipo:'atacar',alvo:3,revisao:1}).ok);assert.equal(p.estado.vencedor,0);
 assert(p.visao('p0').cooperativo&&p.visao('p0').equipes2v2);
});
test('máquinas sorteiam representantes válidos ou nenhum em todos os formatos',()=>{
 const rep={codigo:'D007',nome:'Rei',classe:'representante',universo:'normal',defesa:400},antigo=Math.random;
 try{for(const sorte of [0,.999]){
  Math.random=()=>sorte;
  for(const [modo,opcoes]of[['coop',{}],['local',{maquinas:3}],['local',{maquinas:3,formato:'2v2'}]]){
   const p=new Partida(pessoas(1),[...cartas,rep],modo,20,opcoes);
   for(const j of p.estado.jogadores.filter(j=>j.maquina))assert.equal(j.rep?.codigo||null,sorte?'D007':null);
  }
 }}finally{Math.random=antigo;}
});
test('IA de mata-mata só avalia o rival do confronto e não toca em mãos alheias',()=>{
 const p=new Partida(pessoas(1),cartas,'local',20,{maquinas:3});p.estado.turno=1;
 const a=IA.escolher(p.estado,'dificil');assert.equal(a.pedido.alvo,3);
 assert.equal(a.copia.jogadores[0].mao.length,p.estado.jogadores[0].mao.length);
});

for(const n of[3,4,5])test(`partidas completas de mata-mata com ${n} invocadores preservam todas as cartas até a vitória`,()=>{
 for(let rodada=0;rodada<8;rodada++){
  const p=new Partida(pessoas(1),cartas,'local',20,{maquinas:n-1});
  for(let passo=0;passo<800&&p.estado.vencedor===null;passo++){
   const melhor=p.estado.acoes>0?IA.escolher(p.estado,'normal'):null;
   if(melhor)p.estado=melhor.copia;else M.encerrarTurno(p.estado);
   assert.equal(todas(p.estado).length,p.estado.tamanhoBaralho);
   assert.equal(new Set(todas(p.estado).map(c=>c.uid)).size,p.estado.tamanhoBaralho);
   assert(p.estado.acoes>=0&&p.estado.acoes<=2);
  }
  assert.notEqual(p.estado.vencedor,null);assert(p.estado.torneio.rodada>=2);
 }
});
test('final iniciada por veneno no avanço automático também aparece no registro público',()=>{
 const p=criar(4);campo(p,1,0);p.estado.jogadores[1].derrotados=2;p.estado.jogadores[1].campo[0].st.veneno=10;
 assert(derrubar(p,0,2).ok);assert.equal(p.estado.torneio.rodada,2);
 assert(p.log.some(l=>l.includes('A final começou')));assert.equal(p.estado.vencedor,null);
 assert.equal(todas(p.estado).length,20);
});
