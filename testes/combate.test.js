const { test } = require('node:test');
const assert = require('node:assert/strict');
const Partida = require('../partida');
const Motor = require('../public/motor');
const jogadores = [{ id: 'a', nome: 'Pessoa A' }, { id: 'b', nome: 'Pessoa B' }];

function mesa({ ataqueA = 7, defesaA = 20, ataqueB = 4, defesaB = 18, modo = 'multiplayer' } = {}) {
  const cartas = Array.from({ length: 40 }, (_, i) => ({ codigo: 'teste' + i, nome: 'Carta ' + i, classe: 'campeão', ataque: 1, defesa: 1 }));
  const p = new Partida(jogadores, cartas, modo);
  p.estado.turno = 0;
  const criaturas = p.estado.jogadores.map((j, i) => {
    const c = j.mao.shift();
    c.base = { ...c.base, nome: i ? 'Criatura B' : 'Criatura A', ataque: i ? ataqueB : ataqueA, defesa: i ? defesaB : defesaA };
    c.ataqueBase = c.base.ataque;
    c.defesa = c.defesaMax = c.base.defesa;
    j.campo = [c];
    return c;
  });
  return { p, a: criaturas[0], b: criaturas[1] };
}

test('registro inclui ataque, contra-ataque e defesa restante para ambos os jogadores', () => {
  const { p } = mesa();
  assert(p.agir('a', { tipo: 'atacar', revisao: 0 }).ok);
  const linha = p.log.at(-1);
  assert.match(linha, /Criatura A atacou Criatura B: 7 de dano/);
  assert.match(linha, /Contra-ataque: 4 de dano/);
  assert.match(linha, /Defesa restante: Criatura A \(Pessoa A\) 16; Criatura B \(Pessoa B\) 11/);
  assert.equal(p.visao('a').log.at(-1), linha);
  assert.equal(p.visao('b').log.at(-1), linha);
});

test('derrota no ataque registra zero de defesa antes da restauração no descarte', () => {
  const { p, b } = mesa({ ataqueA: 30, defesaB: 5 });
  assert(p.agir('a', { tipo: 'atacar', revisao: 0 }).ok);
  assert.match(p.log.at(-1), /30 de dano.*Contra-ataque: 0 de dano.*derrotado antes de revidar.*Pessoa A\) 20; Criatura B \(Pessoa B\) 0/);
  assert.equal(p.estado.jogadores[1].descarte[0].defesa, 5);
  assert.equal(b.defesa, 5);
});

test('derrota no contra-ataque também registra zero, sem mostrar defesa restaurada', () => {
  const { p } = mesa({ ataqueA: 3, defesaA: 5, ataqueB: 8 });
  assert(p.agir('a', { tipo: 'atacar', revisao: 0 }).ok);
  assert.match(p.log.at(-1), /3 de dano.*Contra-ataque: 8 de dano.*Pessoa A\) 0; Criatura B \(Pessoa B\) 15/);
  assert.equal(p.estado.jogadores[0].descarte[0].defesa, 5);
});

test('imunidade ao contra-ataque informa dano zero e mantém a defesa', () => {
  const { p, a } = mesa();
  a.base.codigo = 'n010'; a.base.classe = 'besta';
  assert(p.agir('a', { tipo: 'atacar', revisao: 0 }).ok);
  assert.match(p.log.at(-1), /Contra-ataque: 0 de dano.*não sofre dano.*Pessoa A\) 20; Criatura B \(Pessoa B\) 11/);
});

test('registro usa o dano após os bônus da habilidade', () => {
  const { p, a, b } = mesa({ ataqueA: 6 });
  a.base.codigo = 'n011'; b.base.elemento = 'metálico';
  assert(p.agir('a', { tipo: 'atacar', revisao: 0 }).ok);
  assert.match(p.log.at(-1), /12 de dano.*Contra-ataque: 4 de dano.*Pessoa A\) 16; Criatura B \(Pessoa B\) 6/);
});

test('ataque bloqueado não gasta ação nem inventa dano no registro', () => {
  const { p, b } = mesa(); b.base.codigo = 'n010'; b.base.classe = 'besta';
  const antes = p.log.slice();
  assert(p.agir('a', { tipo: 'atacar', revisao: 0 }).erro);
  assert.equal(p.estado.acoes, 2); assert.deepEqual(p.log, antes);
});

test('motor offline e ataques do computador têm o mesmo detalhamento', () => {
  const { p } = mesa();
  const res = Motor.atacar(p.estado);
  assert(res.ok);
  assert(p.estado.log.includes(res.registroCombate));
  assert.match(res.registroCombate, /7 de dano.*Contra-ataque: 4 de dano.*Defesa restante/);
  const { p: coop } = mesa({ modo: 'coop', defesaA: 100, defesaB: 100 });
  coop.estado.turno = 1;
  const computador = coop.estado.jogadores[1];
  computador.descarte.push(...computador.mao); computador.mao = [];
  coop.jogarComputador();
  const ataques = coop.log.filter(l => l.includes('atacou'));
  assert.equal(ataques.length, 2);
  assert(ataques.every(l => l.includes('Contra-ataque:') && l.includes('Defesa restante:')));
});
