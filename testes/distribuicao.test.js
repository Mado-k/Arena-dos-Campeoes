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
  const ajustado = Motor.tamanhoParaParticipantes(total, modo === 'coop' ? 4 : 2);
  for (const j of jogadores) {
    const v = p.visao(j.id);
    assert.equal(v.tamanhoBaralho, ajustado);
    for (const time of [0, 1]) assert.equal(v.jogadores.filter(l => l.equipe === time).reduce((n, l) => n + l.maoTotal + l.baralhoTotal, 0), ajustado / 2);
    for (let i = 0; i < v.jogadores.length; i++) assert.equal(v.jogadores[i].mao.length, i === v.voce ? 3 : 0);
  }
});

for (const [n,pedido,total] of [[3,20,21],[3,30,30],[4,30,32],[4,40,40]]) test(`Multiplayer: ${pedido} cartas com ${n} pessoas ajusta para ${total}, igualmente e sem repetições`, () => {
  const pessoas=Array.from({length:n},(_,i)=>({id:'p'+i,nome:'Pessoa '+i}));
  const p=new Partida(pessoas,cartas,'multiplayer',pedido), e=p.estado;
  assert.equal(e.tamanhoBaralho,total);
  assert(e.todosContraTodos);
  assert(e.jogadores.every(j=>todas(j).length===total/n && j.mao.length===3 && j.mao.some(Motor.ehCampeao)));
  assert.equal(new Set(e.jogadores.flatMap(todas).map(c=>c.base.codigo)).size,total);
  for(const pessoa of pessoas){const v=p.visao(pessoa.id);for(let i=0;i<n;i++)assert.equal(v.jogadores[i].mao.length,i===v.voce?3:0);}
  const r=Partida.restaurar(JSON.parse(JSON.stringify(p.salvar())));
  assert.deepEqual(r.visao('p0'),p.visao('p0'));
});

test('divisão inteira nunca reduz o total solicitado nem duplica cartas para completar o catálogo', () => {
  const pessoas=Array.from({length:3},(_,i)=>({id:'p'+i,nome:'Pessoa '+i}));
  assert.equal(Motor.tamanhoParaParticipantes(40,3),42);
  assert.equal(Motor.tamanhoParaParticipantes(40,6),42);
  assert.throws(()=>new Partida(pessoas,cartas,'multiplayer',40),{code:'CARTAS_INSUFICIENTES'});
  assert.throws(()=>new Partida(pessoas,cartas,'coop',40),{code:'CARTAS_INSUFICIENTES'});
  for(const n of [2,3,4,6,8])for(const pedido of [20,30,40]){
    const total=Motor.tamanhoParaParticipantes(pedido,n);
    assert.equal(total%n,0);assert(total>=pedido);assert(total/n>=5);
  }
});
