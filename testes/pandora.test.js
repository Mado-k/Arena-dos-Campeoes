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
for(const [modo,n] of [['multiplayer',2],['local',2],['local',4],['coop',4]]) {
  test(`Pandora atinge todos os inimigos e preserva aliados e auxiliares ao lançar: ${modo}, ${n} humanos`,()=>{
    const {p,caixa}=preparar(modo,n);
    const inimigos=M.adversarios(p.estado,0);
    p.estado.jogadores[inimigos[0]].campo[0].base.classe='besta';
    const apoios=p.estado.jogadores.map(j=>{
      const aux=j.baralho.pop();
      aux.base={...aux.base,classe:'auxiliar',defesa:0};aux.defesa=aux.defesaMax=0;
      aux.vinculo=j.campo[0].uid;j.apoio.push(aux);return aux.uid;
    });
    assert(p.agir('j0',{tipo:'habilidade',uid:caixa.uid,revisao:0}).ok);
    const e=p.estado;
    for(const [i,j] of e.jogadores.entries()){
      assert.equal(j.campo[0].defesa,inimigos.includes(i)?20:30);
      assert.equal(j.apoio.length,1,'auxiliar não recebe dano se sua criatura sobreviver');
      assert.equal(j.apoio[0].uid,apoios[i]);assert.equal(j.apoio[0].defesa,0);
      assert(!j.descarte.some(c=>c.uid===apoios[i]));
      assert.equal(j.derrotados,0,'auxiliares não contam para a vitória');
    }
    assert.equal(e.acoes,1);assert(e.jogadores[0].descarte.some(c=>c.uid===caixa.uid));
    for(let i=0;i<e.jogadores.length;i++)assert(M.encerrarTurno(e).ok);
    for(const [i,j] of e.jogadores.entries())assert.equal(j.campo[0].defesa,inimigos.includes(i)?20:30,'não repete o dano em turnos futuros');
    const log=p.visao('j0').log.at(-1);
    assert.match(log,/10 de dano, DEF restante 20/);
    assert.equal(log,p.visao('j1').log.at(-1));
  });
}
test('campeão derrotado por Pandora completa a vitória; besta não soma derrota',()=>{
  for(const classe of ['campeão','besta']) {
    const {e,caixa}=preparar(),j=e.jogadores[1];
    j.derrotados=2;j.campo[0].base.classe=classe;j.campo[0].defesa=10;
    assert(M.executarHabilidade(e,caixa.uid).ok);assert.equal(j.campo.length,0);
    assert.equal(j.derrotados,classe==='campeão'?3:2);assert.equal(e.vencedor,classe==='campeão'?0:null);
  }
});
test('auxiliares e equipamentos não recebem dano de Pandora, mesmo com valores legados de defesa',()=>{
  const {e,caixa}=preparar();
  const j=e.jogadores[1],criatura=j.campo[0],aux=j.baralho.pop(),item=j.mao.pop();
  aux.base={...aux.base,classe:'auxiliar'};j.apoio.push(aux);
  item.base={...item.base,classe:'item'};criatura.equip.push(item);
  assert(M.executarHabilidade(e,caixa.uid).ok);
  assert(j.apoio.includes(aux));assert.equal(aux.defesa,30);
  assert.equal(item.defesa,30);assert(criatura.equip.includes(item));
  assert.equal(j.derrotados,0);
});
test('derrota da criatura descarta cada auxiliar vinculado uma única vez',()=>{
  const {e,caixa}=preparar(),j=e.jogadores[1],criatura=j.campo[0];
  criatura.defesa=10;
  for(const defesa of [0,30]){
    const aux=j.baralho.pop();aux.base={...aux.base,classe:'auxiliar',defesa};
    aux.defesa=aux.defesaMax=defesa;aux.vinculo=criatura.uid;j.apoio.push(aux);
  }
  const ids=[criatura.uid,...j.apoio.map(c=>c.uid)];
  assert(M.executarHabilidade(e,caixa.uid).ok);
  assert.equal(j.campo.length,0);assert.equal(j.apoio.length,0);assert.equal(j.derrotados,1);
  for(const uid of ids)assert.equal(j.descarte.filter(c=>c.uid===uid).length,1);
  const todas=e.jogadores.flatMap(j=>[...j.mao,...j.baralho,...j.campo,...j.apoio,...j.descarte].flatMap(c=>[c,...c.equip]));
  assert.equal(todas.length,40);assert.equal(new Set(todas.map(c=>c.uid)).size,40);
});
test('Pandora preserva todos os apoios quando não há criatura vinculada em batalha',()=>{
  const {e,caixa}=preparar(),j=e.jogadores[1];
  j.mao.push(...j.campo.splice(0));
  const protegido=j.baralho.pop(),alvo=j.baralho.pop();
  protegido.base={...protegido.base,codigo:'n037',classe:'auxiliar'};
  alvo.base={...alvo.base,classe:'auxiliar'};j.apoio.push(protegido,alvo);
  assert(M.executarHabilidade(e,caixa.uid).ok);
  assert.equal(protegido.defesa,30);assert.equal(alvo.defesa,30);assert.equal(j.apoio.length,2);
});
for(const modo of ['local','coop'])test(`Pandora derrota todos os inimigos simultaneamente e preserva aliados: ${modo}`,()=>{
  const {e,caixa}=preparar(modo,4),inimigos=M.adversarios(e,0);
  e.jogadores.forEach(j=>{j.derrotados=2;j.campo[0].defesa=10;});
  assert(M.executarHabilidade(e,caixa.uid).ok);
  for(const [i,j] of e.jogadores.entries()){
    assert.equal(j.derrotados,inimigos.includes(i)?3:2);
    assert.equal(j.campo.length,inimigos.includes(i)?0:1);
    if(!inimigos.includes(i))assert.equal(j.campo[0].defesa,10);
  }
  assert.equal(e.vencedor,0);
});
test('Fuleco amplia Pandora para 20 contra os inimigos e preserva seu próprio campo',()=>{
  const {e,caixa}=preparar(),j=e.jogadores[0],aux=j.baralho.pop();
  aux.base={...aux.base,codigo:'n009',classe:'auxiliar',defesa:0};aux.defesa=0;
  aux.vinculo=j.campo[0].uid;j.apoio.push(aux);j.campo[0].defesa=20;
  assert(M.executarHabilidade(e,caixa.uid).ok);
  assert.equal(j.campo[0].defesa,20);assert(j.apoio.includes(aux));assert.equal(aux.defesa,0);
  assert.equal(e.jogadores[1].campo[0].defesa,10);
});
test('Pandora respeita proteção contra elementos diferentes de fantasma',()=>{
  const {e,caixa}=preparar(),c=e.jogadores[1].campo[0];
  c.base.codigo='n037'; // Só pode ser ferida por cartas do elemento fantasma.
  assert(M.executarHabilidade(e,caixa.uid).ok);assert.equal(c.defesa,30);
});
test('reciclar Pandora não permite repetir o uso nem gastar ação recusada',()=>{
  const {e,caixa}=preparar(),j=e.jogadores[0];
  assert(M.executarHabilidade(e,caixa.uid).ok);
  j.descarte.splice(j.descarte.indexOf(caixa),1);j.mao.push(caixa);
  const antes=structuredClone(e);
  assert(M.executarHabilidade(e,caixa.uid).erro);assert.deepEqual(e,antes);
  assert.equal(M.estadoHabilidade(e,caixa.uid).disponivel,false);
});
test('restaurar sessão antiga desativa o dano contínuo de Pandora',()=>{
  const {p}=preparar();p.estado.pandora=true;p.estado.danoPandora=10;
  const r=Partida.restaurar(p.salvar());
  assert(r.estado.pandoraUsada);assert.equal(r.estado.pandora,false);
  assert(M.encerrarTurno(r.estado).ok);assert.equal(r.estado.jogadores[1].campo[0].defesa,30);
});
