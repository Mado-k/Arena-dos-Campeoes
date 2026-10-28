// Joga 600 partidas aleatórias conferindo as regras a cada ação. Uso: node testes/teste-partidas-aleatorias.js
const assert = require('assert'), vm = require('vm'), fs = require('fs');
const M = require(require('path').join(__dirname, '..', 'public', 'motor.js'));
const R = M.REGRAS;
const ctx = {}; vm.runInNewContext(fs.readFileSync(require('path').join(__dirname, '..', 'public', 'cartas-offline.js'), 'utf8'), { window: ctx });
const CARTAS = ctx.CARTAS_OFFLINE;
const reps = CARTAS.filter((c) => c.classe === 'representante');
const pick = (a) => a[Math.floor(Math.random() * a.length)];
assert.ok(CARTAS.every((c) => M.HAB[c.codigo]), 'toda carta tem habilidade definida: ' + CARTAS.filter((c) => !M.HAB[c.codigo]).map((c) => c.codigo));

const todas = (j) => { const ids = []; for (const z of ['baralho', 'mao', 'campo', 'apoio', 'descarte']) for (const c of j[z]) { ids.push(c.uid); c.equip.forEach((e) => ids.push(e.uid)); } return ids; };
function conferir(e, tam) {
  e.jogadores.forEach((j) => {
    const ids = todas(j);
    assert.equal(new Set(ids).size, ids.length, 'duplicada');
    assert.equal(ids.length, tam / 2, 'sumiu/apareceu carta');
    assert.ok(j.campo.length <= R.maxCampo && j.apoio.length <= R.maxApoio);
    j.campo.forEach((c) => {
      assert.ok(c.defesa > 0, 'criatura em batalha sem defesa');
      const camp = M.ehCampeao(c), armas = c.equip.filter((x) => M.classeDe(x) === 'arma').length, itens = c.equip.filter((x) => M.classeDe(x) === 'item').length;
      if (camp) assert.ok(armas <= 1 && itens <= 1); else { assert.equal(armas, 0); assert.ok(itens <= 3); }
    });
  });
  const cartas = e.jogadores.flatMap(j => [...j.baralho, ...j.mao, ...j.campo, ...j.apoio, ...j.descarte].flatMap(c => [c, ...c.equip]));
  assert.equal(new Set(cartas.map(c => c.base.codigo)).size, tam, 'carta repetida entre jogadores');
  assert.ok(e.acoes >= 0 && e.acoes <= R.acoesPorTurno);
}
let fins = 0, turnos = 0; const usadas = {}; const erros = {};
const reg = (r) => { if (r && r.erro) erros[r.erro] = (erros[r.erro] || 0) + 1; return r; };
function habilidade(e, uid) {
  let r = M.executarHabilidade(e, uid);
  if (r.pergunta) { assert.ok(r.pergunta.opcoes.length > 1); r = M.executarHabilidade(e, uid, pick(r.pergunta.opcoes).valor); assert.ok(!r.pergunta, 'pergunta repetida'); }
  return r;
}
for (let p = 0; p < 600; p++) {
  const tam = pick([20, 30, 40]);
  const e = M.novoJogo({ nomes: ['A', 'B'], reps: [Math.random() < .3 ? pick(reps) : null, null], tamanhoBaralho: tam }, CARTAS);
  let g = 0;
  while (e.vencedor === null && g++ < 400) {
    const j = e.jogadores[e.turno];
    let n = 0;
    while (e.acoes > 0 && e.vencedor === null && n++ < 20) {
      const antes = e.acoes; const r = Math.random(); let res;
      const emJogo = [...j.campo, ...j.apoio, ...j.campo.flatMap((c) => c.equip)];
      if (r < .2) res = reg(M.comprarAcao(e));
      else if (r < .4) res = reg(M.atacar(e));
      else if (r < .6 && emJogo.length) { const c = pick(emJogo); res = reg(habilidade(e, c.uid)); if (res.ok) usadas[c.base.codigo] = (usadas[c.base.codigo] || 0) + 1; }
      else if (j.mao.length) {
        const m = pick(j.mao), cl = M.classeDe(m);
        if (M.consumivel(m)) { res = reg(habilidade(e, m.uid)); if (res.ok) usadas[m.base.codigo] = (usadas[m.base.codigo] || 0) + 1; }
        else res = reg(cl === 'campeao' || cl === 'besta' ? M.invocar(e, m.uid) : cl === 'auxiliar' ? M.colocarApoio(e, m.uid) : M.equipar(e, m.uid));
      }
      if (res && res.ok) assert.equal(e.acoes, antes - 1, 'ação custa 1');
      else if (res) assert.equal(e.acoes, antes, 'erro não gasta ação');
      conferir(e, tam);
    }
    if (e.vencedor === null) { M.encerrarTurno(e); if (e.vencedor === null) assert.equal(e.acoes, 2); conferir(e, tam); }
  }
  turnos += e.numTurno;
  if (e.vencedor !== null) { fins++; if (e.vencedor >= 0) assert.equal(e.jogadores[1 - e.vencedor].derrotados, 3); }
}
console.log({ partidas: 600, terminaram: fins, turnosMedios: Math.round(turnos / 600) });
console.log('habilidades executadas ao acaso:', Object.keys(usadas).length, 'códigos diferentes');
console.log('sem nenhuma execução:', CARTAS.filter((c) => M.HAB[c.codigo].tipo === 'ativa' && !usadas[c.codigo]).map((c) => c.codigo).join(', ') || '(nenhuma)');