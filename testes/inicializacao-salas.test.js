const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {once}=require('node:events'),{Server}=require('socket.io'),{io:conectar}=require('socket.io-client');
const iniciar=require('../salas'),criarArmazenamento=require('../armazenamento-partidas');
async function ambiente(t,armazenamento,opcoes={}){
 const s=http.createServer(),io=new Server(s),controle=iniciar(io,async()=>[],{armazenamento,...opcoes});
 // Falhas de inicialização são esperadas nestes cenários e não devem derrubar o socket.
 io.on('connection',socket=>socket.on('error',()=>{}));
 s.listen(0,'127.0.0.1');await once(s,'listening');
 const c=conectar('http://127.0.0.1:'+s.address().port,{transports:['websocket'],reconnection:false});
 t.after(async()=>{c.close();await new Promise(r=>io.close(r));controle.fechar();});await once(c,'connect');
 return {c,controle};
}
const pedir=(c,evento,dados)=>new Promise((resolve,reject)=>c.timeout(700).emit(evento,dados,(err,res)=>err?reject(err):resolve(res)));
const dados={modo:'multiplayer',nome:'Pessoa',tamanhoBaralho:20};
test('falha ao recuperar sessões responde ao pedido e permite tentar novamente',async t=>{
 let falhar=true,leituras=0;const store={async carregar(){leituras++;if(falhar)throw Object.assign(Error('Sem acesso'),{code:'ER_TABLEACCESS_DENIED_ERROR'});return [];},async salvar(){},async excluir(){}};
 const {c,controle}=await ambiente(t,store);
 const erro=await pedir(c,'sala:criar',dados);assert(erro.erro);assert.match(erro.erro,/sess|salas/i);assert.equal(controle.salas.size,0);
 falhar=false;const res=await pedir(c,'sala:criar',dados);assert(res.ok);assert.equal(controle.salas.size,1);assert(leituras>=2);
});
test('recuperação pendente retorna resposta antes do timeout do navegador, sem executar pedido depois',async t=>{
 let concluir;const store={carregar:()=>new Promise(r=>{concluir=r;}),async salvar(){},async excluir(){}};
 const {c,controle}=await ambiente(t,store,{tempoInicializacao:30});
 const res=await pedir(c,'sala:criar',dados);assert(res.erro);assert.equal(res.codigo,'TEMPO_SESSOES_ESGOTADO');assert.equal(controle.salas.size,0);
 concluir([]);await controle.pronto;assert.equal(controle.salas.size,0);
 assert((await pedir(c,'sala:criar',dados)).ok);
});
test('armazenamento tenta criar a tabela novamente após falha temporária',async()=>{
 let falhar=true,tentativas=0;const pool={async query(sql){if(sql.startsWith('CREATE')){tentativas++;if(falhar)throw Error('Banco indisponível');}return [[]];}};
 const store=criarArmazenamento(pool);await assert.rejects(store.carregar());falhar=false;
 assert.deepEqual(await store.carregar(),[]);assert.equal(tentativas,2);
});
test('uma sessão com JSON inválido não impede recuperar outras sessões',async()=>{
 const pool={async query(sql){if(sql.startsWith('SELECT'))return [[{codigo:'RUIM1',estado:'{'},{codigo:'BOA12',estado:JSON.stringify({codigo:'BOA12',modo:'multiplayer'})}]];return [[]];}};
 const store=criarArmazenamento(pool);assert.deepEqual(await store.carregar(),[{codigo:'BOA12',modo:'multiplayer'}]);
});
test('sessão com estrutura inválida é ignorada sem apagar o registro e criar continua disponível',async t=>{
 let exclusoes=0;const store={async carregar(){return [{codigo:'RUIM2',modo:'multiplayer',jogadores:[{}],partida:{},atualizadoEm:Date.now()}];},async salvar(){},async excluir(){exclusoes++;}};
 const {c,controle}=await ambiente(t,store);await controle.pronto;
 assert((await pedir(c,'sala:pronto',true)).erro,'pedido fora do lobby também recebe resposta');
 assert((await pedir(c,'sala:criar',dados)).ok);assert.equal(controle.salas.size,1);assert.equal(exclusoes,0);
});
