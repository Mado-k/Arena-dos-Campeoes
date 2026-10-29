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
    const todas = p.estado.jogadores.flatMap(j => [...j.mao, ...j.baralho]);
    const c = todas.find(c => c.base.codigo === codigo);
    for (const dono of p.estado.jogadores) { dono.mao = dono.mao.filter(x => x !== c); dono.baralho = dono.baralho.filter(x => x !== c); }
    return c;
  };
  const campeao = selecionar('n013'), arma = selecionar('n006');
  j.campo = [campeao]; campeao.equip = [arma];
  assert.equal(p.visao('p0').jogadores[0].campo[0].equip[0].habilidade.tipo, 'ativa');
  const busca = selecionar('n035'); j.campo = [busca];
  const opcoesBusca=[selecionar('n012'),selecionar('n018')];j.baralho.push(...opcoesBusca);
  const antes = structuredClone(p.estado);
  const res = p.agir('p0', { tipo: 'habilidade', uid: busca.uid, revisao: 0 });
  assert(res.pergunta);
  assert.deepEqual(p.estado, antes);
  assert(p.agir('p0', { tipo: 'habilidade', uid: busca.uid, escolha: res.pergunta.opcoes[0].valor, revisao: 0 }).ok);
  assert.equal(p.estado.acoes, 1);
  assert.equal(motor.HAB.D007.tipo, 'passiva');
  assert.notEqual(motor.HAB.D007.semEfeito, true);
});

test('co-op mantém o turno e a mão de cada humano e executa o turno da máquina', () => {
  const p = new Partida(jogadores, cartas, 'coop');
  assert.equal(p.visao('p0').voce, 0);
  assert.equal(p.visao('p1').voce, 1);
  assert(p.agir('p1', { tipo: 'comprar', revisao: 0 }).erro);
  assert(p.agir('p0', { tipo: 'comprar', revisao: 0 }).ok);
  assert(p.agir('p0', { tipo: 'encerrar', revisao: 1 }).ok);
  p.jogarComputador();
  assert.equal(p.estado.turno, 1);
  assert(p.agir('p1', { tipo: 'encerrar', revisao: p.revisao }).ok);
  p.jogarComputador();
  assert.equal(p.estado.turno, 0);
  assert.equal(p.estado.numTurno, 5);
  assert.equal(p.estado.acoes, 2);
  assert.equal(p.visao('p0').jogadores[1].mao.length, 0);
  assert.equal(p.visao('p1').jogadores[0].mao.length, 0);
});

test('partidas online completas mantêm cartas, limites e bloqueiam ações após a vitória', () => {
  const Motor = require('../public/motor');
  const campeoes = Array.from({ length: 40 }, (_, i) => ({ codigo: 'teste' + i, nome: 'Campeão ' + i, classe: 'campeão', ataque: 10, defesa: 1 }));
  for (const modo of ['multiplayer', 'coop']) {
    const p = new Partida(jogadores, campeoes, modo);
    const quantidades = p.estado.jogadores.map(j => j.mao.length + j.baralho.length);
    for (let turno = 0; turno < 600 && p.estado.vencedor === null; turno++) {
      for (let passo = 0; passo < 2 && p.estado.vencedor === null; passo++) {
        const j = p.estado.jogadores[p.estado.turno];
        const id = p.ids[p.estado.turno];
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
          if (r.ok) { p.jogarComputador(); break; }
        }
      }
      if (p.estado.vencedor === null) {
        assert(p.agir(p.ids[p.estado.turno], { tipo: 'encerrar', revisao: p.revisao }).ok);
        p.jogarComputador();
      }
      for (const [indice, j] of p.estado.jogadores.entries()) {
        const todas = [...j.mao, ...j.baralho, ...j.campo, ...j.apoio, ...j.descarte];
        const ids = todas.flatMap(c => [c.uid, ...c.equip.map(e => e.uid)]);
        assert.equal(ids.length, quantidades[indice]); assert.equal(new Set(ids).size, quantidades[indice]);
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
  assert.equal(banco.configuracao({ DB_HOST: 'jogo.aivencloud.com' }).ssl.rejectUnauthorized, true);
  assert.equal(banco.configuracao({ DB_CA_CERT: 'CA\\nCERT' }).ssl.ca, 'CA\nCERT');
  assert.deepEqual(require('../db').configBanco().ssl, banco.configuracao().ssl);
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
  assert.equal(obter('localhost', '3000'), '');
  assert.equal(obter('localhost', '5500'), 'http://localhost:3000');
  assert.equal(obter('localhost', '5501'), 'http://localhost:3000');
  assert.equal(obter('arena-5501.app.github.dev', '', 'https:'), 'https://arena-3000.app.github.dev');
  assert.equal(obter('arena-5500.app.github.dev', '', 'https:'), 'https://arena-3000.app.github.dev');
  assert.equal(obter('arena-3000.app.github.dev', '', 'https:'), '');
  assert.equal(obter('mado-k.github.io', '', 'https:'), '');
  assert.equal(obter('localhost', '5500', 'http:', 'http://localhost:3000/'), 'http://localhost:3000');
});

async function ambiente(t, loader = async () => cartas, opcoes) {
  const servidor = http.createServer();
  const io = new Server(servidor);
  const controle=iniciarSalas(io, loader, opcoes);
  servidor.listen(0, '127.0.0.1'); await once(servidor, 'listening');
  const clientes = [];
  t.after(async () => { clientes.forEach(c => c.close()); await new Promise(r => io.close(r)); });
  async function cliente() {
    const c = conectar('http://127.0.0.1:' + servidor.address().port, { transports: ['websocket'], reconnection: false });
    clientes.push(c); await once(c, 'connect'); return c;
  }
  return { cliente, controle };
}
const pedir = (c, evento, dados) => new Promise((resolve, reject) => c.timeout(4000).emit(evento, dados, (e, r) => e ? reject(e) : resolve(r)));
function esperar(c, evento, condicao = () => true) { return new Promise((resolve, reject) => {
  const timer = setTimeout(() => { c.off(evento, receber); reject(Error('Sem evento: ' + evento)); }, 4000);
  function receber(d) { if(!condicao(d))return; clearTimeout(timer); c.off(evento,receber); resolve(d); }
  c.on(evento, receber);
}); }

for (const modo of ['multiplayer', 'coop']) test('Socket.IO real: ' + modo, { timeout: 12000 }, async t => {
  const a = await ambiente(t), host = await a.cliente(), convidados = [];
  const total = modo === 'coop' ? 4 : 2;
  assert((await pedir(host, 'sala:criar', { modo, nome: 'Anfitrião', tamanhoBaralho: 80 })).erro);
  const tamanhoBaralho = modo === 'coop' ? 40 : 30;
  const criado = await pedir(host, 'sala:criar', { modo, nome: 'Anfitrião', tamanhoBaralho });
  assert.equal(criado.sala.tamanhoBaralho, tamanhoBaralho);
  for (let i = 1; i < total; i++) {
    const c = await a.cliente(); convidados.push(c);
    assert((await pedir(c, 'sala:entrar', { modo, codigo: criado.sala.codigo, nome: 'Amigo ' + i })).ok);
  }
  const todos = [host, ...convidados];
  assert((await pedir(host, 'sala:representante', {})).erro);
  assert((await pedir(host, 'sala:representante', 'D007')).ok);
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
  for (const v of visoes) {
    assert.equal(v.jogadores[0].rep.codigo, 'D007');
    assert.equal(v.tamanhoBaralho, tamanhoBaralho);
    for (const time of [0, 1]) assert.equal(v.jogadores.filter(j => j.equipe === time).reduce((n, j) => n + j.maoTotal + j.baralhoTotal, 0), tamanhoBaralho / 2);
  }
  assert.equal(visoes[0].jogadores[1 - visoes[0].voce].mao.length, 0);
  assert((await pedir(host, 'sala:representante', 'D001')).erro);
  assert((await pedir(host, 'partida:revanche', true)).erro);
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
  await pedir(convidados[0],'sala:sair',null);
  assert.match((await encerrou).motivo, /abandonou/);
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

for (const caso of [
  { nome: 'banco vazio', loader: async () => [], codigo: 'CARTAS_INSUFICIENTES', mensagem: /catálogo tem 0/ },
  { nome: 'somente representantes', loader: async () => cartas.filter(c => c.classe === 'representante'), codigo: 'CARTAS_INSUFICIENTES', mensagem: /catálogo tem 0/ },
  { nome: 'certificado Aiven', loader: async () => { throw Object.assign(Error('detalhe privado'), { code: 'HANDSHAKE_SSL_ERROR' }); }, codigo: 'HANDSHAKE_SSL_ERROR', mensagem: /certificado.*Aiven/ }
]) test('início recusado mostra causa e permite tentar de novo: ' + caso.nome, { timeout: 12000 }, async t => {
  const a = await ambiente(t, caso.loader);
  const host = await a.cliente(), amigo = await a.cliente();
  const r = await pedir(host, 'sala:criar', { modo: 'multiplayer', nome: 'A' });
  await pedir(amigo, 'sala:entrar', { modo: 'multiplayer', codigo: r.sala.codigo, nome: 'B' });
  host.emit('sala:pronto', true); amigo.emit('sala:pronto', true);
  await pedir(amigo, 'partida:iniciar', {});
  for (let i = 0; i < 2; i++) {
    const res = await pedir(host, 'partida:iniciar', {});
    assert.equal(res.codigo, caso.codigo);
    assert.match(res.erro, caso.mensagem);
    assert(!res.erro.includes('detalhe privado'));
  }
});

test('consulta pendurada expira, permite nova tentativa e ignora o resultado atrasado', { timeout: 12000 }, async t => {
  let liberar, tentativas = 0;
  const atrasada = new Promise(resolve => { liberar = resolve; });
  const a = await ambiente(t, () => ++tentativas === 1 ? atrasada : Promise.resolve(cartas), { tempoCarregamento: 40 });
  const host = await a.cliente(), amigo = await a.cliente();
  const r = await pedir(host, 'sala:criar', { modo: 'multiplayer', nome: 'A' });
  await pedir(amigo, 'sala:entrar', { modo: 'multiplayer', codigo: r.sala.codigo, nome: 'B' });
  host.emit('sala:pronto', true); amigo.emit('sala:pronto', true);
  await pedir(amigo, 'partida:iniciar', {});
  const falhou = await pedir(host, 'partida:iniciar', {});
  assert.equal(falhou.codigo, 'TEMPO_CARTAS_ESGOTADO');
  const estado = esperar(host, 'partida:estado');
  assert((await pedir(host, 'partida:iniciar', {})).ok);
  const inicial = await estado;
  liberar(cartas);
  const sincronizado = esperar(host, 'partida:estado');
  host.emit('partida:sincronizar');
  assert.deepEqual(await sincronizado, inicial);
});

for(const n of [1,2,3,4]) test(`co-op automático com ${n} pessoa(s): lobby e partida têm ${n} máquina(s)`, {timeout:12000}, async t=>{
  const a=await ambiente(t),host=await a.cliente(),todos=[host];
  const criado=await pedir(host,'sala:criar',{modo:'coop',nome:'Host',tamanhoBaralho:20});
  assert.equal(criado.sala.min,1);assert.equal(criado.sala.max,4);assert.equal(criado.sala.maquinas,1);
  for(let i=1;i<n;i++){
    const pronto=esperar(host,'sala');host.emit('sala:pronto',true);await pronto;
    const c=await a.cliente();todos.push(c);
    const r=await pedir(c,'sala:entrar',{modo:'coop',nome:'Pessoa '+i,codigo:criado.sala.codigo});
    assert(r.ok);assert.equal(r.sala.maquinas,i+1);assert(r.sala.jogadores.every(j=>!j.pronto));
    assert.equal(r.sala.tamanhoBaralho,Math.max(20,(i+1)*10));
  }
  if(n===4){const extra=await a.cliente();assert((await pedir(extra,'sala:entrar',{modo:'coop',nome:'Extra',codigo:criado.sala.codigo})).erro);}
  const prontos=esperar(host,'sala');for(const c of todos)c.emit('sala:pronto',true);await prontos;
  for(const c of todos.slice(1))await pedir(c,'partida:iniciar',{});
  const estados=todos.map(c=>esperar(c,'partida:estado'));assert((await pedir(host,'partida:iniciar',{})).ok);
  for(const v of await Promise.all(estados)){
    assert.equal(v.jogadores.length,2*n);assert.equal(v.jogadores.filter(j=>j.maquina).length,n);
    assert.equal(v.tamanhoBaralho,Math.max(20,n*10));assert(v.jogadores.every(j=>j.acoesPorTurno===2));
    for(let i=0;i<2*n;i++)assert.equal(v.jogadores[i].mao.length,i===v.voce?3:0);
    assert.deepEqual(v.ordemTurnos,Array.from({length:n},(_,i)=>[i,i+n]).flat());
  }
});

test('lobby co-op reduz máquinas e ajusta para 30 cartas se a quarta pessoa sair, permitindo novo convidado', {timeout:12000}, async t=>{
  const a=await ambiente(t),host=await a.cliente(),convidados=[];
  const r=await pedir(host,'sala:criar',{modo:'coop',nome:'Host',tamanhoBaralho:20});
  for(let i=0;i<3;i++){const c=await a.cliente();convidados.push(c);await pedir(c,'sala:entrar',{modo:'coop',nome:'Pessoa '+i,codigo:r.sala.codigo});}
  const esperando=esperar(host,'sala',s=>s.jogadores.length===3);convidados[2].emit('sala:sair');const menor=await esperando;
  assert.equal(menor.maquinas,3);assert.equal(menor.jogadores.length,3);assert.equal(menor.tamanhoBaralho,30);assert(menor.jogadores.every(j=>!j.pronto));
  const novo=await a.cliente(),resp=await pedir(novo,'sala:entrar',{modo:'coop',nome:'Novo',codigo:r.sala.codigo});
  assert(resp.ok);assert.equal(resp.sala.maquinas,4);assert.equal(resp.sala.tamanhoBaralho,40);
});

for(const n of [2,3,4]) test(`lobby multiplayer com ${n} pessoas: anfitrião ajusta cartas, divisão inteira e início privado`, {timeout:12000}, async t=>{
  const a=await ambiente(t),host=await a.cliente(),todos=[host];
  const criado=await pedir(host,'sala:criar',{modo:'multiplayer',nome:'Host'}),codigo=criado.sala.codigo;
  assert.equal(criado.sala.max,4);assert.equal(criado.sala.cartasPorParticipante,20);
  assert((await pedir(host,'sala:baralho',20)).ok);
  for(let i=1;i<n;i++){
    await pedir(host,'sala:pronto',true);
    const c=await a.cliente();todos.push(c);
    const r=await pedir(c,'sala:entrar',{modo:'multiplayer',nome:'Pessoa '+i,codigo});
    assert(r.ok);assert.equal(r.sala.tamanhoBaralho,Math.ceil(20/(i+1))*(i+1));
    assert.equal(r.sala.cartasPorParticipante,r.sala.tamanhoBaralho/(i+1));
    assert(r.sala.jogadores.every(j=>!j.pronto));assert(!JSON.stringify(r.sala).includes('token'));
  }
  assert((await pedir(todos[1],'sala:baralho',30)).erro);
  assert((await pedir(host,'sala:baralho',21)).erro);
  for(const c of todos)await pedir(c,'sala:pronto',true);
  const mudou=esperar(todos[1],'sala',s=>s.tamanhoBaralhoEscolhido===30);
  const r=await pedir(host,'sala:baralho',30),publica=await mudou;
  const total=Math.ceil(30/n)*n;
  assert.equal(r.sala.tamanhoBaralho,total);assert.deepEqual(publica,r.sala);
  assert(r.sala.jogadores.every(j=>!j.pronto));
  assert((await pedir(host,'partida:iniciar',{})).erro);
  for(const c of todos)await pedir(c,'sala:pronto',true);
  const igual=await pedir(host,'sala:baralho',30);assert(igual.sala.jogadores.every(j=>j.pronto));
  const estados=todos.map(c=>esperar(c,'partida:estado'));
  assert((await pedir(host,'partida:iniciar',{})).ok);
  const visoes=await Promise.all(estados);
  for(const v of visoes){
    assert.equal(v.todosContraTodos,n>2);assert.equal(v.jogadores.length,n);assert.equal(v.tamanhoBaralho,total);
    for(let i=0;i<n;i++){assert.equal(v.jogadores[i].mao.length,i===v.voce?3:0);assert.equal(v.jogadores[i].maoTotal+v.jogadores[i].baralhoTotal,total/n);assert(!v.jogadores[i].maquina);}
  }
  assert((await pedir(host,'sala:baralho',20)).erro);
  const ativo=visoes[0].turno,alvo=require('../public/motor').adversarios(visoes[0],ativo)[0],uid=visoes[ativo].jogadores[ativo].mao[0].uid;
  // Nos grupos, a mão inicial sempre inclui um campeão. A escolha de alvo chega ao servidor.
  if(n>2)assert((await pedir(todos[ativo],'partida:acao',{tipo:'invocar',uid,alvo,revisao:0})).ok);
});

test('entradas e saídas recalculam a partir do total escolhido, sem acumular arredondamentos',{timeout:12000},async t=>{
  const a=await ambiente(t),h=await a.cliente(),b=await a.cliente(),c=await a.cliente(),d=await a.cliente();
  const r=await pedir(h,'sala:criar',{modo:'multiplayer',nome:'H',tamanhoBaralho:20}),codigo=r.sala.codigo;
  for(const [i,s] of [b,c,d].entries()){
    const sala=(await pedir(s,'sala:entrar',{modo:'multiplayer',nome:'Pessoa '+i,codigo})).sala;
    assert.equal(sala.tamanhoBaralho,[20,21,20][i]);
  }
  const extra=await a.cliente();assert((await pedir(extra,'sala:entrar',{modo:'multiplayer',nome:'Extra',codigo})).erro);
  let evento=esperar(h,'sala',s=>s.jogadores.length===3);await pedir(d,'sala:sair',null);assert.equal((await evento).tamanhoBaralho,21);
  evento=esperar(h,'sala',s=>s.jogadores.length===2);await pedir(c,'sala:sair',null);assert.equal((await evento).tamanhoBaralho,20);
});

test('catálogo insuficiente para arredondar não prende o lobby nem distribui cópias',{timeout:12000},async t=>{
  const a=await ambiente(t),h=await a.cliente(),todos=[h];
  const r=await pedir(h,'sala:criar',{modo:'multiplayer',nome:'H'});
  for(let i=1;i<3;i++){const c=await a.cliente();todos.push(c);await pedir(c,'sala:entrar',{modo:'multiplayer',nome:'Pessoa '+i,codigo:r.sala.codigo});}
  for(const c of todos)await pedir(c,'sala:pronto',true);
  const falha=await pedir(h,'partida:iniciar',{});assert.equal(falha.codigo,'CARTAS_INSUFICIENTES');assert.match(falha.erro,/42/);
  const novo=await pedir(h,'sala:baralho',20);assert.equal(novo.sala.tamanhoBaralho,21);assert(!novo.sala.iniciando);assert(!novo.sala.emPartida);
  for(const c of todos)await pedir(c,'sala:pronto',true);
  assert((await pedir(h,'partida:iniciar',{})).ok);
});

test('2v2 online exige quatro pessoas, define duplas no lobby e valida os alvos no servidor',{timeout:12000},async t=>{
 const a=await ambiente(t),todos=[];for(let i=0;i<4;i++)todos.push(await a.cliente());
 const r=await pedir(todos[0],'sala:criar',{modo:'multiplayer',nome:'Pessoa 0',tamanhoBaralho:20}),codigo=r.sala.codigo;
 const f=await pedir(todos[0],'sala:formato','2v2');assert.equal(f.sala.min,4);assert.equal(f.sala.formato,'2v2');
 for(let i=1;i<4;i++)await pedir(todos[i],'sala:entrar',{modo:'multiplayer',nome:'Pessoa '+i,codigo});
 assert((await pedir(todos[1],'sala:formato','livre')).erro);assert((await pedir(todos[0],'sala:formato','invalido')).erro);
 for(const c of todos)await pedir(c,'sala:pronto',true);
 const estados=todos.map(c=>esperar(c,'partida:estado'));assert((await pedir(todos[0],'partida:iniciar',{})).ok);
 const vs=await Promise.all(estados);assert(vs.every(v=>v.equipes2v2&&v.cooperativo));assert.deepEqual(vs[0].equipes,[0,1,0,1]);
 const ativo=vs[0].turno;assert((await pedir(todos[ativo],'partida:acao',{tipo:'comprar',alvo:(ativo+2)%4,revisao:0})).erro);
 assert((await pedir(todos[ativo],'partida:acao',{tipo:'comprar',alvo:(ativo+1)%4,revisao:0})).ok);
 assert((await pedir(todos[0],'sala:formato','livre')).erro);
});

test('eliminados podem sair ou desconectar sem encerrar nem pausar a final online',{timeout:12000},async t=>{
 const catalogo=Array.from({length:40},(_,i)=>({codigo:'final'+i,nome:'Campeão '+i,classe:'campeão',ataque:100,defesa:1}));
 const a=await ambiente(t,async()=>catalogo),todos=[];for(let i=0;i<4;i++)todos.push(await a.cliente());
 const r=await pedir(todos[0],'sala:criar',{modo:'multiplayer',nome:'Pessoa 0',tamanhoBaralho:20}),codigo=r.sala.codigo;
 for(let i=1;i<4;i++)await pedir(todos[i],'sala:entrar',{modo:'multiplayer',nome:'Pessoa '+i,codigo});
 for(const c of todos)await pedir(c,'sala:pronto',true);
 assert((await pedir(todos[0],'partida:iniciar',{})).ok);
 const sala=a.controle.salas.get(codigo);
 for(const[origem,alvo]of[[0,2],[1,3]]){
  const p=sala.partida;p.estado.turno=origem;p.estado.acoes=2;
  for(const i of[origem,alvo]){const j=p.estado.jogadores[i];j.campo=[j.mao.shift()];j.campo[0].ataqueBase=i===origem?100:0;}
  p.estado.jogadores[alvo].derrotados=2;
  assert((await pedir(todos[origem],'partida:acao',{tipo:'atacar',alvo,revisao:p.revisao})).ok);
 }
 assert.equal(sala.partida.estado.torneio.rodada,2);
 const salvo=sala.partida.salvar();
 assert((await pedir(todos[2],'sala:sair',null)).ok);assert(sala.partida);assert.deepEqual(sala.partida.salvar(),salvo);
 const pausa=esperar(todos[0],'partida:pausa');todos[3].close();assert.equal((await pausa).pausada,false);
 const quem=sala.partida.estado.turno;
 // O próximo jogador ativo consegue encerrar normalmente com os dois perdedores ausentes.
 assert((await pedir(todos[quem],'partida:acao',{tipo:'encerrar',alvo:quem===0?1:0,revisao:sala.partida.revisao})).ok);
 const v=sala.partida.visao(todos[1].id);assert.equal(v.jogadores[0].mao.length,0);
 const pausou=esperar(todos[1],'partida:pausa',d=>d.pausada);todos[0].close();assert((await pausou).pausada);
});
