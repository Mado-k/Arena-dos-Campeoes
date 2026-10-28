const { test } = require('node:test');
const assert = require('node:assert/strict');
const Motor = require('../public/motor');
const Partida = require('../partida');
const catalogo = Array.from({length:40},(_,i)=>({codigo:'impasse'+i,nome:'Besta '+i,classe:'besta',ataque:1,defesa:2}));
function descartarTudo(e) {
  for(const j of e.jogadores) {
    const cartas = [...j.mao,...j.baralho,...j.campo,...j.apoio,...j.descarte].flatMap(c=>[c,...c.equip]);
    for(const c of cartas) c.equip=[];
    j.mao=[];j.baralho=[];j.campo=[];j.apoio=[];j.descarte=cartas;
  }
}
function mesa(total=40,redistribuicoes=4) {
  const e=Motor.novoJogo({nomes:['A','B'],comeca:0,tamanhoBaralho:total},catalogo);
  descartarTudo(e);e.redistribuicoes=redistribuicoes;return e;
}
function conferirCartas(e) {
  const cartas=[...e.reservaCentral,...e.jogadores.flatMap(j=>[...j.mao,...j.baralho,...j.campo,...j.apoio,...j.descarte].flatMap(c=>[c,...c.equip]))];
  assert.equal(cartas.length,e.tamanhoBaralho);assert.equal(new Set(cartas.map(c=>c.uid)).size,e.tamanhoBaralho);
}
for(const total of [20,30,40]) for(const ciclos of [4,5]) test(`${total} cartas descartadas após ${ciclos} redistribuições: empate antes de embaralhar novamente`,()=>{
  const e=mesa(total,ciclos),turno=e.turno,numTurno=e.numTurno;
  const descartes=e.jogadores.map(j=>j.descarte.map(c=>c.uid));
  assert.equal(Motor.podeComprar(e,0),false);assert.equal(Motor.podeComprar(e,1),false);
  assert(Motor.encerrarTurno(e).ok);assert.equal(e.vencedor,-1);assert.equal(e.redistribuicoes,ciclos);
  assert.equal(e.turno,turno);assert.equal(e.numTurno,numTurno);
  assert.deepEqual(e.jogadores.map(j=>j.descarte.map(c=>c.uid)),descartes);
  assert(e.log.includes(e.motivoEmpate));assert.match(e.motivoEmpate,/Não haverá novo embaralhamento/);
  conferirCartas(e);
  const antes=structuredClone(e);
  for(const acao of [Motor.comprarAcao,Motor.encerrarTurno,Motor.atacar]) assert(acao(e).erro);
  assert.deepEqual(e,antes);
});
for(const ciclos of [0,1,2,3]) test(`com ${ciclos} redistribuições completas ainda pode realizar a próxima, inclusive a quarta`,()=>{
  const e=mesa(40,ciclos);assert(Motor.encerrarTurno(e).ok);
  assert.equal(e.vencedor,null);assert.equal(e.redistribuicoes,ciclos+1);
  assert.deepEqual(e.jogadores.map(j=>j.baralho.length),[20,20]);conferirCartas(e);
});
for(const zona of ['mao','baralho','campo','apoio']) test(`quatro redistribuições não bastam se ainda há carta em ${zona}`,()=>{
  const e=mesa();const c=e.jogadores[0].descarte.pop();e.jogadores[0][zona].push(c);
  assert(Motor.encerrarTurno(e).ok);assert.equal(e.vencedor,null);conferirCartas(e);
});
test('carta reservada no centro também é considerada para o esgotamento total',()=>{
  const e=mesa();e.reservaCentral.push(e.jogadores[0].descarte.pop());
  assert(Motor.encerrarTurno(e).ok);assert.equal(e.vencedor,-1);assert.equal(e.reservaCentral.length,1);
  assert.equal(e.redistribuicoes,4);conferirCartas(e);
});
test('três turnos pulados não são um segundo critério de empate',()=>{
  const e=mesa();e.jogadores[0].mao.push(...e.jogadores[0].descarte.splice(0));e.jogadores[1].mao.push(...e.jogadores[1].descarte.splice(0));
  for(let i=0;i<8;i++)assert(Motor.encerrarTurno(e).ok);
  assert.equal(e.vencedor,null);assert.equal(e.redistribuicoes,4);conferirCartas(e);
});
test('vitória por três campeões derrotados tem prioridade sobre o critério de impasse',()=>{
  const e=mesa();e.jogadores[1].derrotados=3;
  assert(Motor.encerrarTurno(e).ok);assert.equal(e.vencedor,0);assert.equal(e.motivoEmpate,undefined);assert.equal(e.redistribuicoes,4);
});
test('uma carta faltando nos descartes não é tratada como esgotamento total',()=>{
  const e=mesa();e.jogadores[0].descarte.pop();assert(Motor.encerrarTurno(e).ok);assert.equal(e.vencedor,null);
});
test('morte após redistribuição parcial não empata enquanto ainda existem cartas nos baralhos',()=>{
  const e=mesa(),b=e.jogadores[1],c=b.descarte.pop();b.campo=[c];c.st.veneno=3;
  assert(Motor.encerrarTurno(e).ok);assert.equal(e.vencedor,null);assert.equal(e.redistribuicoes,5);assert.equal(b.campo.length,0);conferirCartas(e);
});
test('fim de duração de auxiliar pode completar o descarte sem passar para outro turno',()=>{
  const e=mesa(),j=e.jogadores[0],c=j.descarte.pop();c.base={...c.base,codigo:'n022',classe:'auxiliar'};c.st.dino=1;j.apoio=[c];
  assert(Motor.encerrarTurno(e).ok);assert.equal(e.vencedor,-1);assert.equal(e.turno,0);assert.equal(e.numTurno,1);conferirCartas(e);
});
test('online confirma o empate para os dois, preserva revisão e bloqueia ações seguintes',()=>{
  const p=new Partida([{id:'a',nome:'A'},{id:'b',nome:'B'}],catalogo);p.estado.turno=0;descartarTudo(p.estado);p.estado.redistribuicoes=4;
  assert(p.agir('a',{tipo:'encerrar',revisao:0}).ok);assert.equal(p.revisao,1);
  for(const id of p.ids){const v=p.visao(id);assert.equal(v.vencedor,-1);assert.match(v.motivoEmpate,/4 redistribuições/);assert(v.log.includes(v.motivoEmpate));}
  const antes=structuredClone(p.estado);assert(p.agir('a',{tipo:'comprar',revisao:1}).erro);assert(p.agir('b',{tipo:'encerrar',revisao:1}).erro);assert.deepEqual(p.estado,antes);
});
test('co-op conserva a reciclagem individual e não adota esse critério de empate',()=>{
  const p=new Partida([{id:'a',nome:'A'},{id:'b',nome:'B'}],catalogo.map(c=>({...c,classe:'campeão'})),'coop');
  descartarTudo(p.estado);p.estado.redistribuicoes=4;
  assert(Motor.encerrarTurno(p.estado).ok);assert.equal(p.estado.vencedor,null);
  assert(Motor.comprarAcao(p.estado).ok);assert.equal(p.estado.vencedor,null);conferirCartas(p.estado);
});

test('usar a última carta da mão encerra por impasse assim que ela chega ao descarte',()=>{
  const p=new Partida([{id:'a',nome:'A'},{id:'b',nome:'B'}],catalogo),e=p.estado;
  e.turno=0;descartarTudo(e);e.redistribuicoes=4;
  const c=e.jogadores[0].descarte.pop();c.base={...c.base,codigo:'n002',classe:'feitiço',ataque:0,defesa:0};e.jogadores[0].mao.push(c);
  assert(p.agir('a',{tipo:'habilidade',uid:c.uid,revisao:0}).ok);
  assert.equal(p.estado.vencedor,-1);assert.equal(p.estado.redistribuicoes,4);assert.equal(p.estado.acoes,1);conferirCartas(p.estado);
  for(const id of p.ids)assert.equal(p.visao(id).motivoEmpate,p.estado.motivoEmpate);
});
