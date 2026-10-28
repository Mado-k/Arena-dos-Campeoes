const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const http = require('node:http');
const { once } = require('node:events');
const { Server } = require('socket.io');
const { io: conectar } = require('socket.io-client');
const Partida = require('../partida');
const banco = require('../banco');
const iniciarSalas = require('../salas');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/cartas-offline.js'), 'utf8'), ctx);
const cartas = JSON.parse(JSON.stringify(ctx.window.CARTAS_OFFLINE));
const jogadores = [0, 1].map(i => ({ id: 'p' + i, nome: 'Pessoa ' + i }));

test('autoridade: turno, revisão, propriedades desconhecidas e ações manuais', () => {
  const p = new Partida(jogadores, cartas);
  const id = p.ids[p.estado.turno], outro = p.ids[1 - p.estado.turno];
  const antes = structuredClone(p.estado);
  assert(p.agir(outro, { tipo: 'comprar', revisao: 0 }).erro);
  assert(p.agir(id, { tipo: 'ajustarCarta', revisao: 0 }).erro);
  assert(p.agir(id, { tipo: 'constructor', revisao: 0 }).erro);
  assert(p.agir(id, { tipo: 'comprar', revisao: -1 }).erro);
  assert(p.agir(id, { tipo: 'habilidade', uid: {}, revisao: 0 }).erro);
  assert.deepEqual(p.estado, antes);
  assert(p.agir(id, { tipo: 'comprar', revisao: 0 }).ok);
  assert.equal(p.estado.acoes, 1);
  assert(p.agir(id, { tipo: 'comprar', revisao: 0 }).erro);
  assert.equal(p.estado.acoes, 1);
  assert(p.agir('intruso', { tipo: 'comprar', revisao: 1 }).erro);
});

test('visão privada não contém mãos adversárias, baralhos nem logs internos', () => {
  const p = new Partida(jogadores, cartas);
  p.estado.log.push('SEGREDO DO BARALHO');
  for (const id of p.ids) {
    const v = p.visao(id), i = v.voce;
    assert.equal(v.jogadores[i].mao.length, 3);
    assert.equal(v.jogadores[1 - i].mao.length, 0);
    assert.equal(v.jogadores[1 - i].maoTotal, 3);
    for (const j of v.jogadores) assert.equal(j.baralho, undefined);
    assert(!JSON.stringify(v).includes('SEGREDO'));
    v.jogadores[i].mao[0].base.nome = 'Alterado no cliente';
    assert.notEqual(p.estado.jogadores[i].mao[0].base.nome, 'Alterado no cliente');
  }
  assert.equal(p.visao('intruso'), null);
});

test('equipamentos recebem estado de habilidade; perguntas não gastam ações', () => {
  const p = new Partida(jogadores, cartas);
  p.estado.turno = 0;
  const j = p.estado.jogadores[0];
  const motor = require('../public/motor');
  const selecionar = codigo => {
    const todas = [...j.mao, ...j.baralho];
    const c = todas.find(c => c.base.codigo === codigo);
    j.mao = j.mao.filter(x => x !== c); j.baralho = j.baralho.filter(x => x !== c);
    return c;
  };
  const campeao = selecionar('n013'), arma = selecionar('n006');
  j.campo = [campeao]; campeao.equip = [arma];
  assert.equal(p.visao('p0').jogadores[0].campo[0].equip[0].habilidade.tipo, 'ativa');
  const busca = selecionar('n035'); j.campo = [busca];
  const antes = structuredClone(p.estado);
  const res = p.agir('p0', { tipo: 'habilidade', uid: busca.uid, revisao: 0 });
  assert(res.pergunta);
  assert.deepEqual(p.estado, antes);
  assert(p.agir('p0', { tipo: 'habilidade', uid: busca.uid, escolha: res.pergunta.opcoes[0].valor, revisao: 0 }).ok);
  assert.equal(p.estado.acoes, 1);
  assert.equal(motor.HAB.D007.semEfeito, true);
});

test('co-op compartilha o lado da equipe e a IA devolve o turno', () => {
  const equipe = Array.from({ length: 4 }, (_, i) => ({ id: 'p' + i, nome: 'Pessoa ' + i }));
  const p = new Partida(equipe, cartas, 'coop');
  for (const j of equipe) assert.equal(p.visao(j.id).voce, 0);
  assert(p.agir('p2', { tipo: 'comprar', revisao: 0 }).ok);
  assert(p.agir('p3', { tipo: 'comprar', revisao: 1 }).ok);
  assert(p.agir('p0', { tipo: 'comprar', revisao: 2 }).erro);
  assert(p.agir('p1', { tipo: 'encerrar', revisao: 2 }).ok);
  p.jogarComputador();
  assert.equal(p.estado.turno, 0);
  assert.equal(p.estado.numTurno, 3);
  assert.equal(p.estado.acoes, 2);
  assert.equal(p.visao('p3').jogadores[1].mao.length, 0);
});

test('partidas online completas mantêm cartas, limites e bloqueiam ações após a vitória', () => {
  const Motor = require('../public/motor');
  for (const modo of ['multiplayer', 'coop']) {
    const p = new Partida(jogadores, cartas, modo);
    for (let turno = 0; turno < 600 && p.estado.vencedor === null; turno++) {
      for (let passo = 0; passo < 2 && p.estado.vencedor === null; passo++) {
        const j = p.estado.jogadores[p.estado.turno];
        const id = p.ids[p.coop ? 0 : p.estado.turno];
        const pedidos = [];
        for (const c of j.mao) {
          if (Motor.ehCriatura(c)) pedidos.push({ tipo: 'invocar', uid: c.uid });
          if (Motor.classeDe(c) === 'auxiliar') pedidos.push({ tipo: 'apoio', uid: c.uid });
          if (['arma', 'item'].includes(Motor.classeDe(c))) pedidos.push({ tipo: 'equipar', uid: c.uid });
        }
        pedidos.push({ tipo: 'atacar' });
        for (const c of [...j.mao, ...j.campo, ...j.apoio, ...j.campo.flatMap(x => x.equip)]) pedidos.push({ tipo: 'habilidade', uid: c.uid });
        pedidos.push({ tipo: 'comprar' });
        for (const d of pedidos) {
          let r = p.agir(id, { ...d, revisao: p.revisao });
          if (r.pergunta) r = p.agir(id, { ...d, escolha: r.pergunta.opcoes[0].valor, revisao: p.revisao });
          if (r.ok) break;
        }
      }
      if (p.estado.vencedor === null) {
        assert(p.agir(p.ids[p.coop ? 0 : p.estado.turno], { tipo: 'encerrar', revisao: p.revisao }).ok);
        p.jogarComputador();
      }
      for (const j of p.estado.jogadores) {
        const todas = [...j.mao, ...j.baralho, ...j.campo, ...j.apoio, ...j.descarte];
        const ids = todas.flatMap(c => [c.uid, ...c.equip.map(e => e.uid)]);
        assert.equal(ids.length, 40); assert.equal(new Set(ids).size, 40);
        assert(j.campo.length <= 1 && j.apoio.length <= 2);
      }
    }
    assert.notEqual(p.estado.vencedor, null, modo + ' deve terminar');
    assert(p.agir('p0', { tipo: 'comprar', revisao: p.revisao }).erro);
  }
});

test('Aiven: porta do banco independente, TLS verificado e compatibilidade de colunas', async () => {
  const config = banco.configuracao({ DB_PORT: '16171', DB_SSL: 'true', PORT: '3000' });
  assert.equal(config.port, 16171);
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(banco.configuracao({}).port, 3306);
  assert.throws(() => banco.configuracao({ DB_PORT: 'errada' }));
  for (const cols of [['ataque', 'defesa'], ['dano', 'vida']]) {
    assert.deepEqual(await banco.colunasAtributos({ query: async () => [cols.map(Field => ({ Field }))] }), cols);
  }
  const c = banco.normalizar({ codigo: 'D007', dano: null, vida: 400 });
  assert.equal(c.ataque, 0); assert.equal(c.defesa, 400);
});

test('API: mesma origem, Codespaces, Live Server e hospedagem', () => {
  const fonte = fs.readFileSync(path.join(__dirname, '../public/config.js'), 'utf8');
  const obter = (hostname, port, protocol = 'http:', manual) => {
    const c = { window: {}, location: { hostname, port, protocol } };
    if (manual !== undefined) c.window.ARENA_API = manual;
    vm.runInNewContext(fonte, c); return c.window.API;
  };
  assert.equal(obter('localhost', '16171'), '');
  assert.equal(obter('localhost', '5500'), 'http://localhost:16171');
  assert.equal(obter('arena-5500.app.github.dev', '', 'https:'), 'https://arena-16171.app.github.dev');
  assert.equal(obter('arena-16171.app.github.dev', '', 'https:'), '');
  assert.equal(obter('mado-k.github.io', '', 'https:'), 'https://arena-dos-campeoes.onrender.com');
  assert.equal(obter('localhost', '5500', 'http:', 'http://localhost:3000/'), 'http://localhost:3000');
});

async function ambiente(t, loader = async () => cartas) {
  const servidor = http.createServer();
  const io = new Server(servidor);
  iniciarSalas(io, loader);
  servidor.listen(0, '127.0.0.1'); await once(servidor, 'listening');
  const clientes = [];
  t.after(async () => { clientes.forEach(c => c.close()); await new Promise(r => io.close(r)); });
  async function cliente() {
    const c = conectar('http://127.0.0.1:' + servidor.address().port, { transports: ['websocket'], reconnection: false });
    clientes.push(c); await once(c, 'connect'); return c;
  }
  return { cliente };
}
const pedir = (c, evento, dados) => new Promise((resolve, reject) => c.timeout(4000).emit(evento, dados, (e, r) => e ? reject(e) : resolve(r)));
function esperar(c, evento) { return new Promise((resolve, reject) => {
  const timer = setTimeout(() => { c.off(evento, receber); reject(Error('Sem evento: ' + evento)); }, 4000);
  function receber(d) { clearTimeout(timer); resolve(d); }
  c.once(evento, receber);
}); }

for (const modo of ['multiplayer', 'coop']) test('Socket.IO real: ' + modo, { timeout: 12000 }, async t => {
  const a = await ambiente(t), host = await a.cliente(), convidados = [];
  const total = modo === 'coop' ? 4 : 2;
  const criado = await pedir(host, 'sala:criar', { modo, nome: 'Anfitrião' });
  for (let i = 1; i < total; i++) {
    const c = await a.cliente(); convidados.push(c);
    assert((await pedir(c, 'sala:entrar', { modo, codigo: criado.sala.codigo, nome: 'Amigo ' + i })).ok);
  }
  const todos = [host, ...convidados];
  assert((await pedir(convidados[0], 'partida:iniciar', {})).erro);
  assert((await pedir(host, 'partida:iniciar', {})).erro);
  const pronto = esperar(host, 'sala');
  for (const c of todos) c.emit('sala:pronto', true);
  await pronto;
  // Um ack na mesma conexão garante que os eventos anteriores já foram processados.
  for (const c of convidados) await pedir(c, 'partida:iniciar', {});
  const estados = todos.map(c => esperar(c, 'partida:estado'));
  assert((await pedir(host, 'partida:iniciar', {})).ok);
  const visoes = await Promise.all(estados);
  assert.equal(visoes[0].jogadores[1 - visoes[0].voce].mao.length, 0);
  assert.equal(visoes.at(-1).jogadores[visoes.at(-1).voce].mao.length, 3);
  const ativo = modo === 'coop' ? 0 : visoes[0].turno;
  const novas = todos.map(c => esperar(c, 'partida:estado'));
  assert((await pedir(todos[ativo], 'partida:acao', { tipo: 'comprar', revisao: 0 })).ok);
  const atualizadas = await Promise.all(novas);
  assert.equal(atualizadas[0].acoes, 1);
  assert((await pedir(todos[ativo], 'partida:acao', { tipo: 'comprar', revisao: 0 })).erro);
  const estranho = await a.cliente();
  assert((await pedir(estranho, 'sala:entrar', { modo, codigo: criado.sala.codigo, nome: 'Intruso' })).erro);
  assert((await pedir(estranho, 'partida:acao', { tipo: 'comprar', revisao: 1 })).erro);
  const encerrou = esperar(host, 'partida:encerrada');
  convidados[0].close();
  assert.match((await encerrou).motivo, /saiu|conexão/);
});

test('falha do banco não deixa a sala presa ao iniciar', { timeout: 12000 }, async t => {
  const a = await ambiente(t, async () => { throw Object.assign(Error('indisponível'), { code: 'TEST_DB_OFFLINE' }); });
  const host = await a.cliente(), amigo = await a.cliente();
  const r = await pedir(host, 'sala:criar', { modo: 'multiplayer', nome: 'A' });
  await pedir(amigo, 'sala:entrar', { modo: 'multiplayer', codigo: r.sala.codigo, nome: 'B' });
  host.emit('sala:pronto', true); amigo.emit('sala:pronto', true);
  await pedir(amigo, 'partida:iniciar', {});
  assert((await pedir(host, 'partida:iniciar', {})).erro);
  assert((await pedir(host, 'partida:iniciar', {})).erro);
});
