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
 assert.deepEqual(v,{seq:1,tipo:'dino',codigo:'n022',origem:dino.uid,dono:0,alvo:inimigo.uid,alvoDono:alvo,dano:4,defesa:0});
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
