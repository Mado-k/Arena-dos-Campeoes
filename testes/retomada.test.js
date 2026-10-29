const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {once}=require('node:events'),{Server}=require('socket.io'),{io:conectar}=require('socket.io-client');
const iniciar=require('../salas'),criarArmazenamento=require('../armazenamento-partidas');
const cartas=Array.from({length:40},(_,i)=>({codigo:'sessao'+i,nome:'Carta '+i,classe:'campeão',ataque:1,defesa:20}));
function memoria(){return {dados:new Map(),falhar:false,async carregar(){return [...this.dados.values()].map(x=>structuredClone(x));},async salvar(sala){if(this.falhar)throw Error('Falha de armazenamento de teste');this.dados.set(sala.codigo,structuredClone(sala));},async excluir(codigo){this.dados.delete(codigo);}};}
function esperar(c,nome,condicao=()=>true){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{c.off(nome,receber);reject(Error('Sem evento '+nome));},4000);function receber(d){if(!condicao(d))return;clearTimeout(timer);c.off(nome,receber);resolve(d);}c.on(nome,receber);});}
const pedir=(c,nome,dados)=>new Promise((resolve,reject)=>c.timeout(4000).emit(nome,dados,(e,r)=>e?reject(e):resolve(r)));
async function ambiente(t,store=memoria(),opcoes={}){
 const servidor=http.createServer(),io=new Server(servidor),controle=iniciar(io,async()=>cartas,{armazenamento:store,tempoAvisoIA:0,...opcoes}),clientes=[];await controle.pronto;
 servidor.listen(0,'127.0.0.1');await once(servidor,'listening');let fechou=false;
 async function fechar(){if(fechou)return;fechou=true;clientes.forEach(c=>c.close());await new Promise(r=>io.close(r));controle.fechar();}
 t.after(fechar);
 return {store,controle,fechar,async cliente(){const c=conectar('http://127.0.0.1:'+servidor.address().port,{transports:['websocket'],reconnection:false});clientes.push(c);await once(c,'connect');return c;}};
}
async function duelo(a,modo='multiplayer'){
 const host=await a.cliente(),amigo=await a.cliente(),sa=esperar(host,'sessao');
 const criado=await pedir(host,'sala:criar',{modo,nome:'A',tamanhoBaralho:20}),tokenA=await sa,sb=esperar(amigo,'sessao');
 assert((await pedir(amigo,'sala:entrar',{modo,nome:'B',codigo:criado.sala.codigo})).ok);const tokenB=await sb;
 await pedir(host,'sala:pronto',true);await pedir(amigo,'sala:pronto',true);
 const estados=[esperar(host,'partida:estado'),esperar(amigo,'partida:estado')];assert((await pedir(host,'partida:iniciar',{})).ok);const visoes=await Promise.all(estados);
 return {host,amigo,tokenA,tokenB,codigo:criado.sala.codigo,visoes};
}
test('desconexão pausa; token retoma a mesma mão, revisão e turno em outro socket', {timeout:12000},async t=>{
 const a=await ambiente(t),d=await duelo(a),indice=d.visoes[0].turno,ativo=indice?d.amigo:d.host,outro=indice?d.host:d.amigo,token=indice?d.tokenB:d.tokenA;
 assert((await pedir(ativo,'partida:acao',{tipo:'comprar',revisao:0})).ok);
 const p=a.controle.salas.get(d.codigo).partida,antes=p.visao(token.jogadorId),pausou=esperar(outro,'partida:pausa',x=>x.pausada);
 ativo.close();await pausou;assert((await pedir(outro,'partida:acao',{tipo:'comprar',revisao:1})).erro.includes('pausada'));
 const invasor=await a.cliente();let vazou=false;invasor.on('partida:estado',()=>{vazou=true;});
 assert((await pedir(invasor,'sala:retomar',{modo:'multiplayer',codigo:d.codigo,token:'0'.repeat(64)})).erro);
 assert((await pedir(invasor,'sala:entrar',{modo:'multiplayer',codigo:d.codigo,nome:'Intruso'})).erro);assert.equal(vazou,false);
 const novo=await a.cliente(),visao=esperar(novo,'partida:estado');assert((await pedir(novo,'sala:retomar',{...token,modo:'multiplayer'})).ok);
 const depois=await visao;assert.deepEqual(depois,antes);assert((await pedir(novo,'partida:acao',{tipo:'comprar',revisao:1})).ok);
 assert.equal(a.controle.salas.get(d.codigo).partida.revisao,2);
 const salvo=JSON.stringify(a.store.dados.get(d.codigo));assert(!salvo.includes(token.token));
});
test('reinício do servidor recupera estado completo do banco e aguarda ambas as reconexões', {timeout:12000},async t=>{
 const store=memoria(),a=await ambiente(t,store),d=await duelo(a),indice=d.visoes[0].turno;
 assert((await pedir(indice?d.amigo:d.host,'partida:acao',{tipo:'comprar',revisao:0})).ok);
 const salvo=a.controle.salas.get(d.codigo).partida.salvar();await a.fechar();
 const b=await ambiente(t,store),novoA=await b.cliente(),novoB=await b.cliente();
 assert((await pedir(novoA,'sala:retomar',{...d.tokenA,modo:'multiplayer'})).ok);
 assert((await pedir(novoA,'partida:acao',{tipo:'encerrar',revisao:1})).erro.includes('pausada'));
 assert((await pedir(novoB,'sala:retomar',{...d.tokenB,modo:'multiplayer'})).ok);
 const retomada=b.controle.salas.get(d.codigo);assert.deepEqual(retomada.partida.salvar(),salvo);assert.equal(retomada.salvando,false);
 assert((await pedir(indice?novoB:novoA,'partida:acao',{tipo:'encerrar',revisao:1})).ok);
});
test('sessão conectada não pode ser assumida por outra aba e estado público não expõe tokens', {timeout:12000},async t=>{
 const a=await ambiente(t),d=await duelo(a),novo=await a.cliente();
 assert((await pedir(novo,'sala:retomar',{...d.tokenA,modo:'multiplayer'})).erro.includes('outra aba'));
 const json=JSON.stringify(d.visoes);assert(!json.includes('token'));assert(!json.includes(d.tokenA.token));
});
test('prazo de reconexão encerra e remove a sessão persistida', {timeout:12000},async t=>{
 const a=await ambiente(t,memoria(),{tempoReconexao:60}),d=await duelo(a),fim=esperar(d.host,'partida:encerrada');
 d.amigo.close();assert.equal((await fim).final,true);assert(!a.controle.salas.has(d.codigo));
 const novo=await a.cliente();assert((await pedir(novo,'sala:retomar',{...d.tokenB,modo:'multiplayer'})).expirada);
 assert(!a.store.dados.has(d.codigo));
});
test('falha ao salvar uma ação restaura o estado e a revisão, permitindo repetir com segurança', {timeout:12000},async t=>{
 const a=await ambiente(t),d=await duelo(a),sala=a.controle.salas.get(d.codigo),antes=sala.partida.salvar(),ativo=antes.estado.turno?d.amigo:d.host;
 a.store.falhar=true;assert((await pedir(ativo,'partida:acao',{tipo:'comprar',revisao:0})).erro);
 assert.deepEqual(sala.partida.salvar(),antes);assert.equal(sala.salvando,false);
 a.store.falhar=false;assert((await pedir(ativo,'partida:acao',{tipo:'comprar',revisao:0})).ok);assert.equal(sala.partida.revisao,1);
});
test('sair após o resultado preserva o tabuleiro e a retomada de quem continua consultando', {timeout:12000},async t=>{
 const a=await ambiente(t),d=await duelo(a),sala=a.controle.salas.get(d.codigo);
 sala.partida.estado.vencedor=0;
 const esperado=sala.partida.visao(d.tokenB.jogadorId);
 let encerrou=false;d.amigo.on('partida:encerrada',()=>{encerrou=true;});
 const publicada=esperar(d.amigo,'sala',s=>s.jogadores.length===1);
 assert((await pedir(d.host,'sala:sair',{})).ok);assert((await publicada).emPartida);
 const estado=esperar(d.amigo,'partida:estado');d.amigo.emit('partida:sincronizar');
 assert.deepEqual(await estado,esperado);assert.equal(encerrou,false);
 assert.equal(a.store.dados.get(d.codigo).partida.estado.vencedor,0);
 assert((await pedir(d.amigo,'partida:acao',{tipo:'comprar',revisao:0})).erro);
 const pausa=esperar(d.amigo,'partida:pausa');d.amigo.emit('partida:sincronizar');
 assert.equal((await pausa).pausada,false);
 assert((await pedir(d.amigo,'sala:sair',{})).ok);assert(!a.controle.salas.has(d.codigo));
});
for(const modo of ['multiplayer','coop'])for(const vencedor of [0,1,-1])test(`revanche após resultado ${vencedor} no ${modo} exige todos e volta à mesma sala`,{timeout:12000},async t=>{
 const a=await ambiente(t),d=await duelo(a,modo),sala=a.controle.salas.get(d.codigo);
 assert((await pedir(d.host,'partida:revanche',true)).erro,'rejeita durante partida');
 sala.partida.estado.vencedor=vencedor;
 const anterior=sala.partida.salvar(),votou=esperar(d.amigo,'partida:revanche');
 assert((await pedir(d.host,'partida:revanche',true)).ok);assert.equal((await votou).votos,1);
 assert((await pedir(d.host,'partida:revanche',true)).ok);assert.equal(sala.revanche.size,1);
 assert.deepEqual(sala.partida.salvar(),anterior,'preserva tabuleiro enquanto aguarda');
 assert.equal(a.store.dados.get(d.codigo).revanche.length,1);
 const fim=esperar(d.host,'partida:encerrada'),lobby=esperar(d.amigo,'sala',x=>!x.emPartida);
 assert((await pedir(d.amigo,'partida:revanche',true)).ok);assert((await fim).revanche);
 const nova=await lobby;assert.equal(nova.codigo,d.codigo);assert(nova.jogadores.every(j=>!j.pronto));
 assert.equal(sala.partida,null);assert.equal(a.store.dados.get(d.codigo).partida,null);
 await pedir(d.host,'sala:pronto',true);await pedir(d.amigo,'sala:pronto',true);
 assert((await pedir(d.host,'partida:iniciar',{})).ok);assert.equal(sala.partida.revisao,0);
 assert(sala.partida.estado.jogadores.every(j=>j.derrotados===0&&j.mao.length===3));
});
test('revanche fica indisponível se alguém voltar ao lobby antes da confirmação',{timeout:12000},async t=>{
 const a=await ambiente(t),d=await duelo(a),sala=a.controle.salas.get(d.codigo);sala.partida.estado.vencedor=0;
 assert((await pedir(d.amigo,'partida:revanche',true)).ok);
 const cancelou=esperar(d.amigo,'partida:revanche',x=>x.indisponivel);
 assert((await pedir(d.host,'sala:sair',{})).ok);assert((await cancelou).indisponivel);
 assert((await pedir(d.amigo,'partida:revanche',true)).erro);assert(sala.partida);
});
test('IA online publica e persiste uma ação por etapa antes de passar ao humano', {timeout:12000},async t=>{
 const store=memoria(),gravacoes=[],salvar=store.salvar.bind(store);
 store.salvar=async s=>{if(s.partida)gravacoes.push(s.partida.revisao);await salvar(s);};
 const a=await ambiente(t,store,{tempoIA:40}),d=await duelo(a,'coop'),sala=a.controle.salas.get(d.codigo);
 const quadros=[];d.host.on('partida:estado',v=>quadros.push({rev:v.revisao,turno:v.turno,acoes:v.acoes}));
 const humano=esperar(d.host,'partida:estado',v=>v.turno===1&&v.revisao>=4);
 assert((await pedir(d.host,'partida:acao',{tipo:'encerrar',revisao:0})).ok);
 assert.equal(sala.partida.estado.turno,2);assert.equal(sala.partida.revisao,1);
 await humano;
 assert(quadros.some(q=>q.rev===2&&q.turno===2&&q.acoes===1));
 assert(quadros.some(q=>q.rev===3&&q.turno===2&&q.acoes===0));
 assert(gravacoes.includes(2)&&gravacoes.includes(3)&&gravacoes.includes(4));
 assert.equal(store.dados.get(d.codigo).partida.revisao,4);
});
test('desconexão pausa uma máquina pendente e retomada continua os passos', {timeout:12000},async t=>{
 const a=await ambiente(t,memoria(),{tempoIA:70}),d=await duelo(a,'coop'),sala=a.controle.salas.get(d.codigo);
 assert((await pedir(d.host,'partida:acao',{tipo:'encerrar',revisao:0})).ok);
 const pausa=esperar(d.host,'partida:pausa',v=>v.pausada);d.amigo.close();await pausa;
 await new Promise(r=>setTimeout(r,110));assert.equal(sala.partida.revisao,1);
 const novo=await a.cliente(),passo=esperar(d.host,'partida:estado',v=>v.revisao===2);
 assert((await pedir(novo,'sala:retomar',{...d.tokenB,modo:'coop'})).ok);await passo;
 assert.equal(sala.partida.estado.acoes,1);
});
test('reinício durante o turno da IA retoma do último passo salvo após todos voltarem', {timeout:12000},async t=>{
 const store=memoria(),a=await ambiente(t,store,{tempoIA:90}),d=await duelo(a,'coop');
 assert((await pedir(d.host,'partida:acao',{tipo:'encerrar',revisao:0})).ok);await a.fechar();
 const b=await ambiente(t,store,{tempoIA:50}),h=await b.cliente(),outro=await b.cliente();
 assert((await pedir(h,'sala:retomar',{...d.tokenA,modo:'coop'})).ok);
 await new Promise(r=>setTimeout(r,80));assert.equal(b.controle.salas.get(d.codigo).partida.revisao,1);
 const passo=esperar(h,'partida:estado',v=>v.revisao===2);
 assert((await pedir(outro,'sala:retomar',{...d.tokenB,modo:'coop'})).ok);await passo;
 assert.equal(store.dados.get(d.codigo).partida.revisao,2);
});
test('primeira jogada da máquina aguarda o prazo do aviso e as seguintes mantêm pausa própria', {timeout:12000},async t=>{
 const a=await ambiente(t,memoria(),{tempoIA:30,tempoAvisoIA:180}),d=await duelo(a,'coop'),sala=a.controle.salas.get(d.codigo);
 const passo=esperar(d.host,'partida:estado',v=>v.revisao===2);
 assert((await pedir(d.host,'partida:acao',{tipo:'encerrar',revisao:0})).ok);
 await new Promise(r=>setTimeout(r,90));assert.equal(sala.partida.revisao,1,'não joga enquanto o aviso está no prazo');
 await passo;assert.equal(sala.partida.estado.acoes,1);
 const seguinte=esperar(d.host,'partida:estado',v=>v.revisao===3);await seguinte;assert.equal(sala.partida.estado.acoes,0);
});
test('armazenamento MySQL usa parâmetros e serializa atualizações na ordem',async()=>{
 const linhas=new Map(),chamadas=[];const pool={async query(sql,args){chamadas.push({sql,args});if(sql.startsWith('SELECT'))return [[...linhas].map(([codigo,estado])=>({codigo,estado}))];if(sql.startsWith('INSERT'))linhas.set(args[0],args[1]);if(sql.startsWith('DELETE'))linhas.delete(args[0]);return [[]];}};
 const store=criarArmazenamento(pool);await Promise.all([store.salvar({codigo:'ABCDE',valor:1}),store.salvar({codigo:'ABCDE',valor:2})]);
 assert.deepEqual(await store.carregar(),[{codigo:'ABCDE',valor:2}]);assert(chamadas.some(c=>c.sql.includes('CREATE TABLE IF NOT EXISTS arena_sessoes')));
 assert(chamadas.filter(c=>c.sql.startsWith('INSERT')).every(c=>c.sql.includes('VALUES (?, ?)')));await store.excluir('ABCDE');assert.deepEqual(await store.carregar(),[]);
});
