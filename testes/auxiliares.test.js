const { test } = require('node:test');
const assert = require('node:assert/strict');
const Motor = require('../public/motor');
const Partida = require('../partida');
const catalogo = Array.from({ length: 40 }, (_, i) => ({ codigo: 'teste' + i, nome: 'Carta ' + i, classe: 'campeão', ataque: 5, defesa: 20 }));
const jogadores = [{ id: 'a', nome: 'A' }, { id: 'b', nome: 'B' }];
const todas = j => [...j.mao, ...j.baralho, ...j.campo, ...j.apoio, ...j.descarte].flatMap(c => [c, ...c.equip]);
function preparar(modo = 'multiplayer') {
  const p = new Partida(jogadores, catalogo, modo);
  p.estado.turno = 0;
  const adversario = modo === 'coop' ? 2 : 1;
  for (const j of p.estado.jogadores) {
    const campeao = j.mao.shift(); j.campo = [campeao];
    j.apoio = [j.baralho.pop(), j.baralho.pop()];
    j.apoio.forEach(c => { c.base = { ...c.base, classe: 'auxiliar' }; c.st.veneno = 2; });
  }
  return { p, e: p.estado, alvo: adversario, dono: p.estado.jogadores[adversario] };
}
function conferir(e, i, auxiliares) {
  const j = e.jogadores[i];
  assert.equal(j.campo.length, 0);
  assert.equal(j.apoio.length, 0);
  assert.equal(j.derrotados, 1, 'auxiliares não contam como campeões derrotados');
  for (const c of auxiliares) {
    const descartada = j.descarte.find(x => x.uid === c.uid);
    assert(descartada); assert.deepEqual(descartada.st, {});
  }
  const cartas = e.jogadores.flatMap(todas);
  assert.equal(cartas.length, 40);
  assert.equal(new Set(cartas.map(c => c.uid)).size, 40);
}

for (const causa of ['ataque', 'contra-ataque', 'habilidade', 'veneno', 'queimadura', 'pandora', 'confusao']) test('campeão derrotado por ' + causa + ' leva os auxiliares ao descarte', () => {
  const { e, alvo, dono } = preparar();
  let indice = alvo;
  let auxiliares = dono.apoio.slice();
  if (causa === 'ataque') {
    dono.campo[0].defesa = 1;
    assert(Motor.atacar(e).ok);
  } else if (causa === 'contra-ataque') {
    indice = 0; auxiliares = e.jogadores[0].apoio.slice();
    e.jogadores[0].campo[0].defesa = 1;
    assert(Motor.atacar(e).ok);
  } else if (causa === 'habilidade') {
    const carta = e.jogadores[0].campo[0]; carta.base.codigo = 'n040';
    assert(Motor.executarHabilidade(e, carta.uid).ok);
  } else {
    const c = dono.campo[0]; c.defesa = 1;
    if (causa === 'pandora') { const spell=e.jogadores[0].mao[0];spell.base={...spell.base,codigo:'n002',classe:'feitiço',ataque:0};assert(Motor.executarHabilidade(e,spell.uid).ok); }
    else if (causa === 'confusao') c.st.confusao = true;
    else c.st[causa] = 2;
    if(causa!=='pandora')assert(Motor.encerrarTurno(e).ok);
  }
  conferir(e, indice, auxiliares);
  assert(e.log.some(t => t.includes('auxiliares') && t.includes('descarte')));
});

test('derrota de besta também descarta seus auxiliares sem contar como campeão derrotado', () => {
  const { e, dono } = preparar();
  dono.campo[0].base.classe = 'besta'; dono.campo[0].defesa = 1;
  assert(Motor.atacar(e).ok);
  assert.equal(dono.apoio.length, 0); assert.equal(dono.derrotados, 0);
  assert.equal(dono.descarte.length, 3);
});

test('campeão que sobrevive mantém os auxiliares', () => {
  const { e, dono } = preparar();
  assert(Motor.atacar(e).ok);
  assert.equal(dono.apoio.length, 2);
});

test('no co-op, auxiliares dos aliados e do atacante permanecem em jogo', () => {
  const { p, e, alvo, dono } = preparar('coop');
  const auxiliares = dono.apoio.slice(); dono.campo[0].defesa = 1;
  assert(p.agir('a', { tipo: 'atacar', alvo, revisao: 0 }).ok);
  conferir(p.estado, alvo, auxiliares);
  assert.equal(p.estado.jogadores[0].apoio.length, 2);
  assert.equal(p.estado.jogadores[1].apoio.length, 2);
  assert.equal(p.visao('a').jogadores[alvo].apoio.length, 0);
  assert.equal(p.visao('b').jogadores[alvo].apoio.length, 0);
  assert.equal(e.jogadores[1].apoio.length, 2);
});
