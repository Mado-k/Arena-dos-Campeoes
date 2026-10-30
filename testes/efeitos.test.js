const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const M=require('../public/motor'),Partida=require('../partida'),VFX=require('../public/efeitos');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/cartas-offline.js'),'utf8'),ctx);const cartas=JSON.parse(JSON.stringify(ctx.window.CARTAS_OFFLINE));
function preparar(modo='multiplayer'){
 const p=new Partida([{id:'a',nome:'A'},{id:'b',nome:'B'}],cartas,modo,40),e=p.estado;e.turno=0;
 function mover(codigo,dono,zona){let c;for(const j of e.jogadores)for(const z of ['mao','baralho','campo','apoio','descarte']){const i=j[z].findIndex(c=>c.base.codigo===codigo);if(i>=0)c=j[z].splice(i,1)[0];}assert(c,codigo);e.jogadores[dono][zona].push(c);return c;}
 return {p,e,mover};
}
for(const modo of ['local','multiplayer','coop'])test('Dino publica origem, alvo e dano real; último uso e morte preservam evento: '+modo,()=>{
 const {p,e,mover}=preparar(modo),alvo=modo==='coop'?2:1;
 mover('n020',0,'campo');const inimigo=mover('n013',alvo,'campo'),dino=mover('n022',0,'mao');
 assert(M.colocarApoio(e,dino.uid).ok);dino.st.dino=1;inimigo.defesa=4;e.jogadores[alvo].derrotados=2;
 const antes=p.visao('a');assert(p.agir('a',{tipo:'encerrar',alvo,revisao:0}).ok);
 const depois=p.visao('a'),eventos=VFX.planejar(antes,depois),v=eventos.find(e=>e.tipo==='dino');
 assert.deepEqual(v,{seq:antes.serieVisual+1,tipo:'dino',codigo:'n022',origem:dino.uid,dono:0,alvo:inimigo.uid,alvoDono:alvo,dano:4,defesa:0,ultimo:1});
 assert(depois.jogadores[0].descarte.some(c=>c.uid===dino.uid));assert.equal(depois.jogadores[alvo].derrotados,3);
 assert.equal(VFX.planejar(null,depois).length,0,'reconexão não repete histórico');
 assert.deepEqual(VFX.planejar(depois,depois),[]);assert.deepEqual(VFX.planejar({...antes,voce:99},depois),[]);
 const restaurada=Partida.restaurar(p.salvar());assert.deepEqual(restaurada.visao('a').efeitosVisuais,depois.efeitosVisuais);
});
test('Dino bloqueado não gera animação de dano; Dino sem alvo não sai da carta',()=>{
 for(const codigo of ['n037',null]){
  const {e,mover}=preparar();mover('n020',0,'campo');if(codigo)mover(codigo,1,'campo');const dino=mover('n022',0,'mao');M.colocarApoio(e,dino.uid);M.encerrarTurno(e);
  assert.equal(e.efeitosVisuais.filter(e=>e.tipo==='dino').length,0);assert.equal(e.efeitosVisuais.filter(e=>e.tipo==='bloqueio').length,codigo?1:0);
 }
});
test('Dino amplificado publica oito de dano sem duplicar a aplicação',()=>{
 const {e,mover}=preparar();mover('n020',0,'campo');const alvo=mover('n013',1,'campo');alvo.defesa=100;const f=mover('n009',0,'mao'),d=mover('n022',0,'mao');M.colocarApoio(e,f.uid);M.colocarApoio(e,d.uid);M.encerrarTurno(e);
 assert.equal(alvo.defesa,92);assert.equal(e.efeitosVisuais.filter(e=>e.tipo==='dino').length,1);assert.equal(e.efeitosVisuais.find(e=>e.tipo==='dino').dano,8);
});
test('busca de metálica não revela a carta obtida no canal visual',()=>{
 const {p,e,mover}=preparar();mover('n020',0,'campo');const segredo=mover('n006',0,'baralho'),aux=mover('n001',0,'mao');e.jogadores[0].baralho=[segredo];
 assert(p.agir('a',{tipo:'apoio',uid:aux.uid,revisao:0}).ok);const vistos=p.visao('b').efeitosVisuais;
 assert.equal(vistos.length,1);assert(!JSON.stringify(vistos).includes(segredo.base.nome));assert(vistos.every(v=>v.origem!==segredo.uid&&v.alvo!==segredo.uid));
 for(const v of vistos)for(const valor of Object.values(v))assert(['string','number'].includes(typeof valor));
 assert.equal(p.visao('b').jogadores[0].mao.length,0);
});
test('escolhas pendentes e ações inválidas não publicam efeitos nem gastam ações',()=>{
 const {p,e,mover}=preparar();const buscador=mover('n035',0,'campo');mover('n013',0,'baralho');mover('n020',0,'baralho');
 const antes=structuredClone(e);assert(p.agir('a',{tipo:'habilidade',uid:buscador.uid,revisao:0}).pergunta);assert.deepEqual(p.estado,antes);
 assert(p.agir('b',{tipo:'atacar',revisao:0}).erro);assert.deepEqual(p.estado,antes);
});
test('ataque e contra-ataque informam DEF real antes de qualquer descarte',()=>{
 const {p,e,mover}=preparar();const a=mover('n013',0,'campo'),b=mover('n035',1,'campo');a.defesa=100;b.defesa=100;
 assert(p.agir('a',{tipo:'atacar',revisao:0}).ok);const eventos=p.visao('a').efeitosVisuais.filter(e=>e.tipo==='ataque');
 assert.equal(eventos.length,2);assert.equal(eventos[0].defesa,p.estado.jogadores[1].campo[0].defesa);assert.equal(eventos[1].defesa,p.estado.jogadores[0].campo[0].defesa);assert.equal(eventos[0].alvo,b.uid);assert.equal(eventos[1].alvo,a.uid);
});
test('veneno, fogo e confusão publicam danos de início do turno em ordem',()=>{
 const {e,mover}=preparar();const alvo=mover('n035',1,'campo');alvo.defesa=100;alvo.st.veneno=2;alvo.st.queimadura=7;alvo.st.confusao=1;
 M.encerrarTurno(e);assert.deepEqual(e.efeitosVisuais.map(e=>e.tipo),['veneno','fogo','confusao']);assert.equal(e.efeitosVisuais[0].defesa,98);assert.equal(e.efeitosVisuais[1].defesa,91);assert.equal(e.efeitosVisuais[2].defesa,alvo.defesa);
});
test('histórico visual limitado e sequencial; versões antigas de salvamento continuam válidas',()=>{
 const {e,p,mover}=preparar();const a=mover('n013',0,'campo'),b=mover('n035',1,'campo');a.defesa=b.defesa=10000;
 for(let i=0;i<40;i++){e.acoes=2;M.atacar(e);}assert.equal(e.serieVisual,80);assert.equal(e.efeitosVisuais.length,64);assert.equal(e.efeitosVisuais[0].seq,17);assert.equal(e.efeitosVisuais.at(-1).seq,80);
 delete e.serieVisual;delete e.efeitosVisuais;const r=Partida.restaurar(p.salvar());assert.equal(r.visao('a').serieVisual,0);assert.deepEqual(r.visao('a').efeitosVisuais,[]);r.estado.acoes=2;assert(r.agir('a',{tipo:'atacar',revisao:0}).ok);assert.equal(r.visao('a').serieVisual,2);
});
test('planejamento remove apenas o lampejo redundante e mantém o raio de Thor',()=>{
 const antes={voce:0,revisao:1,serieVisual:1},eventos=[{seq:1,tipo:'antigo'},{seq:2,tipo:'habilidade',codigo:'n017',origem:9},{seq:3,tipo:'dano-feitico',codigo:'n017',origem:9,dano:3}];
 const novos=VFX.planejar(antes,{voce:0,revisao:2,serieVisual:3,efeitosVisuais:eventos});assert.equal(novos.length,1);assert.equal(VFX.estilo(novos[0]),'raio');
});
test('trajeto tem pontos exatos e arco contínuo de salto',()=>{
 const a={x:20,y:100},b={x:220,y:100};assert.deepEqual(VFX.trajeto(a,b,0,50),a);assert.deepEqual(VFX.trajeto(a,b,1,50),b);assert.deepEqual(VFX.trajeto(a,b,.5,50),{x:120,y:50});assert.deepEqual(VFX.trajeto(a,b,-1,50),a);
});
const Sprites=require('../public/sprites');
test('todas as cartas têm perfil e sprite próprios, exceto a Grávida aguardando design',()=>{
 assert.equal(Object.keys(Sprites.perfis).length,46);assert.equal(Sprites.perfil('n001'),null);
 for(const c of cartas){if(c.codigo==='n001')continue;const p=Sprites.perfil(c.codigo);assert(p,c.codigo);assert(p.efeito);assert(p.acao);
  if(c.codigo!=='n022'){const svg=Sprites.desenhar(c.codigo);assert.match(svg,/viewBox="0 0 32 32"/);assert.match(svg,/crispEdges/);assert(!svg.includes('image '));}
 }
 assert.equal(Sprites.perfil('n036').nome,'Toxic Ran');assert.equal(Sprites.perfil('n036').acao,'remover-agua');
 assert.equal(Sprites.perfil('n030').efeito,'raio');assert.equal(Sprites.perfil('D007').acao,'curar');
});
test('orçamento de cada ação é de um a cinco segundos, incluindo retorno da câmera e voo das cartas',()=>{
 const tipos=['entrada','dino','dino-fim','ataque','habilidade','fogo','veneno','captura','pandora-aplicada'];
 for(let n=1;n<=24;n++){
  const eventos=Array.from({length:n},(_,i)=>({tipo:tipos[i%tipos.length],codigo:i%3?'n022':'n016',seq:i+1}));
  const cenas=VFX.roteiro(eventos);assert(cenas.length<=3);assert(cenas.every(c=>c.duracao>=1000));
  const total=cenas.reduce((n,c)=>n+c.duracao,0)+280+1050;assert(total<=5000,total);assert(total>=1000);
  assert.equal(cenas.flatMap(c=>c.eventos).length,eventos.length);
 }
});
test('rótulos distinguem dano, defesa, compra, confusão, destruição e zumbificação',()=>{
 assert.equal(VFX.textoEvento({tipo:'habilidade',codigo:'n039',defesa:40}),'DEF = 40');
 assert.equal(VFX.textoEvento({tipo:'habilidade',codigo:'n028',defesa:11}),'DEF 11');
 assert.equal(VFX.textoEvento({tipo:'habilidade',codigo:'n031',valor:3}),'3 carta(s)');
 assert.equal(VFX.textoEvento({tipo:'reforco',codigo:'n013',valor:14,atributo:'ATQ base'}),'ATQ base 14');
 assert.equal(VFX.textoEvento({tipo:'habilidade',codigo:'n040'}),'Derrotado');
 assert.equal(VFX.textoEvento({tipo:'habilidade',codigo:'n034',copiada:'n039',defesa:27}),'DEF = 27');
 assert.equal(VFX.textoEvento({tipo:'habilidade',codigo:'n005'}),'','ressuscitar para a mão não é recuperar vida');
});
test('Pandora marca criaturas dos dois lados sem causar dano no lançamento',()=>{
 const {e,p,mover}=preparar();const a=mover('n013',0,'campo'),b=mover('n035',1,'campo'),pandora=mover('n002',0,'mao');
 const defs=[a.defesa,b.defesa];assert(p.agir('a',{tipo:'habilidade',uid:pandora.uid,revisao:0}).ok);
 const eventos=p.visao('a').efeitosVisuais.filter(e=>e.tipo==='pandora-aplicada');assert.equal(eventos.length,2);assert.deepEqual(eventos.map(e=>e.alvoDono),[0,1]);assert(eventos.every(e=>e.dano===undefined));
 assert.deepEqual(p.estado.jogadores.map(j=>j.campo[0].defesa),defs);
});
test('Toxic Ran mira somente os auxiliares e equipamentos de água removidos',()=>{
 const {e,p,mover}=preparar();const ran=mover('n036',0,'campo'),alvo=mover('n013',1,'campo');
 const agua=mover('n009',1,'apoio'),outra=mover('n022',1,'apoio');agua.base.elemento='água';outra.base.elemento='metálico';agua.vinculo=outra.vinculo=alvo.uid;
 const eq=mover('n026',1,'mao');eq.base.elemento='água';e.jogadores[1].mao=e.jogadores[1].mao.filter(c=>c!==eq);alvo.equip.push(eq);
 assert(p.agir('a',{tipo:'habilidade',uid:ran.uid,revisao:0}).ok);const ev=p.visao('a').efeitosVisuais.filter(e=>e.tipo==='habilidade'&&e.codigo==='n036');assert.deepEqual(ev.map(e=>e.alvo).sort(),[agua.uid,eq.uid].sort());assert(ev.every(e=>e.alvo!==alvo.uid&&e.dano===undefined));assert(p.estado.jogadores[1].apoio.some(c=>c.uid===outra.uid));
});
test('armas de anulação diferenciam peixes e bolhas e não repetem a aplicação a cada verificação',()=>{
 for(const codigo of ['n004','n021']){
  const {e,mover}=preparar();const c=mover('n013',0,'campo'),t=mover('n035',1,'campo'),aux=mover('n022',1,'apoio'),arma=mover(codigo,0,'mao');aux.vinculo=t.uid;
  assert(M.equipar(e,arma.uid).ok);const v=e.efeitosVisuais.filter(e=>e.tipo==='anulacao');assert.equal(v.length,1);assert.equal(v[0].codigo,codigo);assert.equal(v[0].alvo,aux.uid);
  assert.match(M.estadoHabilidade(e,aux.uid).motivo,codigo==='n021'?/bolhas/:/peixes/);
  e.acoes=2;M.atacar(e);assert.equal(e.efeitosVisuais.filter(e=>e.tipo==='anulacao').length,1);
 }
});
test('representante informa somente o bônus real na entrada da criatura',()=>{
 const {e,p,mover}=preparar();const c=mover('n013',0,'mao');e.jogadores[0].rep=cartas.find(c=>c.codigo==='D004');assert(p.agir('a',{tipo:'invocar',uid:c.uid,revisao:0}).ok);
 const ev=p.visao('a').efeitosVisuais;assert(ev.some(e=>e.tipo==='entrada'&&e.codigo==='n013'));const rep=ev.find(e=>e.tipo==='representante');assert.equal(rep.codigo,'D004');assert.equal(rep.valor,10);assert.equal(rep.atributo,'DEF');
});
test('cópia de Kitsune retorna à mão própria também no roteiro visual',()=>{
 const {p,mover}=preparar();const g=mover('n034',0,'campo');mover('n019',1,'campo');assert(p.agir('a',{tipo:'habilidade',uid:g.uid,revisao:0}).ok);
 const v=p.visao('a').efeitosVisuais.find(e=>e.tipo==='habilidade');assert.equal(v.codigo,'n034');assert.equal(v.copiada,'n019');assert.equal(v.alvoDono,0);assert.equal(v.zonaOrigem,'campo');assert.equal(v.zonaAlvo,'mao');
});
test('último turno do Dino sem alvo também mostra o cacto, sem dano inventado',()=>{
 const {e,mover}=preparar();mover('n013',0,'campo');const d=mover('n022',0,'mao');M.colocarApoio(e,d.uid);d.st.dino=1;M.encerrarTurno(e);
 const v=e.efeitosVisuais.find(e=>e.tipo==='dino-fim');assert(v);assert.equal(v.dano,undefined);assert(e.jogadores[0].descarte.includes(d));
});
test('intervalo da máquina acomoda uma habilidade comum e o voo das cartas',()=>{
 const ritmo=require('../public/ritmo');const cast=VFX.roteiro([{tipo:'habilidade',codigo:'n016'}]).reduce((n,c)=>n+c.duracao,0)+280+1050;
 assert(ritmo.entreAcoesIA>=cast);assert(ritmo.entreAcoesIA+250<=5000);assert(ritmo.inicioIA>ritmo.avisoTurno);
});
