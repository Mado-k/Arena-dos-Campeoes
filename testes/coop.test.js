const { test } = require('node:test');
const assert = require('node:assert/strict');
const Partida = require('../partida');
const Motor = require('../public/motor');
const cartas = Array.from({ length: 40 }, (_, i) => ({ codigo: 'teste' + i, nome: 'Carta ' + i, classe: 'campeão', ataque: 3, defesa: 20 }));
const criar = (quantidade, total = 40) => new Partida(Array.from({ length: quantidade }, (_, i) => ({ id: 'p' + i, nome: 'Pessoa ' + i })), cartas, 'coop', total);
const todas = j => [...j.baralho, ...j.mao, ...j.campo, ...j.apoio, ...j.descarte].flatMap(c => [c, ...c.equip]);
function emCampo(p, i, { ataque = 3, defesa = 20, codigo } = {}) {
  const j = p.estado.jogadores[i], c = j.mao.shift();
  c.ataqueBase = ataque; c.defesa = c.defesaMax = defesa;
  if (codigo) c.base.codigo = codigo;
  j.campo = [c]; return c;
}
const acao = (p, i, dados) => p.agir('p' + i, { ...dados, revisao: p.revisao });

for (const n of [1,2,3,4]) for (const pedido of [20,30,40]) test(`${n} humanos, ${n} máquinas e total solicitado ${pedido}, com cartas únicas e mãos privadas`, () => {
  const total = n === 4 && pedido === 20 ? 30 : pedido;
  const p = criar(n, pedido), e = p.estado;
  assert.equal(e.tamanhoBaralho,total);
  assert.equal(e.jogadores.length, 2 * n);
  assert.equal(e.jogadores.filter(j => j.maquina).length, n);
  assert.equal(new Set(e.jogadores.flatMap(todas).map(c => c.base.codigo)).size, total);
  for (const equipe of [0, 1]) assert.equal(e.jogadores.filter(j => j.equipe === equipe).reduce((t, j) => t + todas(j).length, 0), total / 2);
  for (let i = 0; i < n; i++) {
    const v = p.visao('p' + i);
    assert.equal(v.voce, i);
    for (let k = 0; k < e.jogadores.length; k++) {
      assert.equal(v.jogadores[k].mao.length, i === k ? 3 : 0);
      assert.equal(v.jogadores[k].baralho, undefined);
    }
  }
});

test('co-op aceita de uma a quatro pessoas e ajusta 20 para 30 cartas com quatro', () => {
  assert.equal(criar(4,20).estado.tamanhoBaralho,30);
  assert.throws(() => criar(0), /um a quatro/);
  assert.throws(() => criar(5), /um a quatro/);
});

test('a mão inicial do co-op inclui um campeão sem duplicar cartas', () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const contexto = { window: {} };
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../public/cartas-offline.js'), 'utf8'), contexto);
  const catalogo = JSON.parse(JSON.stringify(contexto.window.CARTAS_OFFLINE));
  for (const n of [1, 2, 3, 4]) for (let tentativa = 0; tentativa < 20; tentativa++) {
    const p = new Partida(Array.from({ length: n }, (_, i) => ({ id: 'p' + i, nome: 'Pessoa ' + i })), catalogo, 'coop', 40);
    assert(p.estado.jogadores.every(j => j.mao.length === 3 && j.mao.some(Motor.ehCampeao)));
    assert.equal(new Set(p.estado.jogadores.flatMap(todas).map(c => c.base.codigo)).size, 40);
  }
});

test('mãos de aliados e máquinas, baralhos e logs internos não vazam na visão', () => {
  const p = criar(4);
  p.estado.log.push('SEGREDO INTERNO');
  for (let i = 0; i < p.estado.jogadores.length; i++) {
    p.estado.jogadores[i].mao[0].base.nome = 'SEGREDO DA MÃO ' + i;
    p.estado.jogadores[i].baralho[0].base.nome = 'SEGREDO DO BARALHO ' + i;
  }
  const json = JSON.stringify(p.visao('p0'));
  assert(json.includes('SEGREDO DA MÃO 0'));
  for (let i = 1; i < 8; i++) assert(!json.includes('SEGREDO DA MÃO ' + i));
  assert(!json.includes('SEGREDO DO BARALHO'));
  assert(!json.includes('SEGREDO INTERNO'));
});

test('cada jogador só usa sua mão no próprio turno; não pode atacar aliado', () => {
  const p = criar(4), antes = structuredClone(p.estado);
  assert(acao(p, 1, { tipo: 'comprar' }).erro);
  assert(acao(p, 0, { tipo: 'invocar', uid: p.estado.jogadores[1].mao[0].uid }).erro);
  assert(acao(p, 0, { tipo: 'atacar', alvo: 1 }).erro);
  assert(acao(p, 0, { tipo: 'comprar', alvo: 99 }).erro);
  assert.deepEqual(p.estado, antes);
  assert(acao(p, 0, { tipo: 'comprar' }).ok);
  assert.equal(p.estado.acoes, 1);
  assert.equal(p.estado.jogadores[1].mao.length, 3);
});

test('ataque escolhido alcança a segunda máquina e os aliados permanecem intactos', () => {
  const p = criar(4);
  emCampo(p, 0); emCampo(p, 1); const primeira = emCampo(p, 4), segunda = emCampo(p, 5);
  assert(acao(p, 0, { tipo: 'atacar', alvo: 5 }).ok);
  assert.equal(p.estado.jogadores[4].campo[0].defesa, primeira.defesa);
  assert.equal(p.estado.jogadores[4].campo[0].defesa, 20);
  assert.equal(p.estado.jogadores[5].campo[0].defesa, segunda.defesa - 3);
  assert.equal(p.estado.jogadores[1].campo[0].defesa, 20);
  for (let i = 0; i < 4; i++) assert.match(p.visao('p' + i).log.at(-1), /3 de dano.*Contra-ataque: 3 de dano.*Defesa restante/);
});

test('habilidade ofensiva também respeita a máquina selecionada', () => {
  const p = criar(4);
  const ativa = emCampo(p, 0, { codigo: 'n040' });
  emCampo(p, 4); const alvo = emCampo(p, 5);
  assert(acao(p, 0, { tipo: 'habilidade', uid: ativa.uid, alvo: 5 }).ok);
  assert.equal(p.estado.jogadores[4].campo.length, 1);
  assert.equal(p.estado.jogadores[5].campo.length, 0);
  assert(p.estado.jogadores[5].descarte.some(c => c.uid === alvo.uid));
  assert.equal(p.estado.acoes, 1);
});

for (const n of [1, 2, 3, 4]) test(`ordem e orçamento de ações corretos com ${n} humanos`, () => {
  const p = criar(n);
  const recebidos = [];
  for (let i = 0; i < n; i++) {
    assert.equal(p.estado.turno, i);
    recebidos.push(i);
    assert.equal(p.estado.acoes, 2);
    assert(acao(p, i, { tipo: 'encerrar' }).ok);
    assert.equal(p.estado.turno,n+i);
    assert(p.estado.jogadores[p.estado.turno].maquina);
    assert.equal(p.estado.acoes,2);
    p.jogarComputador();
  }
  assert.equal(p.estado.turno, 0);
  assert.equal(p.estado.numTurno, 2 * n + 1);
  assert.deepEqual(recebidos, Array.from({ length: n }, (_, i) => i));
});

test('eliminar um humano não encerra a equipe e seus turnos são pulados', () => {
  const p = criar(2); emCampo(p, 0, { ataque: 1, defesa: 1 }); emCampo(p, 2, { ataque: 10 });
  p.estado.jogadores[0].derrotados = 2;
  assert(acao(p, 0, { tipo: 'atacar', alvo: 2 }).ok);
  assert.equal(p.estado.jogadores[0].eliminado, true);
  assert.equal(p.estado.vencedor, null);
  assert.equal(p.estado.turno,2);p.jogarComputador();assert.equal(p.estado.turno,1);
  assert(acao(p, 0, { tipo: 'comprar' }).erro);
  assert(acao(p, 1, { tipo: 'encerrar' }).ok);
  p.jogarComputador();
  assert.equal(p.estado.turno, 1);
});

test('eliminação por dano no início do turno avança até um participante ativo', () => {
  const p = criar(4); emCampo(p, 1, { defesa: 1 });
  p.estado.jogadores[1].derrotados = 2; p.estado.pandora = true;
  p.estado.turno=4;
  assert(Motor.encerrarTurno(p.estado).ok);
  assert.equal(p.estado.jogadores[1].eliminado, true);
  assert.equal(p.estado.turno,5);
  p.jogarComputador();
  assert.equal(p.estado.turno, 2);
  assert.equal(p.estado.acoes, 2);
});

test('uma máquina eliminada sai dos alvos; vitória exige eliminar todas', () => {
  const p = criar(2); emCampo(p, 0, { ataque: 30 }); emCampo(p, 2, { defesa: 1 }); emCampo(p, 3, { defesa: 1 });
  p.estado.jogadores[2].derrotados = 2; p.estado.jogadores[3].derrotados = 2;
  assert(acao(p, 0, { tipo: 'atacar', alvo: 2 }).ok);
  assert.equal(p.estado.vencedor, null); assert.equal(p.estado.jogadores[2].eliminado, true);
  assert(acao(p, 0, { tipo: 'atacar', alvo: 2 }).erro);
  assert(acao(p, 0, { tipo: 'atacar', alvo: 3 }).ok);
  assert.equal(p.estado.vencedor, 0);
  assert(acao(p, 0, { tipo: 'comprar' }).erro);
});

test('a derrota da equipe só ocorre quando o último humano perde três campeões', () => {
  const p = criar(2); emCampo(p, 0, { ataque: 1, defesa: 1 }); emCampo(p, 1, { ataque: 1, defesa: 1 }); emCampo(p, 2, { ataque: 30 });
  p.estado.jogadores[0].derrotados = 2; p.estado.jogadores[1].derrotados = 2;
  p.estado.turno = 2; p.estado.acoes = 2;
  p.jogarComputador();
  assert.equal(p.estado.vencedor, 1);
  assert(p.estado.jogadores.slice(0, 2).every(j => j.eliminado));
});

test('Iara e Pandora alcançam os adversários corretos no tabuleiro de oito participantes', () => {
  const p = criar(4);
  const humano = emCampo(p, 0); humano.base.universo = 'game';
  const aliado = emCampo(p, 1, { codigo: 'n012' });
  assert.equal(Motor.silenciada(p.estado, humano), null);
  const maquina = emCampo(p, 5, { codigo: 'n012' });
  assert.match(Motor.silenciada(p.estado, humano), /anula/);
  assert.equal(Motor.silenciada(p.estado, aliado), null);
  p.estado.pandora = true;
  const defesa = maquina.defesa;
  p.estado.turno = 1;
  Motor.encerrarTurno(p.estado);
  assert.equal(p.estado.turno, 5); assert.equal(maquina.defesa, defesa - 10);
});

test('simulações com cartas reais preservam propriedade, unicidade e ações de um a quatro jogadores', { timeout: 60000 }, () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const contexto = { window: {} };
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../public/cartas-offline.js'), 'utf8'), contexto);
  const catalogo = JSON.parse(JSON.stringify(contexto.window.CARTAS_OFFLINE));
  const resumo = { partidas: 0, concluidas: 0, atingiramLimite: 0 };
  for (const n of [1, 2, 3, 4]) for (let rodada = 0; rodada < 4; rodada++) {
    const p = new Partida(Array.from({ length: n }, (_, i) => ({ id: 'p' + i, nome: 'Humano ' + i })), catalogo, 'coop');
    for (let turno = 0; turno < 120 && p.estado.vencedor === null; turno++) {
      const indice = p.estado.turno;
      assert(!p.estado.jogadores[indice].maquina && !p.estado.jogadores[indice].eliminado);
      for (let passo = 0; passo < 2 && p.estado.turno === indice && p.estado.vencedor === null; passo++) {
        const j = p.estado.jogadores[indice];
        const pedidos = [{ tipo: 'atacar' }, { tipo: 'comprar' }];
        for (const c of [...j.mao, ...j.campo, ...j.apoio, ...j.campo.flatMap(c => c.equip)]) {
          pedidos.push({ tipo: 'habilidade', uid: c.uid });
          if (j.mao.includes(c)) pedidos.push({ tipo: Motor.ehCriatura(c) ? 'invocar' : Motor.classeDe(c) === 'auxiliar' ? 'apoio' : 'equipar', uid: c.uid });
        }
        // Semente fixa por cenário para reproduzir os mesmos pedidos humanos.
        let achou = false;
        const inicio = (rodada * 13 + turno * 7 + passo * 3) % pedidos.length;
        for (let k = 0; k < pedidos.length; k++) {
          const dados = pedidos[(inicio + k) % pedidos.length];
          const alvo = Motor.adversarios(p.estado)[(turno + rodada) % Motor.adversarios(p.estado).length];
          let r = acao(p, indice, { ...dados, alvo });
          for(let pergunta=0;r.pergunta && pergunta<8;pergunta++) r = acao(p, indice, { ...dados, alvo, escolha: r.pergunta.opcoes[0].valor });
          if (r.ok) { achou = true; p.jogarComputador(); break; }
        }
        if (!achou) break;
      }
      if (p.estado.vencedor === null && p.estado.turno === indice) {
        assert(acao(p, indice, { tipo: 'encerrar' }).ok); p.jogarComputador();
      }
      const conjunto = p.estado.jogadores.flatMap(todas);
      assert.equal(conjunto.length, 40);
      assert.equal(new Set(conjunto.map(c => c.uid)).size, 40);
      assert.equal(new Set(conjunto.map(c => c.base.codigo)).size, 40);
      p.estado.jogadores.forEach((j, i) => {
        assert(j.campo.length <= 1 && j.apoio.length <= 2);
      });
      assert(p.estado.acoes >= 0 && p.estado.acoes <= 2);
    }
    resumo.partidas++;
    if (p.estado.vencedor === null) resumo.atingiramLimite++; else resumo.concluidas++;
  }
  console.log('Simulações co-op:', resumo);
});

test('até quatro máquinas consecutivas são processadas após eliminar os demais humanos', () => {
  const p=criar(4);
  for(const j of p.estado.jogadores.slice(1,4)){j.derrotados=3;j.eliminado=true;}
  p.estado.turno=4;p.estado.acoes=2;
  p.jogarComputador();
  assert.equal(p.estado.vencedor,null);assert.equal(p.estado.turno,0);assert.equal(p.estado.numTurno,5);
  for(const j of p.estado.jogadores.slice(4))assert.equal(j.campo.length,1);
});
