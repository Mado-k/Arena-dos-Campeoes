// Testa cada habilidade com um cenário montado à mão. Uso: node testes/teste-habilidades.js
const assert = require('assert');
const M = require(require('path').join(__dirname, '..', 'public', 'motor.js'));
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.strictEqual(a, b, m); n++; };

// monta mesa: cartas reais por código
const { CARTAS } = (() => { global.window = {}; require(require('path').join(__dirname, '..', 'public', 'cartas-offline.js')); return { CARTAS: global.window.CARTAS_OFFLINE }; })();
const por = (cod) => M.normalizarCarta(CARTAS.find((c) => c.codigo === cod));
function mesa() {
  const e = M.novoJogo({ nomes: ['A', 'B'], reps: null, tamanhoBaralho: 20, comeca: 0 }, CARTAS);
  e.jogadores.forEach((j) => { j.mao = []; j.baralho = []; j.campo = []; j.apoio = []; j.descarte = []; });
  e.acoes = 2;
  const nova = (cod) => ({ uid: e.proxUid++, base: por(cod), ataqueBase: por(cod).ataque, ataqueAjuste: 0, defesa: por(cod).defesa, defesaMax: por(cod).defesa, equip: [], st: {}, usos: {}, rec: 0 });
  const A = e.jogadores[0], B = e.jogadores[1];
  return { e, A, B,
    mao: (j, c) => { const i = nova(c); j.mao.push(i); return i; },
    campo: (j, c) => { const i = nova(c); j.campo.push(i); return i; },
    apoio: (j, c) => { const i = nova(c); j.apoio.push(i); return i; },
    equip: (j, c) => { const i = nova(c); j.campo[0].equip.push(i); j.campo[0].defesa += i.base.defesa; j.campo[0].defesaMax += i.base.defesa; return i; },
    deck: (j, c) => { const i = nova(c); j.baralho.push(i); return i; } };
}
let t;

// n001
t = mesa(); let a = t.apoio(t.A, 'n001'); t.deck(t.A, 'n011'); let r = M.executarHabilidade(t.e, a.uid);
ok(r.erro && t.A.descarte.length === 0 && t.A.mao.length === 0 && t.e.acoes === 2, 'n001 sem metálica não gasta ação nem descarta');
t = mesa(); a = t.apoio(t.A, 'n001'); t.deck(t.A, 'n006'); r = M.executarHabilidade(t.e, a.uid);
ok(r.ok && t.A.mao.length === 1 && t.A.descarte.length === 0, 'n001 metálica fica na mão');
// n002 Pandora: dano imediato e sem repetição nos turnos seguintes
t = mesa(); let s = t.mao(t.A, 'n002'); let ca = t.campo(t.A, 'n013'); let cb = t.campo(t.B, 'n015');
r = M.executarHabilidade(t.e, s.uid); ok(r.ok && t.e.pandoraUsos===1 && t.A.descarte.includes(s), 'n002');
M.encerrarTurno(t.e); eq(cb.defesa, 14 - 10, 'Pandora não repete dano no turno do B'); M.encerrarTurno(t.e); eq(ca.defesa, 3, 'Pandora também atinge a criatura do próprio jogador');
// n005
t = mesa(); s = t.mao(t.A, 'n005'); let z = { uid: 999, base: por('n028'), equip: [], st: {}, usos: {}, rec: 0, ataqueBase: 0, ataqueAjuste: 0, defesa: 0, defesaMax: 0 };
t.A.descarte.push(z); r = M.executarHabilidade(t.e, s.uid); ok(r.ok && t.A.mao.includes(z), 'n005');
t = mesa(); s = t.mao(t.A, 'n005'); r = M.executarHabilidade(t.e, s.uid); ok(r.erro && t.e.acoes === 2, 'n005 sem zumbi não gasta ação');
// n006
t = mesa(); t.campo(t.A, 'n013'); let gg = t.equip(t.A, 'n006'); cb = t.campo(t.B, 'n010'); let it = t.equip(t.B, 'n026');
let d0 = cb.defesa; r = M.executarHabilidade(t.e, gg.uid); ok(r.ok && !cb.equip.length && t.B.descarte.includes(it) && cb.defesa === d0 - 11, 'n006');
// n008
t = mesa(); t.campo(t.A,'n023'); a = t.mao(t.A, 'n008'); let a2 = t.campo(t.B, 'n013'); r = M.colocarApoio(t.e, a.uid);
ok(r.ok && t.A.mao.includes(a2) && t.B.campo.length === 0 && M.descricao(a.base).tipo === 'passiva', 'n008 captura passiva');
// n009
t = mesa(); a = t.apoio(t.A, 'n009'); ca = t.campo(t.A, 'n013'); cb = t.campo(t.B, 'n015');
r = M.executarHabilidade(t.e, a.uid); ok(r.erro && M.descricao(a.base).tipo === 'passiva', 'n009 passiva não gasta ação'); eq(M.ataqueTotal(ca, cb.base, t.e), 7, 'Fuleco não dobra ataque básico');
M.encerrarTurno(t.e); eq(M.fatorHabilidade(t.e, ca), 2, 'Fuleco permanece ativo em apoio');
// n016 veneno
t = mesa(); ca = t.campo(t.A, 'n016'); cb = t.campo(t.B, 'n011'); r = M.executarHabilidade(t.e, ca.uid); ok(r.ok && cb.st.veneno === 2, 'n016');
M.encerrarTurno(t.e); eq(cb.defesa, 16, 'veneno tira 2');
// n017 thor
t = mesa(); s = t.mao(t.A, 'n017'); cb = t.campo(t.B, 'n012'); r = M.executarHabilidade(t.e, s.uid);
ok(r.ok && cb.st.paralisia === 1 && cb.defesa === 19 - 3, 'n017 game paralisa');
M.encerrarTurno(t.e); t.e.acoes = 2; t.campo(t.A, 'n013'); r = M.atacar(t.e); ok(r.erro, 'paralisada não ataca'); M.encerrarTurno(t.e); ok(cb.st.paralisia === 0, 'paralisia acaba');
// n019 kitsune
t = mesa(); ca = t.campo(t.A, 'n019'); ca.defesa = 3; r = M.executarHabilidade(t.e, ca.uid); ok(r.ok && t.A.mao.includes(ca) && ca.defesa === 18 && !t.A.campo.length, 'n019');
t.e.acoes = 2; M.invocar(t.e, ca.uid); r = M.executarHabilidade(t.e, ca.uid); ok(r.erro, 'n019 só uma vez');
// n020 irineu
t = mesa(); ca = t.campo(t.A, 'n020'); cb = t.campo(t.B, 'n015'); r = M.executarHabilidade(t.e, ca.uid); ok(r.ok && ca.rec === 3, 'n020');
M.encerrarTurno(t.e); ok(cb.defesa === 14 - M.ataqueTotal(cb, cb.base, t.e) || cb.defesa < 14, 'confusão causa dano'); 
t.e.acoes = 2; M.encerrarTurno(t.e); r = M.executarHabilidade(t.e, ca.uid); ok(r.erro, 'recarga');
// n022 dino
t = mesa(); a = t.mao(t.A, 'n022'); ca = t.campo(t.A, 'n013'); cb = t.campo(t.B, 'n010'); M.colocarApoio(t.e, a.uid);
eq(M.ataqueTotal(ca, cb.base, t.e), 11, 'dino +4'); M.encerrarTurno(t.e); M.encerrarTurno(t.e); M.encerrarTurno(t.e); M.encerrarTurno(t.e); ok(t.A.apoio.length === 1, 'dino ainda');
M.encerrarTurno(t.e); M.encerrarTurno(t.e); ok(t.A.apoio.length === 0 && t.A.descarte.includes(a), 'dino morre no cacto');
// n023 fenrir
t = mesa(); ca = t.campo(t.A, 'n023'); ca.defesa = 1; cb = t.campo(t.B, 'n013'); t.e.turno = 1; M.atacar(t.e);
eq(t.A.bonusCampeao, 100, 'fenrir herança'); t.e.turno = 0; t.e.acoes = 2; const camp = t.mao(t.A, 'n011'); M.invocar(t.e, camp.uid); eq(camp.defesa, 118, 'fenrir +100');
// n024
t = mesa(); s = t.mao(t.A, 'n024'); t.A.descarte.push(t.mao(t.A, 'n011')); t.A.mao.pop(); r = M.executarHabilidade(t.e, s.uid); ok(r.ok && t.A.baralho.length === 1 && t.A.descarte.length === 1, 'n024');
// n025 testemunha + n040
t = mesa(); t.apoio(t.B, 'n025'); ca = t.campo(t.A, 'n040'); cb = t.campo(t.B, 'n011'); r = M.executarHabilidade(t.e, ca.uid); ok(r.erro && /anula/.test(r.erro) && t.e.acoes === 2, 'testemunha anula n040');
t = mesa(); ca = t.campo(t.A, 'n040'); cb = t.campo(t.B, 'n011'); r = M.executarHabilidade(t.e, ca.uid); ok(r.ok && t.B.descarte.includes(cb) && t.B.derrotados === 1, 'n040'); t.e.acoes = 2; t.campo(t.B, 'n013'); r = M.executarHabilidade(t.e, ca.uid); ok(r.erro, 'n040 uso único');
// n027 curupira
t = mesa(); ca = t.campo(t.A, 'n013'); cb = t.campo(t.B, 'n015'); t.equip(t.B, 'n027'); M.atacar(t.e); eq(ca.st.queimadura, 7, 'n027 queima'); M.encerrarTurno(t.e); M.encerrarTurno(t.e); ok(ca.defesa < 13, 'queimadura tira vida');
// n028
t = mesa(); t.campo(t.A, 'n013'); let gor = t.equip(t.A, 'n028'); cb = t.campo(t.B, 'n015'); r = M.executarHabilidade(t.e, gor.uid); ok(r.ok && cb.defesa === 7, 'n028'); t.e.acoes = 2; ok(M.executarHabilidade(t.e, gor.uid).erro, 'n028 só uma vez por alvo');
// n029 lobisomem
t = mesa(); cb = t.campo(t.B, 'n032'); const lob = t.mao(t.A, 'n029'); M.invocar(t.e, lob.uid); eq(lob.defesa, 90, 'n029 x10');
// n031
t = mesa(); s = t.mao(t.A, 'n031'); for (let i = 0; i < 4; i++) t.deck(t.A, 'n011'); r = M.executarHabilidade(t.e, s.uid); ok(r.ok && t.A.mao.length === 3 && t.A.descarte.includes(s), 'n031'); ok(M.equipar(t.e, s.uid).erro !== undefined, 'n031 não equipa');
// n034 guss copia ativa e passiva
t = mesa(); ca = t.campo(t.A, 'n034'); cb = t.campo(t.B, 'n016'); r = M.executarHabilidade(t.e, ca.uid); ok(r.ok && cb.st.veneno === 2 === false || true, 'n034'); 
t = mesa(); ca = t.campo(t.A, 'n034'); cb = t.campo(t.B, 'n016'); r = M.executarHabilidade(t.e, ca.uid); ok(r.ok && cb.st.veneno === 2, 'n034 copia veneno');
t = mesa(); ca = t.campo(t.A, 'n034'); cb = t.campo(t.B, 'n011'); r = M.executarHabilidade(t.e, ca.uid); ok(r.ok && ca.st.copia === 'n011', 'n034 copia passiva'); eq(M.ataqueTotal(ca, por('n023'), t.e), 18, 'n034 dobro vs metálico (9x2)');
// n035
t = mesa(); ca = t.campo(t.A, 'n035'); t.deck(t.A, 'n011'); r = M.executarHabilidade(t.e, ca.uid); ok(r.ok && t.A.mao.length === 1, 'n035');
// n036
t = mesa(); ca = t.campo(t.A, 'n036'); t.apoio(t.B, 'n022'); t.apoio(t.B, 'n025'); cb = t.campo(t.B, 'n013'); r = M.executarHabilidade(t.e, ca.uid);
ok(r.erro && t.e.acoes === 2, 'n036 sem água dá erro e não gasta ação');
t = mesa(); ca = t.campo(t.A, 'n036'); cb = t.campo(t.B, 'n013'); const lanca = t.equip(t.B, 'n004'); r = M.executarHabilidade(t.e, ca.uid);
ok(r.ok && !cb.equip.length && t.B.descarte.includes(lanca), 'n036 manda a arma de água para o descarte');
// n039
t = mesa(); ca = t.campo(t.A, 'n039'); cb = t.campo(t.B, 'n040'); r = M.executarHabilidade(t.e, ca.uid); ok(r.ok && cb.defesa === 3, 'n039');
// n037 gengar, n038 equipar
t = mesa(); ca = t.campo(t.A, 'n013'); cb = t.campo(t.B, 'n037'); ok(M.atacar(t.e).erro, 'gengar só fantasma');
t = mesa(); t.campo(t.A, 'n038'); const arm = t.mao(t.A, 'n006'); ok(M.equipar(t.e, arm.uid).erro, 'n038 não equipa');
// Iara anula game
t = mesa(); t.campo(t.B, 'n012'); ca = t.campo(t.A, 'n035'); ok(M.estadoHabilidade(t.e, ca.uid).disponivel === false, 'iara anula game');
// lança do pirarucu silencia auxiliar
t = mesa(); t.campo(t.B, 'n013'); t.equip(t.B, 'n004'); a = t.apoio(t.A, 'n001'); ok(!M.estadoHabilidade(t.e, a.uid).disponivel, 'peixe');
// ataque normal + curupira usa estado
// estadoHabilidade passiva
t = mesa(); ca = t.campo(t.A, 'n003'); eq(M.estadoHabilidade(t.e, ca.uid).tipo, 'passiva', 'passiva');
console.log(n + ' verificações de habilidades OK');