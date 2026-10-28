const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const Motor = require('../public/motor');
const Partida = require('../partida');
const contexto = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/cartas-offline.js'), 'utf8'), contexto);
const cartas = JSON.parse(JSON.stringify(contexto.window.CARTAS_OFFLINE));
const jogadores = [{ id: 'a', nome: 'A' }, { id: 'b', nome: 'B' }];
const todas = j => [...j.mao, ...j.baralho];

for (const total of [20, 30, 40]) test(`${total} cartas no total: metade por jogador, sem repetição`, () => {
  for (let tentativa = 0; tentativa < 100; tentativa++) {
    const e = Motor.novoJogo({ nomes: ['A', 'B'], tamanhoBaralho: total }, cartas);
    assert.equal(e.tamanhoBaralho, total);
    for (const j of e.jogadores) {
      assert.equal(j.mao.length, 3);
      assert.equal(j.baralho.length, total / 2 - 3);
      assert.equal(todas(j).length, total / 2);
    }
    const conjunto = e.jogadores.flatMap(todas);
    assert.equal(new Set(conjunto.map(c => c.base.codigo)).size, total);
    assert.equal(new Set(conjunto.map(c => c.uid)).size, total);
    assert(conjunto.every(c => c.base.classe !== 'representante'));
  }
});

test('linhas duplicadas do catálogo não viram cópias extras', () => {
  const duplicadas = [...cartas, ...cartas.map(c => ({ ...c, numero: c.numero + 100 }))];
  const e = Motor.novoJogo({ nomes: ['A', 'B'], tamanhoBaralho: 40 }, duplicadas);
  assert.equal(new Set(e.jogadores.flatMap(todas).map(c => c.base.codigo)).size, 40);
  assert.throws(() => Motor.novoJogo({ nomes: ['A', 'B'], tamanhoBaralho: 20 }, Array(40).fill(cartas[0])), { code: 'CARTAS_INSUFICIENTES' });
});

test('cartas cadastradas sem código usam o número para identificar a carta', () => {
  const catalogo = Array.from({ length: 20 }, (_, i) => ({ numero: i + 1, codigo: null, nome: 'Mesmo nome', classe: 'campeão', ataque: 1, defesa: 1 }));
  const e = Motor.novoJogo({ nomes: ['A', 'B'], tamanhoBaralho: 20 }, catalogo);
  assert.equal(new Set(e.jogadores.flatMap(todas).map(c => c.base.numero)).size, 20);
});

test('tamanho inválido ou cartas insuficientes são recusados sem diminuir o baralho silenciosamente', () => {
  for (const tamanhoBaralho of [0, 21, 80, '40', NaN]) {
    assert.throws(() => Motor.novoJogo({ nomes: ['A', 'B'], tamanhoBaralho }, cartas), { code: 'TAMANHO_BARALHO_INVALIDO' });
  }
  assert.throws(() => new Partida(jogadores, cartas.slice(0, 30), 'multiplayer', 40), { code: 'CARTAS_INSUFICIENTES' });
});

for (const modo of ['multiplayer', 'coop']) for (const total of [20, 30, 40]) test(`${modo} informa o tamanho ${total} e preserva a divisão nas visões privadas`, () => {
  const p = new Partida(jogadores, cartas, modo, total);
  for (const j of jogadores) {
    const v = p.visao(j.id);
    assert.equal(v.tamanhoBaralho, total);
    for (const lado of v.jogadores) assert.equal(lado.maoTotal + lado.baralhoTotal, total / 2);
    assert.equal(v.jogadores[1 - v.voce].mao.length, 0);
  }
});
