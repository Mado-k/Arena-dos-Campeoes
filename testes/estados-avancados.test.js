const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const M=require('../public/motor'),Partida=require('../partida'),E=require('../public/efeitos');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/cartas-offline.js'),'utf8'),ctx);const cartas=JSON.parse(JSON.stringify(ctx.window.CARTAS_OFFLINE));
function mesa(modo='multiplayer'){
 const p=new Partida([{id:'a',nome:'A'},{id:'b',nome:'B'}],cartas,modo,40,modo==='coop'?{representantesMaquinas:[null,null]}:{}),e=p.estado;e.turno=0;e.acoes=2;const rival=M.adversarios(e,0)[0];
 function mover(codigo,dono,zona){let c;for(const j of e.jogadores)for(const z of ['mao','baralho','campo','apoio','descarte','feiticos']){const i=j[z].findIndex(c=>c.base.codigo===codigo);if(i>=0)c=j[z].splice(i,1)[0];}assert(c,codigo);e.jogadores[dono][zona].push(c);return c;}
 const todas=()=>[...e.reservaCentral,...e.jogadores.flatMap(j=>['mao','baralho','campo','apoio','descarte','feiticos'].flatMap(z=>j[z].flatMap(c=>[c,...c.equip])))];
 function ate(dono){let n=0;do{assert(M.encerrarTurno(e).ok);assert(n++<12);}while(e.turno!==dono&&e.vencedor===null);}
 return{p,e,rival,mover,todas,ate};
}
for(const modo of ['local','multiplayer','coop'])test('Thor bloqueia criatura e apoios por três oportunidades, sem bloquear o invocador: '+modo,()=>{
 const {e,mover,rival,ate}=mesa(modo),a=mover('n013',0,'campo'),b=mover('n035',rival,'campo'),f=mover('n009',rival,'mao'),d=mover('n022',rival,'mao');a.defesa=a.defesaMax=b.defesa=b.defesaMax=100;
 e.turno=rival;assert(M.colocarApoio(e,f.uid).ok);assert(M.colocarApoio(e,d.uid).ok);e.turno=0;e.acoes=2;
 const thor=mover('n017',0,'mao');assert(M.executarHabilidade(e,thor.uid).ok);assert.equal(b.st.paralisia,3);assert.equal(M.fatorHabilidade(e,rival),1);assert(M.estadoHabilidade(e,d.uid).anulada);
 ate(rival);assert.equal(b.st.paralisia,3);const antes=e.acoes;assert(M.atacar(e).erro);assert(M.executarHabilidade(e,b.uid).erro);assert.equal(e.acoes,antes);assert.equal(b.st.paralisia,3);
 assert(M.comprarAcao(e).ok);assert.equal(b.st.paralisia,2);const item=mover('n026',rival,'mao');assert(M.equipar(e,item.uid).ok);assert.equal(b.st.paralisia,1);const defesaA=a.defesa;ate(rival);assert.equal(a.defesa,defesaA,'Dino vinculado não ataca durante a paralisia');assert.equal(b.st.paralisia,1);
 assert(M.comprarAcao(e).ok);assert.equal(b.st.paralisia,0);assert.equal(e.acoes,1);assert.equal(M.fatorHabilidade(e,rival),2);assert(!M.estadoHabilidade(e,d.uid).anulada);assert(M.atacar(e).ok);
});
test('passar o turno faz as oportunidades restantes de paralisia passarem',()=>{
 const {e,mover,rival,ate}=mesa();mover('n013',0,'campo');const b=mover('n035',rival,'campo'),t=mover('n017',0,'mao');M.executarHabilidade(e,t.uid);ate(rival);assert.equal(b.st.paralisia,3);ate(rival);assert.equal(b.st.paralisia,1);ate(rival);assert.equal(b.st.paralisia,0);
});
test('Fuleco aumenta paralisia para seis ações, sem contar ações do adversário',()=>{
 const {e,mover,rival,ate}=mesa();mover('n013',0,'campo');mover('n009',0,'apoio');const b=mover('n035',rival,'campo'),t=mover('n017',0,'mao');assert(M.executarHabilidade(e,t.uid).ok);assert.equal(b.st.paralisia,6);assert(M.comprarAcao(e).ok);assert.equal(b.st.paralisia,6);ate(rival);ate(rival);assert.equal(b.st.paralisia,4);ate(rival);assert.equal(b.st.paralisia,2);ate(rival);assert.equal(b.st.paralisia,0);
});
for(const fator of [1,2])test('Irineu dura '+(2*fator)+' turnos com autoataques exatos e recarga preservada',()=>{
 const {e,mover,rival,ate}=mesa();const a=mover('n020',0,'campo'),b=mover('n015',rival,'campo');b.defesa=b.defesaMax=100;if(fator===2)mover('n009',0,'apoio');
 const dano=M.ataqueTotal(b,b.base,e);assert(M.executarHabilidade(e,a.uid).ok);assert.equal(a.rec,3);assert.equal(b.st.confusao,2*fator);assert.match(e.log.at(-1),new RegExp('próximos '+(2*fator)+' turno'));
 for(let i=1;i<=2*fator;i++){ate(rival);assert.equal(b.defesa,100-i*dano);assert.equal(b.st.confusao,2*fator-i+1);ate(0);}
 const defesa=b.defesa;ate(rival);assert.equal(b.defesa,defesa);assert.equal(b.st.confusao,undefined);
});
for(const codigo of ['n009','n004','n026'])test('Benito recusa '+codigo+' sem gastar ação nem tirar a carta da mão',()=>{
 const {p,e,mover}=mesa();mover('n038',0,'campo');const anexo=mover(codigo,0,'mao'),antes=p.salvar();assert(p.agir('a',{tipo:codigo==='n009'?'apoio':'equipar',uid:anexo.uid,revisao:0}).erro);assert.deepEqual(p.salvar(),antes);
});
test('recusa de Benito não concede imunidade geral a feitiços inimigos',()=>{
 const {e,mover,rival}=mesa();const b=mover('n038',rival,'campo'),s=mover('n030',0,'mao');b.defesa=b.defesaMax=100;assert(M.executarHabilidade(e,s.uid).ok);assert.equal(b.defesa,95);
});
test('copiar a recusa remove todos os anexos já vinculados sem pontuar derrota',()=>{
 const {e,mover,rival}=mesa();const g=mover('n034',0,'campo');mover('n038',rival,'campo');const f=mover('n009',0,'mao'),eq=mover('n026',0,'mao');M.colocarApoio(e,f.uid);M.equipar(e,eq.uid);e.acoes=2;assert(M.executarHabilidade(e,g.uid).ok);assert.equal(g.st.copia,'n038');assert.equal(g.equip.length,0);assert.equal(e.jogadores[0].apoio.length,0);assert(e.jogadores[0].descarte.includes(f));assert(e.jogadores[0].descarte.includes(eq));assert.equal(e.jogadores[0].derrotados,0);
});
for(const modo of ['local','multiplayer','coop'])test('Pandora tem zona pública própria, origem correta dos ataques e descarte ao terminar: '+modo,()=>{
 const {p,e,mover,rival,todas,ate}=mesa(modo);mover('n013',0,'campo');const alvo=mover('n035',rival,'campo'),s=mover('n002',0,'mao');alvo.defesa=100;
 assert(M.executarHabilidade(e,s.uid).ok);assert(e.jogadores[0].feiticos.includes(s));assert(!e.jogadores[0].descarte.includes(s));assert.equal(todas().length,40);assert.equal(new Set(todas().map(c=>c.uid)).size,40);
 for(const id of p.ids)assert.equal(p.visao(id).jogadores[0].feiticos[0].uid,s.uid);
 const salva=Partida.restaurar(p.salvar());assert.deepEqual(salva.visao('a'),p.visao('a'));
 ate(rival);assert.equal(alvo.defesa,90);const hit=e.efeitosVisuais.findLast(x=>x.tipo==='pandora');assert.equal(hit.origem,s.uid);assert.equal(hit.dono,0);assert.equal(hit.alvo,alvo.uid);
 e.acoes=2;assert(M.eliminarCarta(e,alvo.uid).ok);assert.equal(e.pandora,false);assert.equal(e.jogadores[0].feiticos.length,0);assert(e.jogadores[0].descarte.includes(s));assert.equal(todas().length,40);
});
test('restauração migra Pandora ativa antiga sem duplicar sua instância',()=>{
 const {p,e,mover}=mesa();mover('n013',0,'campo');const s=mover('n002',0,'mao');M.executarHabilidade(e,s.uid);e.pandoraVersao=2;e.jogadores[0].feiticos=[];e.jogadores[0].descarte.push(s);const r=Partida.restaurar(p.salvar());assert.equal(r.estado.jogadores[0].feiticos.length,1);assert.equal(r.estado.jogadores[0].feiticos[0].uid,s.uid);assert(!r.estado.jogadores[0].descarte.some(c=>c.uid===s.uid));
});
test('restauração converte paralisia antiga em turnos para oportunidades de ação',()=>{
 const {p,e,mover}=mesa();const c=mover('n035',1,'campo');c.st.paralisia=2;delete e.paralisiaVersao;const r=Partida.restaurar(p.salvar());assert.equal(r.estado.jogadores[1].campo[0].st.paralisia,4);assert.equal(Partida.restaurar(r.salvar()).estado.jogadores[1].campo[0].st.paralisia,4);
});
test('lançamento público revela somente o feitiço executado, nunca o resultado de compra',()=>{
 const {p,e,mover}=mesa();const s=mover('n031',0,'mao');for(const c of e.jogadores[0].baralho)c.base={...c.base,nome:'SEGREDO DO BARALHO'};assert(p.agir('a',{tipo:'habilidade',uid:s.uid,revisao:0}).ok);const ev=p.visao('b').efeitosVisuais,l=ev.find(e=>e.tipo==='feitico-lancado');assert.equal(l.origem,s.uid);assert.equal(l.codigo,'n031');assert(!JSON.stringify(ev).includes('SEGREDO'));assert.equal(p.visao('b').jogadores[0].mao.length,0);
});
test('lançamento central cabe no orçamento de cinco segundos com efeito e descarte',()=>{
 const ev=[{tipo:'feitico-lancado',codigo:'n017'},{tipo:'dano-feitico',codigo:'n017'}],cenas=E.roteiro(ev,2400);assert.equal(cenas.length,1);assert(cenas.every(c=>c.eventos.every(e=>e.tipo!=='feitico-lancado')));assert(cenas.reduce((s,c)=>s+c.duracao,800+280+1050)<=5000);
});

test('Pandora descartada ao fim fica acima da criatura e dos anexos do próprio dono',()=>{
 const {e,mover}=mesa();const c=mover('n013',0,'campo'),s=mover('n002',0,'mao');mover('n009',0,'apoio');assert(M.executarHabilidade(e,s.uid).ok);assert(M.eliminarCarta(e,c.uid).ok);assert.equal(e.jogadores[0].descarte.at(-1).uid,s.uid);
});
