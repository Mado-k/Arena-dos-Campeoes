const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../public/motor'),Partida=require('../partida'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../public/cartas-offline.js'),'utf8'),ctx);
const cartas=JSON.parse(JSON.stringify(ctx.window.CARTAS_OFFLINE));
const todas=e=>e.jogadores.flatMap(j=>['mao','baralho','campo','apoio','descarte','feiticos'].flatMap(z=>j[z].flatMap(c=>[c,...c.equip]))).concat(e.reservaCentral);
function mesa(modo='multiplayer',quantidade=2){
 const pool=quantidade===3?cartas.concat([0,1].map(i=>({codigo:'extra'+i,nome:'Item extra '+i,classe:'item',ataque:0,defesa:0}))):cartas;
 const p=new Partida(Array.from({length:quantidade},(_,i)=>({id:'p'+i,nome:'Pessoa '+i})),pool,modo,40);p.estado.turno=0;
 function mover(codigo,dono,zona){let c;for(const j of p.estado.jogadores)for(const z of ['mao','baralho','campo','apoio','descarte']){const k=j[z].findIndex(x=>x.base.codigo===codigo);if(k>=0)c=j[z].splice(k,1)[0];}assert(c,codigo);p.estado.jogadores[dono][zona].push(c);return c;}
 const agir=uid=>p.agir('p0',{tipo:'eliminar',uid,revisao:p.revisao});
 return {p,mover,agir};
}
for(const modo of ['local','multiplayer','coop'])test('eliminar campeão próprio custa uma ação e descarta vínculos no '+modo,()=>{
 const {p,mover,agir}=mesa(modo),e=p.estado,j=e.jogadores[0],c=mover('n032',0,'campo'),aux=mover('n009',0,'apoio');aux.vinculo=c.uid;
 const arma=mover('n021',0,'mao'),item=mover('n026',0,'mao');assert(M.equipar(e,arma.uid).ok);assert(M.equipar(e,item.uid).ok);e.acoes=2;
 const uids=todas(e).map(c=>c.uid).sort((a,b)=>a-b);
 assert(agir(c.uid).ok);const depois=p.estado,jd=depois.jogadores[0];
 assert.equal(depois.acoes,1);assert.equal(jd.derrotados,1);assert.equal(depois.jogadores[1].derrotados,0);assert.equal(jd.campo.length,0);assert.equal(jd.apoio.length,0);
 for(const x of [c,aux,arma,item])assert(jd.descarte.some(a=>a.uid===x.uid));
 assert.deepEqual(todas(depois).map(c=>c.uid).sort((a,b)=>a-b),uids);assert.match(p.log.join('\n'),/Conta uma derrota de campeão para Pessoa 0: 1\/3/);
 assert.deepEqual(Partida.restaurar(p.salvar()).visao('p0'),p.visao('p0'));
 const antes=p.salvar();assert(agir(c.uid).erro);assert.deepEqual(p.salvar(),antes);
});
test('eliminar uma besta não pontua; aplica morte de Fenrir e encerra Pandora',()=>{
 const {p,mover,agir}=mesa(),e=p.estado,c=mover('n023',0,'campo'),campeao=mover('n034',0,'mao');e.pandora=true;e.pandoraUsos=1;
 assert(agir(c.uid).ok);assert.equal(p.estado.jogadores[0].derrotados,0);assert.equal(p.estado.jogadores[1].derrotados,0);assert.equal(p.estado.pandora,false);assert.equal(p.estado.jogadores[0].bonusCampeao,100);
 assert(p.agir('p0',{tipo:'invocar',uid:campeao.uid,revisao:1}).ok);assert.equal(p.estado.jogadores[0].campo[0].defesa,116);
});
test('só o dono na própria vez pode eliminar criatura do campo, com uma ação disponível',()=>{
 const {p,mover,agir}=mesa(),c=mover('n032',0,'campo'),alheio=mover('n035',1,'campo'),aux=mover('n009',0,'apoio'),mao=mover('n034',0,'mao');
 for(const uid of [alheio.uid,aux.uid,mao.uid,undefined,'1',-1]){const antes=p.salvar();assert(agir(uid).erro);assert.deepEqual(p.salvar(),antes);}
 let antes=p.salvar();assert(p.agir('p1',{tipo:'eliminar',uid:alheio.uid,revisao:0}).erro);assert.deepEqual(p.salvar(),antes);
 p.estado.acoes=0;antes=p.salvar();assert(agir(c.uid).erro);assert.deepEqual(p.salvar(),antes);
 p.estado.acoes=2;p.estado.vencedor=1;antes=p.salvar();assert(agir(c.uid).erro);assert.deepEqual(p.salvar(),antes);
});
test('eliminar seu terceiro campeão encerra o duelo com vitória do adversário',()=>{
 const {p,mover,agir}=mesa(),c=mover('n032',0,'campo');p.estado.jogadores[0].derrotados=2;assert(agir(c.uid).ok);assert.equal(p.estado.jogadores[0].derrotados,3);assert.equal(p.estado.vencedor,1);
});
test('terceira derrota voluntária no co-op elimina o dono e passa a vez sem encerrar aliados',()=>{
 const {p,mover,agir}=mesa('coop'),c=mover('n032',0,'campo');p.estado.jogadores[0].derrotados=2;assert(agir(c.uid).ok);assert(p.estado.jogadores[0].eliminado);assert.equal(p.estado.vencedor,null);assert.notEqual(p.estado.turno,0);
});
test('eliminação voluntária no mata-mata libera a próxima rodada',()=>{
 const {p,mover,agir}=mesa('local',3),c=mover('n032',0,'campo');p.estado.jogadores[0].derrotados=2;assert(agir(c.uid).ok);assert(p.estado.jogadores[0].eliminado);assert.equal(p.estado.torneio.rodada,2);assert.notEqual(p.estado.turno,0);assert.equal(p.estado.vencedor,null);
});
test('servidor persiste eliminação uma vez e reverte tudo se a gravação falhar',{timeout:12000},async t=>{
 const http=require('node:http'),{Server}=require('socket.io'),{io:conectar}=require('socket.io-client'),{once}=require('node:events');
 const banco={dados:new Map(),falhar:false,async carregar(){return[];},async salvar(d){if(this.falhar)throw Error('Falha simulada ao salvar eliminação');this.dados.set(d.codigo,structuredClone(d));},async excluir(c){this.dados.delete(c);}};
 const servidor=http.createServer(),io=new Server(servidor),controle=require('../salas')(io,async()=>cartas,{armazenamento:banco}),clientes=[];
 await controle.pronto;servidor.listen(0,'127.0.0.1');await once(servidor,'listening');
 t.after(async()=>{clientes.forEach(c=>c.close());await new Promise(r=>io.close(r));controle.fechar();});
 const pedir=(c,n,d)=>new Promise((resolve,reject)=>c.timeout(4000).emit(n,d,(e,r)=>e?reject(e):resolve(r)));
 const esperar=c=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{c.off('partida:estado',receber);reject(Error('Sem estado atualizado'));},4000);function receber(v){if(v.revisao!==1)return;clearTimeout(timer);c.off('partida:estado',receber);resolve(v);}c.on('partida:estado',receber);});
 for(let i=0;i<2;i++){const c=conectar('http://127.0.0.1:'+servidor.address().port,{transports:['websocket'],reconnection:false});clientes.push(c);await once(c,'connect');}
 const [a,b]=clientes,r=await pedir(a,'sala:criar',{modo:'multiplayer',nome:'A',tamanhoBaralho:40}),codigo=r.sala.codigo;
 assert((await pedir(b,'sala:entrar',{modo:'multiplayer',nome:'B',codigo})).ok);await pedir(a,'sala:pronto',true);await pedir(b,'sala:pronto',true);assert((await pedir(a,'partida:iniciar',{})).ok);
 const sala=controle.salas.get(codigo),p=sala.partida;p.estado.turno=0;const j=p.estado.jogadores[0],c=j.mao.find(M.ehCampeao)||j.baralho.find(M.ehCampeao);j.mao=j.mao.filter(x=>x!==c);j.baralho=j.baralho.filter(x=>x!==c);j.campo=[c];
 const antes=p.salvar();banco.falhar=true;assert((await pedir(a,'partida:acao',{tipo:'eliminar',uid:c.uid,revisao:0})).erro);assert.deepEqual(sala.partida.salvar(),antes);
 banco.falhar=false;const estados=clientes.map(esperar);assert((await pedir(a,'partida:acao',{tipo:'eliminar',uid:c.uid,revisao:0})).ok);
 for(const v of await Promise.all(estados)){assert.equal(v.jogadores[0].derrotados,1);assert.equal(v.jogadores[1].derrotados,0);assert.equal(v.acoes,1);assert.equal(v.jogadores[0].campo.length,0);}
 assert.equal(banco.dados.get(codigo).partida.revisao,1);assert((await pedir(a,'partida:acao',{tipo:'eliminar',uid:c.uid,revisao:0})).erro);assert.equal(sala.partida.revisao,1);
});
