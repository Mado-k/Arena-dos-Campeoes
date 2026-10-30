const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../public/motor');
const Partida = require('../partida');
const fs = require('node:fs'), vm = require('node:vm');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../public/cartas-offline.js'), 'utf8'), ctx);
const cartas = JSON.parse(JSON.stringify(ctx.window.CARTAS_OFFLINE));
function mesa() {
  const e = M.novoJogo({ nomes: ['A', 'B'], comeca: 0 }, cartas);
  const obter = (codigo, dono, zona) => {
    let c;
    for (const j of e.jogadores) for (const z of ['mao','baralho','campo','apoio','descarte']) {
      const i = j[z].findIndex(x=>x.base.codigo === codigo);
      if (i>=0) c=j[z].splice(i,1)[0];
    }
    assert(c,codigo); e.jogadores[dono][zona].push(c); return c;
  };
  return {e, obter};
}
test('001 busca a primeira metálica a partir do topo e preserva a ordem das demais', () => {
  const {e,obter}=mesa(), j=e.jogadores[0];
  obter('n013',0,'campo');
  const a=obter('n001',0,'mao'), fundo=obter('n006',0,'baralho'), topo=obter('n023',0,'baralho'), outra=obter('n011',0,'baralho');
  j.baralho=[fundo,topo,outra];
  assert(M.colocarApoio(e,a.uid).ok);
  assert(j.mao.includes(topo)); assert.deepEqual(j.baralho,[fundo,outra]); assert.equal(j.descarte.length,0);
  assert(j.apoio.includes(a));assert.equal(a.vinculo,j.campo[0].uid);assert.equal(e.acoes,1);
  assert.equal(M.estadoHabilidade(e,a.uid).tipo,'passiva');
  assert(M.executarHabilidade(e,a.uid).erro);assert.equal(e.acoes,1);
});
for(const vazio of [false,true]) test('001 sem metálica se descarta ao lançar, com baralho '+(vazio?'vazio':'não metálico'),()=>{
  const {e,obter}=mesa(),j=e.jogadores[0];obter('n013',0,'campo');
  const a=obter('n001',0,'mao'),outra=obter('n011',0,'baralho');j.baralho=vazio?[]:[outra];
  const mao=j.mao.filter(c=>c!==a);
  assert(M.colocarApoio(e,a.uid).ok);assert.deepEqual(j.mao,mao);assert(!j.apoio.includes(a));assert(j.descarte.includes(a));
  assert.deepEqual(j.baralho,vazio?[]:[outra]);assert.equal(e.acoes,1);assert.equal(a.vinculo,undefined);
});
test('001 sem criatura ou ações não é lançada nem busca cartas',()=>{
  const {e,obter}=mesa(),j=e.jogadores[0],a=obter('n001',0,'mao'),metal=obter('n006',0,'baralho');
  j.campo=[];assert(M.colocarApoio(e,a.uid).erro);assert(j.mao.includes(a));assert(j.baralho.includes(metal));assert.equal(e.acoes,2);
  obter('n013',0,'campo');e.acoes=0;assert(M.colocarApoio(e,a.uid).erro);assert(j.mao.includes(a));assert(j.baralho.includes(metal));
});
test('001 com Fuleco e só uma metálica permanece em apoio e não repete a busca em outro turno',()=>{
  const {e,obter}=mesa(),j=e.jogadores[0];obter('n013',0,'campo');obter('n009',0,'apoio');
  const a=obter('n001',0,'mao'),metal=obter('n006',0,'baralho'),outra=obter('n011',0,'baralho'),nova=obter('n023',0,'mao');j.baralho=[metal,outra];
  assert(M.colocarApoio(e,a.uid).ok);assert(j.mao.includes(metal));assert(j.apoio.includes(a));assert.deepEqual(j.baralho,[outra]);
  j.mao.splice(j.mao.indexOf(nova),1);j.baralho.push(nova);
  M.encerrarTurno(e);M.encerrarTurno(e);assert(j.baralho.includes(nova));assert(j.apoio.includes(a));
});
test('001 anulada ao entrar não busca nem se descarta ou dispara ao acabar a anulação',()=>{
  const {e,obter}=mesa(),j=e.jogadores[0];obter('n013',0,'campo');const inimigo=obter('n015',1,'campo');
  const arma=obter('n004',1,'mao');e.jogadores[1].mao=e.jogadores[1].mao.filter(c=>c!==arma);inimigo.equip=[arma];
  const a=obter('n001',0,'mao'),metal=obter('n006',0,'baralho');
  assert(M.colocarApoio(e,a.uid).ok);assert(j.apoio.includes(a));assert(j.baralho.includes(metal));assert(M.estadoHabilidade(e,a.uid).anulada);
  inimigo.equip=[];M.encerrarTurno(e);M.encerrarTurno(e);assert(j.baralho.includes(metal));assert(j.apoio.includes(a));
});
for(const modo of ['local','multiplayer','coop']) test('001 executa ao lançar pelo controlador no modo '+modo,()=>{
  const p=new Partida([{id:'a',nome:'A'},{id:'b',nome:'B'}],cartas,modo),e=p.estado,j=e.jogadores[0];e.turno=0;
  function mover(codigo,zona){let c;for(const dono of e.jogadores)for(const z of ['mao','baralho']){const k=dono[z].findIndex(x=>x.base.codigo===codigo);if(k>=0)c=dono[z].splice(k,1)[0];}assert(c);j[zona].push(c);return c;}
  mover('n013','campo');const a=mover('n001','mao'),metal=mover('n006','baralho');j.baralho=[metal];
  assert(p.agir('a',{tipo:'apoio',uid:a.uid,revisao:0}).ok);assert(p.estado.jogadores[0].mao.some(c=>c.uid===metal.uid));assert.equal(p.estado.acoes,1);
  assert.equal(p.visao('a').jogadores[0].apoio[0].base.codigo,'n001');
});
for (const codigo of ['n013','n015']) test('D007 recupera 1 de defesa da criatura no próprio turno, sem ultrapassar o máximo: '+codigo, () => {
  const {e,obter}=mesa(), j=e.jogadores[0], c=obter(codigo,0,'campo');
  j.rep=cartas.find(c=>c.codigo==='D007'); const max=c.defesaMax; c.defesa=max-3;
  assert(M.encerrarTurno(e).ok); assert.equal(c.defesa,max-3);
  assert(M.encerrarTurno(e).ok); assert.equal(c.defesa,max-2);
  c.defesa=max; M.encerrarTurno(e); M.encerrarTurno(e); assert.equal(c.defesa,max);
});
test('013 dobra cumulativamente no terceiro e sexto turnos próprios', () => {
  const {e,obter}=mesa(), c=obter('n013',0,'campo');
  assert.equal(c.ataqueBase,7);
  for(let i=1;i<=6;i++) {M.encerrarTurno(e);M.encerrarTurno(e);assert.equal(c.ataqueBase,i<3?7:i<6?14:28);}
});
test('019 retorna com arma, item e auxiliares vinculados; uma vez por partida, inclusive cópia', () => {
  const {e,obter}=mesa(), j=e.jogadores[0], c=obter('n019',0,'campo');
  const arma=obter('n006',0,'mao'),item=obter('n026',0,'mao'); c.equip=[arma,item];j.mao=j.mao.filter(x=>x!==arma&&x!==item);
  const aux=obter('n022',0,'apoio');aux.vinculo=c.uid;aux.st.dino=2;c.defesa=1;
  assert(M.executarHabilidade(e,c.uid).ok); assert.equal(j.campo.length,0);assert.equal(j.apoio.length,0);
  for(const x of [c,arma,item,aux]) assert(j.mao.includes(x));
  assert.equal(c.defesa,c.base.defesa);assert.equal(aux.vinculo,undefined);assert.deepEqual(aux.st,{});
  e.acoes=2;assert(M.invocar(e,c.uid).ok);assert(M.executarHabilidade(e,c.uid).erro);
  e.turno=1;e.acoes=2;const g=obter('n034',1,'campo');
  assert(M.executarHabilidade(e,g.uid).erro);assert.equal(e.acoes,2);
});
for(const modo of ['multiplayer','coop']) test('representante escolhido antes da partida é validado e aparece na visão: '+modo, () => {
  const p=new Partida([{id:'a',nome:'A',representante:'D007'},{id:'b',nome:'B',representante:'D001'}],cartas,modo);
  assert.equal(p.estado.jogadores[0].rep.codigo,'D007');assert.equal(p.visao('b').jogadores[0].rep.codigo,'D007');
  assert.throws(()=>new Partida([{id:'a',nome:'A',representante:'n013'},{id:'b',nome:'B'}],cartas,modo),{code:'REPRESENTANTE_INVALIDO'});
});
test('034 aplica imediatamente passiva copiada de presença', () => {
  const {e,obter}=mesa(), g=obter('n034',0,'campo'), l=obter('n029',1,'campo');
  l.base={...l.base,elemento:'sombrio'};const defesa=g.defesa;
  assert(M.executarHabilidade(e,g.uid).ok);assert.equal(g.st.copia,'n029');assert.equal(g.defesa,defesa*10);
});

test('009 dobra veneno e dano de fogo das próprias cartas, sem ampliar o oponente', () => {
  const {e,obter}=mesa(), f=obter('n009',0,'apoio'), a=obter('n016',0,'campo'), b=obter('n011',1,'campo');
  assert(M.executarHabilidade(e,a.uid).ok);assert.equal(b.st.veneno,4);assert.equal(M.ataqueTotal(a,b.base,e),a.base.ataque);
  const fogo=obter('n027',0,'mao');e.acoes=2;assert(M.equipar(e,fogo.uid).ok);
  e.turno=1;e.acoes=2;assert(M.atacar(e).ok);assert.equal(b.st.queimadura,14);
  assert.equal(M.fatorHabilidade(e,b),1);assert.equal(M.fatorHabilidade(e,a),2);
  e.jogadores[0].apoio=[];assert.equal(M.fatorHabilidade(e,a),1);assert.equal(b.st.veneno,4,'efeito já aplicado conserva o valor');
});
test('009 dobra paralisia e dano de feitiço; recargas e uso único não dobram', () => {
  const {e,obter}=mesa();obter('n009',0,'apoio');const s=obter('n017',0,'mao'),b=obter('n012',1,'campo');
  const antes=b.defesa;assert(M.executarHabilidade(e,s.uid).ok);assert.equal(b.st.paralisia,6);assert.equal(b.defesa,antes-6);
  M.encerrarTurno(e);M.encerrarTurno(e);assert.equal(b.st.paralisia,4);
  M.encerrarTurno(e);M.encerrarTurno(e);assert.equal(b.st.paralisia,2);
  M.encerrarTurno(e);M.encerrarTurno(e);assert.equal(b.st.paralisia,0);
  const a=obter('n020',0,'campo');assert(M.executarHabilidade(e,a.uid).ok);assert.equal(a.rec,3);assert.equal(b.st.confusao,4);
});
test('009 dobra defesa concedida ao equipar e remoção retira o bônus realmente aplicado', () => {
  const {e,obter}=mesa();obter('n009',0,'apoio');const a=obter('n013',0,'campo'),item=obter('n026',0,'mao');
  const original=a.defesa;assert(M.equipar(e,item.uid).ok);assert.equal(a.defesa,original+22);
  const b=obter('n011',1,'campo'),arma=obter('n006',1,'mao');e.turno=1;e.acoes=2;assert(M.equipar(e,arma.uid).ok);
  e.jogadores[0].apoio=[];assert(M.executarHabilidade(e,arma.uid,item.uid).ok);assert.equal(a.defesa,original);assert.equal(a.defesaMax,original);
});
test('009 dobra o bônus e a duração do Dino e a recuperação do D007', () => {
  const {e,obter}=mesa();obter('n009',0,'apoio');const a=obter('n013',0,'campo'),dino=obter('n022',0,'mao');
  assert(M.colocarApoio(e,dino.uid).ok);assert.equal(dino.st.dino,12);assert.equal(M.ataqueTotal(a,null,e),7);assert.equal(dino.st.danoDino,8);
  e.jogadores[0].rep=cartas.find(c=>c.codigo==='D007');a.defesa=5;
  M.encerrarTurno(e);M.encerrarTurno(e);assert.equal(a.defesa,7);
});
test('009 respeita anulação, não se amplifica e não altera habilidades inimigas', () => {
  const {e,obter}=mesa(),f=obter('n009',0,'apoio'),a=obter('n016',0,'campo'),b=obter('n013',1,'campo');
  assert.equal(M.fatorHabilidade(e,f),1);const arma=obter('n004',1,'mao');b.equip.push(arma);e.jogadores[1].mao=e.jogadores[1].mao.filter(x=>x!==arma);
  assert.equal(M.fatorHabilidade(e,a),1);assert(M.executarHabilidade(e,a.uid).ok);assert.equal(b.st.veneno,2);
});
test('009 permite escolher dois campeões com 035 sem alterar a mesa durante perguntas', () => {
  const {e,obter}=mesa();obter('n009',0,'apoio');const a=obter('n035',0,'campo');obter('n013',0,'baralho');obter('n011',0,'baralho');
  const antes=structuredClone(e);let r=M.executarHabilidade(e,a.uid);assert(r.pergunta);assert.deepEqual(e,antes);
  r=M.executarHabilidade(e,a.uid,r.pergunta.opcoes[0].valor);assert(r.pergunta);assert.deepEqual(e,antes);
  const n=e.jogadores[0].mao.length;r=M.executarHabilidade(e,a.uid,r.pergunta.opcoes[0].valor);assert(r.ok);assert.equal(e.jogadores[0].mao.length,n+2);assert.equal(e.acoes,1);
});
function esvaziar(e) {
  const cartas=e.jogadores.flatMap(j=>[...j.baralho,...j.mao]);
  e.jogadores.forEach(j=>{j.baralho=[];j.mao=[];j.descarte=[]});return cartas;
}
test('redistribuição aguarda ambos os baralhos, reúne descartes, divide e conserva sobra central', () => {
  const {e}=mesa(),[a,b]=e.jogadores,todas=esvaziar(e);
  a.descarte=todas.slice(0,3);b.descarte=todas.slice(3,5);b.baralho=[todas[5]];a.mao=todas.slice(6);
  const antes=structuredClone(e);assert(M.comprarAcao(e).erro);assert.deepEqual(e,antes);
  e.turno=1;assert(M.comprarAcao(e).ok);assert.equal(a.baralho.length,2);assert.equal(b.baralho.length,2);
  assert.equal(a.descarte.length,0);assert.equal(b.descarte.length,0);assert.equal(e.reservaCentral.length,1);
  const ids=[...e.reservaCentral,...e.jogadores.flatMap(j=>[...j.mao,...j.baralho])].map(c=>c.uid);assert.equal(ids.length,40);assert.equal(new Set(ids).size,40);
  const centro=e.reservaCentral[0];
  a.mao.push(...a.baralho.splice(0));b.mao.push(...b.baralho.splice(0));a.descarte=[a.mao.pop()];
  e.acoes=2;assert(M.comprarAcao(e).ok);assert.equal(e.reservaCentral.length,0);
  assert(e.jogadores.some(j=>[...j.mao,...j.baralho].includes(centro)));
});
test('apenas uma carta nos descartes/centro não cria cartas nem gasta ação', () => {
  const {e}=mesa(),todas=esvaziar(e);e.jogadores[0].descarte=[todas[0]];e.jogadores[0].mao=todas.slice(1);
  const antes=structuredClone(e);assert(M.comprarAcao(e).erro);assert.deepEqual(e,antes);
});
test('co-op mantém reciclagem individual enquanto a regra definitiva não é especificada', () => {
  const p=new Partida([{id:'a',nome:'A'},{id:'b',nome:'B'}],cartas,'coop'),e=p.estado,j=e.jogadores[0];
  j.descarte=j.baralho.splice(0);const n=j.mao.length;
  assert(M.comprarAcao(e).ok);assert.equal(j.mao.length,n+1);assert.equal(j.descarte.length,0);assert.equal(e.reservaCentral.length,0);
});

test('008 captura Normais já em campo e devolve anexos dos outros universos ao antigo dono', () => {
  const {e,obter}=mesa(),[a,b]=e.jogadores;
  const c=obter('n013',1,'campo'),arma=obter('n006',1,'mao'),item=obter('n026',1,'mao'),aux=obter('n022',1,'apoio');
  c.equip=[arma,item];b.mao=b.mao.filter(x=>x!==arma&&x!==item);aux.vinculo=c.uid;
  const f=obter('n008',0,'mao'),secreto=obter('n035',1,'mao'),defeitos=b.derrotados;
  if(!a.campo.length)obter('n023',0,'campo');
  assert(M.colocarApoio(e,f.uid).ok);assert(a.mao.includes(c));assert.equal(b.campo.length,0);assert.equal(b.apoio.length,0);
  for(const anexo of [arma,item,aux]) assert(b.mao.includes(anexo));
  assert(b.mao.includes(secreto));assert.equal(b.derrotados,defeitos);assert.equal(c.defesa,c.base.defesa);assert.equal(c.equip.length,0);
  const todas=e.jogadores.flatMap(j=>[...j.mao,...j.baralho,...j.campo,...j.apoio,...j.descarte,...(j.feiticos||[])].flatMap(c=>[c,...c.equip]));
  assert.equal(todas.length,40);assert.equal(new Set(todas.map(c=>c.uid)).size,40);
});
test('008 captura futuras criaturas e equipamentos Normais sem gastar ação adicional', () => {
  const {e,obter}=mesa(),[a,b]=e.jogadores;obter('n008',0,'apoio');
  const c=obter('n013',1,'mao');e.turno=1;assert(M.invocar(e,c.uid).ok);assert(a.mao.includes(c));assert.equal(e.acoes,1);
  const outra=obter('n011',1,'campo');outra.base={...outra.base,universo:'game'};
  const item=obter('n026',1,'mao');item.base={...item.base,universo:'normal'};const defesa=outra.defesa;
  assert(M.equipar(e,item.uid).ok);assert(a.mao.includes(item));assert.equal(outra.equip.length,0);assert.equal(outra.defesa,defesa);assert.equal(e.acoes,0);
});
test('008 respeita proteção divina e anulação por equipamento; passiva volta quando bloqueio sai', () => {
  const {e,obter}=mesa(),[a,b]=e.jogadores,c=obter('n013',1,'campo'),f=obter('n008',0,'mao'),arma=obter('n004',1,'mao');
  c.equip=[arma];b.mao=b.mao.filter(x=>x!==arma);
  if(!a.campo.length)obter('n023',0,'campo');
  assert(M.colocarApoio(e,f.uid).ok);assert(b.campo.includes(c));assert(M.silenciada(e,f));
  c.equip=[];b.mao.push(arma);M.encerrarTurno(e);assert(a.mao.includes(c));
  const outro=obter('n011',1,'campo'),protecao=obter('n025',1,'apoio');outro.base={...outro.base,universo:'normal'};
  M.encerrarTurno(e);assert(b.campo.includes(outro));assert(b.apoio.includes(protecao));
});
test('008 não devolve para o dono cartas roubadas ao ser removida e não conta captura como derrota', () => {
  const {e,obter}=mesa(),[a,b]=e.jogadores,c=obter('n013',1,'campo'),f=obter('n008',0,'mao');
  if(!a.campo.length)obter('n023',0,'campo');
  assert(M.colocarApoio(e,f.uid).ok);a.apoio=[];a.mao.push(f);M.encerrarTurno(e);
  assert(a.mao.includes(c));assert.equal(b.derrotados,0);
});

test('009 duplica quantidade de cartas de 001, 005 e 006, sem duplicar instâncias', () => {
  for(const codigo of ['n001','n005','n006']) {
    const {e,obter}=mesa();obter('n009',0,'apoio');const [a,b]=e.jogadores;
    let fonte,alvos;
    if(codigo==='n001') {
      obter('n013',0,'campo');fonte=obter(codigo,0,'mao');alvos=[obter('n006',0,'baralho'),obter('n023',0,'baralho')];
    } else if(codigo==='n005') {
      fonte=obter(codigo,0,'mao');alvos=[obter('n028',0,'descarte'),obter('n032',0,'descarte')];
    } else {
      obter('n013',0,'campo');fonte=obter(codigo,0,'mao');assert(M.equipar(e,fonte.uid).ok);e.acoes=2;
      const alvo=obter('n011',1,'campo');alvos=[obter('n026',1,'mao'),obter('n027',1,'mao')];
      alvo.equip=alvos;b.mao=b.mao.filter(x=>!alvos.includes(x));alvo.defesa+=alvos.reduce((n,x)=>n+x.base.defesa,0);alvo.defesaMax=alvo.defesa;
    }
    let r=codigo==='n001'?M.colocarApoio(e,fonte.uid):M.executarHabilidade(e,fonte.uid);
    for(let i=0;r.pergunta&&i<8;i++)r=M.executarHabilidade(e,fonte.uid,r.pergunta.opcoes[0].valor);
    assert(r.ok,codigo);for(const x of alvos)assert((codigo==='n006'?b.descarte:a.mao).includes(x),codigo);
    const todas=[...(e.reservaCentral||[]),...e.jogadores.flatMap(j=>[...j.mao,...j.baralho,...j.campo,...j.apoio,...j.descarte,...(j.feiticos||[])].flatMap(c=>[c,...c.equip]))];
    assert.equal(todas.length,40);assert.equal(new Set(todas.map(c=>c.uid)).size,40);
  }
});
test('redistribuição online aparece aos dois sem revelar a ordem dos baralhos ou a carta central', () => {
  const p=new Partida([{id:'a',nome:'A'},{id:'b',nome:'B'}],cartas),e=p.estado,todas=esvaziar(e);e.turno=0;
  e.jogadores[0].descarte=todas.slice(0,3);e.jogadores[1].descarte=todas.slice(3,5);e.jogadores[0].mao=todas.slice(5);
  assert(p.agir('a',{tipo:'comprar',revisao:0}).ok);
  for(const id of p.ids){const v=p.visao(id);assert(v.log.some(l=>l.startsWith('Os dois baralhos acabaram.')));assert.equal(v.reservaCentralTotal,1);assert.equal(v.reservaCentral,undefined);for(const j of v.jogadores)assert.equal(j.baralho,undefined);}
});

for (const modo of ['local','multiplayer','coop']) test(`Irineu mantém confusão visível e publica o autoataque em ${modo}`,()=>{
  // Isola a confusão: sortear D007 para a máquina acrescentaria cura ao cenário.
  const p=new Partida([{id:'a',nome:'A'},{id:'b',nome:'B'}],cartas,modo,40,modo==='coop'?{representantesMaquinas:[null,null]}:{}),e=p.estado;e.turno=0;
  const alvo=modo==='coop'?2:1;
  function mover(codigo,dono,zona){let c;for(const j of e.jogadores)for(const z of ['mao','baralho']){const k=j[z].findIndex(x=>x.base.codigo===codigo);if(k>=0)c=j[z].splice(k,1)[0];}assert(c,codigo);e.jogadores[dono][zona].push(c);return c;}
  const irineu=mover('n020',0,'campo'),criatura=mover('n015',alvo,'campo');
  mover('n009',0,'apoio');criatura.defesa=criatura.defesaMax=100;const antes=criatura.defesa,dano=M.ataqueTotal(criatura,criatura.base,e);
  assert(p.agir('a',{tipo:'habilidade',uid:irineu.uid,alvo,revisao:p.revisao}).ok);
  assert(p.visao('b').log.some(l=>/confundiu/.test(l)));assert.equal(p.estado.acoes,1);
  for(let turno=1;turno<=4;turno++){
    assert(p.agir('a',{tipo:'encerrar',revisao:p.revisao}).ok);
    const c=p.estado.jogadores[alvo].campo[0];assert.equal(c.defesa,antes-dano*turno);
    assert.equal(c.st.confusao,5-turno,'efeito visível durante o turno atingido');
    assert(p.visao('a').log.some(l=>/atacou a si mesma:.*DEF restante:/.test(l)));
    const restaurada=Partida.restaurar(p.salvar());assert.deepEqual(restaurada.visao('a'),p.visao('a'));
    do {assert(M.encerrarTurno(p.estado).ok);}while(p.estado.turno!==0);
    assert.equal(Number(p.estado.jogadores[alvo].campo[0].st.confusao)||0,4-turno);
  }
  assert(p.agir('a',{tipo:'encerrar',revisao:p.revisao}).ok);
  assert.equal(p.estado.jogadores[alvo].campo[0].defesa,antes-dano*4,'não repete depois de expirar');
});
test('Irineu sem Fuleco pode pontuar no primeiro autoataque, conserva recarga e pontua derrota por confusão',()=>{
  const {e,obter}=mesa(),a=obter('n020',0,'campo'),b=obter('n035',1,'campo');b.defesa=4;e.jogadores[1].derrotados=2;
  assert(M.executarHabilidade(e,a.uid).ok);assert.equal(a.rec,3);assert.equal(b.st.confusao,2);
  assert(M.encerrarTurno(e).ok);assert.equal(e.vencedor,0);assert.equal(e.jogadores[1].derrotados,3);
  assert(e.eventosPublicos.some(x=>/atacou a si mesma: 4 de dano.*DEF restante: 0/.test(x.texto)));
});
test('Thor paralisa Game, bloqueia contra-ataque e publica a duração sem gastar ações recusadas',()=>{
  const {e,obter}=mesa(),a=obter('n020',0,'campo'),b=obter('n012',1,'campo'),thor=obter('n017',0,'mao');
  const r=M.executarHabilidade(e,thor.uid);assert(r.ok);assert.match(r.registroHabilidade,/paralisada por 3/);
  assert.equal(e.acoes,1);const defesa=a.defesa;const ataque=M.atacar(e);assert(ataque.ok);assert.equal(a.defesa,defesa);assert.match(ataque.registroCombate,/Contra-ataque: 0 de dano.*paralisada/);
  assert(M.encerrarTurno(e).ok);assert.equal(b.st.paralisia,3);const antes=e.acoes;assert(M.atacar(e).erro);assert.equal(e.acoes,antes);
  assert(M.comprarAcao(e).ok);assert.equal(e.acoes,antes-1);assert.equal(b.st.paralisia,2);assert(M.encerrarTurno(e).ok);assert.equal(b.st.paralisia,1);
  assert(M.encerrarTurno(e).ok);assert(M.comprarAcao(e).ok);assert.equal(b.st.paralisia,0);assert(M.atacar(e).ok);
});
test('Thor informa por que não paralisa outro universo e preserva a duração maior já aplicada',()=>{
  const {e,obter}=mesa(),thor=obter('n017',0,'mao'),b=obter('n015',1,'campo');
  const r=M.executarHabilidade(e,thor.uid);assert(r.ok);assert.equal(b.st.paralisia,undefined);assert.match(r.registroHabilidade,/não.*Game/);
  // Simula nova obtenção do feitiço antes de acabar uma paralisia mais longa.
  e.jogadores[0].descarte=e.jogadores[0].descarte.filter(c=>c!==thor);e.jogadores[0].mao.push(thor);b.base.universo='game';b.st.paralisia=9;
  assert(M.executarHabilidade(e,thor.uid).ok);assert.equal(b.st.paralisia,9);
});
test('Thor também bloqueia a habilidade ativa da criatura e permite as demais ações',()=>{
  const {e,obter}=mesa(),thor=obter('n017',0,'mao'),b=obter('n020',1,'campo');obter('n015',0,'campo');b.base.universo='game';
  assert(M.executarHabilidade(e,thor.uid).ok);assert(M.encerrarTurno(e).ok);
  assert.equal(M.estadoHabilidade(e,b.uid).disponivel,false);assert.match(M.estadoHabilidade(e,b.uid).motivo,/paralisada/);
  const antes=e.acoes;assert.match(M.executarHabilidade(e,b.uid).erro,/paralisada/);assert.equal(e.acoes,antes);
  assert(M.encerrarTurno(e).ok);assert(M.encerrarTurno(e).ok);assert.equal(b.st.paralisia,1);assert(M.comprarAcao(e).ok);assert.equal(M.estadoHabilidade(e,b.uid).disponivel,true);
});
test('Irineu sem alvo não gasta ação nem entra em recarga',()=>{
  const {e,obter}=mesa(),a=obter('n020',0,'campo');e.jogadores[1].campo=[];
  assert(M.executarHabilidade(e,a.uid).erro);assert.equal(e.acoes,2);assert.equal(a.rec,0);
});
