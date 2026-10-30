const {test} = require('node:test');
const assert = require('node:assert/strict');
const M = require('../public/motor');
const Partida = require('../partida');
const catalogo = Array.from({length:40}, (_,i) => ({codigo:'p'+i,nome:'Criatura '+i,classe:'campeão',ataque:4,defesa:30}));

function preparar(modo='multiplayer', humanos=2) {
  const p = new Partida(Array.from({length:humanos},(_,i)=>({id:'j'+i,nome:'Jogador '+i})),catalogo,modo,40);
  const e=p.estado;e.turno=0;
  for(const j of e.jogadores) j.campo.push(j.mao.shift());
  const caixa=e.jogadores[0].mao[0];
  caixa.base={...caixa.base,codigo:'n002',nome:'Caixa de Pandora',classe:'feitiço',elemento:'sombrio',ataque:0,defesa:0};
  return {p,e,caixa};
}

for(const [modo,n] of [['multiplayer',2],['local',2],['local',4],['coop',4]])test(`Pandora causa dano só no início do turno do dono, em todos os lados: ${modo}/${n}`,()=>{
 const {e,caixa}=preparar(modo,n);
 for(const j of e.jogadores){const a=j.baralho.pop();a.base={...a.base,classe:'auxiliar',defesa:0};a.defesa=0;j.apoio.push(a);}
 assert(M.executarHabilidade(e,caixa.uid).ok);assert.equal(e.pandoraUsos,1);
 assert(e.jogadores.every(j=>j.campo[0].defesa===30));
 for(let i=0;i<e.jogadores.length;i++){
  assert(M.encerrarTurno(e).ok);
  assert.equal(e.jogadores[e.turno].campo[0].defesa,20);
  assert(e.jogadores.every(j=>j.apoio.length===1&&j.apoio[0].defesa===0));
 }
 assert(e.jogadores.every(j=>j.campo[0].defesa===20));
});
for(const classe of ['campeão','besta'])test(`Pandora encerra na derrota de ${classe}, só campeão soma para vitória`,()=>{
 const {e,caixa}=preparar(),j=e.jogadores[1];j.campo[0].base.classe=classe;j.campo[0].defesa=10;j.derrotados=2;
 assert(M.executarHabilidade(e,caixa.uid).ok);assert(M.encerrarTurno(e).ok);
 assert.equal(e.pandora,false);assert.equal(j.campo.length,0);
 assert.equal(j.derrotados,classe==='campeão'?3:2);assert.equal(e.vencedor,classe==='campeão'?0:null);
});
test('qualquer derrota em combate encerra Pandora, inclusive a criatura do invocador',()=>{
 const {e,caixa}=preparar();assert(M.executarHabilidade(e,caixa.uid).ok);
 e.jogadores[0].campo[0].defesa=1;assert(M.atacar(e).ok);assert.equal(e.pandora,false);
 const defesa=e.jogadores[1].campo[0].defesa;assert(M.encerrarTurno(e).ok);assert.equal(e.jogadores[1].campo[0].defesa,defesa);
});
test('Pandora admite três usos, permanece em campo ativa e só depois fica no descarte permanente',()=>{
 const {p,e,caixa}=preparar(),j=e.jogadores[0];
 for(let uso=1;uso<=3;uso++){
  e.acoes=2;assert(M.executarHabilidade(e,caixa.uid).ok);assert.equal(e.pandoraUsos,uso);
  assert.equal(caixa.usos.n002,uso);assert(j.feiticos.includes(caixa));assert(!j.descarte.includes(caixa));
  assert(M.executarHabilidade(e,caixa.uid).erro);assert.equal(e.acoes,1);
  // Uma besta é eliminada para terminar o efeito sem encerrar a partida por pontos.
  j.campo[0].base={...j.campo[0].base,classe:'besta'};assert(M.eliminarCarta(e,j.campo[0].uid).ok);
  assert.equal(e.pandora,false);assert.equal(j.feiticos.length,0);assert(j.descarte.includes(caixa));
  if(uso<3){j.descarte.splice(j.descarte.indexOf(caixa),1);j.mao.push(caixa);const c=j.baralho.pop();c.base={...c.base,classe:'besta'};j.campo.push(c);}
 }
 const r=Partida.restaurar(p.salvar());assert.equal(r.estado.pandora,false);assert.equal(r.estado.pandoraUsos,3);
 assert(M.descartePermanente(r.estado.jogadores[0].descarte.find(c=>c.uid===caixa.uid)));
});

for(const modo of ['multiplayer','coop'])test(`Pandora esgotada permanece no descarte na reciclagem: ${modo}`,()=>{
 const {e,caixa}=preparar(modo),j=e.jogadores[0];j.mao.splice(j.mao.indexOf(caixa),1);caixa.usos.n002=3;j.descarte.push(caixa);
 for(const dono of e.jogadores)dono.descarte.push(...dono.baralho.splice(0));
 assert(M.comprarAcao(e).ok);assert(j.descarte.includes(caixa));
 assert(!e.jogadores.some(d=>[...d.mao,...d.baralho].includes(caixa)));
});
test('reciclagem por habilidade também preserva Pandora no descarte permanente',()=>{
 const {e,caixa}=preparar(),j=e.jogadores[0];j.mao.splice(j.mao.indexOf(caixa),1);caixa.usos.n002=3;j.descarte.push(caixa);
 const rec=j.mao[0];rec.base={...rec.base,codigo:'n024',classe:'feitiço',ataque:0};
 const antes=structuredClone(e);assert(M.executarHabilidade(e,rec.uid).erro);assert.deepEqual(e,antes);
 j.descarte.push(j.baralho.pop());assert(M.executarHabilidade(e,rec.uid).ok);assert(j.descarte.includes(caixa));
});
test('Fuleco amplia o dano periódico e a potência permanece após restauração',()=>{
 const {p,e,caixa}=preparar(),aux=e.jogadores[0].baralho.pop();aux.base={...aux.base,codigo:'n009',classe:'auxiliar'};e.jogadores[0].apoio.push(aux);
 assert(M.executarHabilidade(e,caixa.uid).ok);assert.equal(e.danoPandora,20);
 const r=Partida.restaurar(p.salvar());assert(M.encerrarTurno(r.estado).ok);assert.equal(r.estado.jogadores[1].campo[0].defesa,10);
});
test('recuperação direta não retira Pandora esgotada do descarte',()=>{
 const {e,caixa}=preparar(),j=e.jogadores[0];
 j.mao.splice(j.mao.indexOf(caixa),1);caixa.usos.n002=3;caixa.base.universo='zumbi';j.descarte.push(caixa);
 const recuperar=j.mao[0];recuperar.base={...recuperar.base,codigo:'n005',classe:'feitiço',ataque:0};
 const antes=structuredClone(e);assert(M.executarHabilidade(e,recuperar.uid).erro);assert.deepEqual(e,antes);
});
test('somente Pandora permanente no descarte não habilita compra ou redistribuição',()=>{
 const {e,caixa}=preparar(),j=e.jogadores[0];j.mao.splice(j.mao.indexOf(caixa),1);caixa.usos.n002=3;j.descarte.push(caixa);
 e.jogadores.forEach(d=>d.mao.push(...d.baralho.splice(0)));
 const antes=structuredClone(e);assert.equal(M.podeComprar(e),false);assert(M.comprarAcao(e).erro);assert.deepEqual(e,antes);
});
for(const modo of ['multiplayer','local','coop'])test(`Fenrir reserva +100 e só o próximo campeão consome a herança: ${modo}`,()=>{
 const {p,e}=preparar(modo),j=e.jogadores[0],op=e.cooperativo?2:1;
 const fenrir=j.campo[0];fenrir.base={...fenrir.base,codigo:'n023',classe:'besta'};fenrir.defesa=1;
 e.turno=op;assert(M.atacar(e).ok);assert.equal(j.bonusCampeao,100);
 e.turno=0;e.acoes=2;const besta=j.mao[1];besta.base={...besta.base,classe:'besta'};
 assert(M.invocar(e,besta.uid).ok);assert.equal(besta.defesa,30);assert.equal(j.bonusCampeao,100);
 besta.defesa=1;e.turno=op;e.acoes=2;assert(M.atacar(e).ok);
 e.turno=0;e.acoes=2;const c=j.baralho.pop();j.mao.push(c);
 assert(M.invocar(e,c.uid).ok);assert.equal(c.defesa,130);assert.equal(c.defesaMax,130);assert.equal(j.bonusCampeao,0);
 const r=Partida.restaurar(p.salvar());assert.equal(r.estado.jogadores[0].campo[0].defesa,130);
});
test('registro público e visão mostram a herança de Fenrir e o dano periódico de Pandora',()=>{
 const {p,e,caixa}=preparar();e.jogadores[1].campo[0].base.codigo='n023';e.jogadores[1].campo[0].defesa=10;
 assert(p.agir('j0',{tipo:'habilidade',uid:caixa.uid,revisao:0}).ok);
 assert(p.agir('j0',{tipo:'encerrar',revisao:1}).ok);
 const v=p.visao('j0');assert.equal(v.jogadores[1].bonusCampeao,100);
 assert(v.log.some(l=>l.startsWith('A Caixa de Pandora causou')));assert(v.log.some(l=>l.includes('deixou uma herança')));
});
