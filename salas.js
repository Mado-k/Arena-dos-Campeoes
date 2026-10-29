// Salas e sessões retomáveis. O token privado nunca entra no estado público.
const {randomInt,randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const Partida=require('./partida');
const Motor=require('./public/motor');
const IA=require('./public/ia');
const RITMO=require('./public/ritmo');
const MODOS=new Set(['multiplayer','coop']);
const ALFABETO='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const hash=token=>createHash('sha256').update(token).digest('hex');
const limparNome=nome=>String(nome||'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,20);
function novoCodigo(salas){let codigo;do{codigo=Array.from({length:5},()=>ALFABETO[randomInt(ALFABETO.length)]).join('');}while(salas.has(codigo));return codigo;}
function publico(sala){
  const participantes=sala.modo==='coop'?sala.jogadores.length*2:Math.max(sala.min,sala.jogadores.length);
  const total=Motor.tamanhoParaParticipantes(sala.tamanhoBaralho,participantes);
  return {
  codigo:sala.codigo,modo:sala.modo,dificuldade:sala.dificuldade,formato:sala.formato||'livre',
  tamanhoBaralho:total,participantes,cartasPorParticipante:total/participantes,
  tamanhoBaralhoEscolhido:sala.tamanhoBaralho,maquinas:sala.modo==='coop'?sala.jogadores.length:0,
  max:sala.max,min:sala.min,anfitriao:sala.anfitriao,iniciando:Boolean(sala.iniciando),emPartida:Boolean(sala.partida),
  jogadores:sala.jogadores.map(j=>({id:j.id,nome:j.nome,pronto:j.pronto,conectado:j.conectado,representante:j.representante||null}))
};}
function mensagemInicio(err){
  if(err.code==='TEMPO_CARTAS_ESGOTADO')return 'O banco demorou demais para carregar as cartas. Confira a conexão com o Aiven nos Logs do Render e tente novamente.';
  if(['CARTAS_INSUFICIENTES','REPRESENTANTE_INVALIDO'].includes(err.code))return err.message;
  if(['HANDSHAKE_SSL_ERROR','SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','CERT_HAS_EXPIRED'].includes(err.code))return 'O servidor não conseguiu validar o certificado do banco. Confira o certificado CA do Aiven nas configurações do Render (DB_CA_CERT ou DB_CA_FILE).';
  if(err.code==='ER_ACCESS_DENIED_ERROR')return 'O banco recusou o acesso do servidor. Confira usuário e senha do banco nas configurações do Render.';
  if(err.code==='ER_BAD_DB_ERROR')return 'O banco configurado não existe. Confira DB_NAME no Render.';
  if(err.code==='ER_NO_SUCH_TABLE')return 'A tabela de cartas não existe no banco configurado. Prepare a tabela e execute o seed.js nesse banco.';
  return 'Não foi possível carregar as cartas do banco. Confira os Logs do serviço no Render para identificar a causa.';
}
function mensagemSessoes(err){
  if(err.code==='TEMPO_SESSOES_ESGOTADO')return 'O servidor ainda está recuperando as salas. Aguarde alguns segundos e tente novamente.';
  if(['ER_TABLEACCESS_DENIED_ERROR','ER_DBACCESS_DENIED_ERROR'].includes(err.code))return 'O banco negou acesso à tabela de sessões (arena_sessoes). Confira as permissões do usuário do banco nos Logs do Render.';
  if(['ETIMEDOUT','ECONNREFUSED','ENOTFOUND','EAI_AGAIN','PROTOCOL_CONNECTION_LOST'].includes(err.code))return 'O servidor está conectado, mas não conseguiu acessar o banco de sessões. Confira a conexão com o Aiven nos Logs do Render e tente novamente.';
  if(['HANDSHAKE_SSL_ERROR','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','CERT_HAS_EXPIRED','ER_ACCESS_DENIED_ERROR','ER_BAD_DB_ERROR'].includes(err.code))return mensagemInicio(err);
  return 'Não foi possível preparar ou salvar as salas no banco. Confira os Logs do Render e tente novamente.';
}
async function carregarComPrazo(loader,prazo,codigo='TEMPO_CARTAS_ESGOTADO'){let timer;try{return await Promise.race([Promise.resolve().then(loader),new Promise((_,r)=>{timer=setTimeout(()=>r(Object.assign(Error('Tempo esgotado'),{code:codigo})),prazo);})]);}finally{clearTimeout(timer);}}
module.exports=function iniciarSalas(io,carregarCartas,{tempoCarregamento=20000,tempoReconexao=10*60*1000,armazenamento=null,tempoInicializacao=6000,tempoIA=RITMO.entreAcoesIA,tempoAvisoIA=RITMO.inicioIA}={}){
  const salas=new Map(),timers=new Map(),timersIA=new Map(),iniciosIA=new WeakMap();
  const snapshot=sala=>({...sala,salvando:false,revanche:[...(sala.revanche||[])],iniciando:false,partida:sala.partida?.salvar()||null});
  const espectador=(sala,j)=>Boolean(sala.partida?.estado.torneio && sala.partida.estado.jogadores[sala.partida.ids.indexOf(j.id)]?.eliminado);
  const presentes=sala=>sala.jogadores.filter(j=>!espectador(sala,j));
  async function persistir(sala){if(armazenamento)await armazenamento.salvar(snapshot(sala));}
  function pausa(sala){const terminou=sala.partida&&sala.partida.estado.vencedor!==null;io.to(sala.codigo).emit('partida:pausa',{pausada:!terminou&&presentes(sala).some(j=>!j.conectado),ausentes:terminou?[]:presentes(sala).filter(j=>!j.conectado).map(j=>j.nome),prazoMs:tempoReconexao});}
  function publicar(sala){io.to(sala.codigo).emit('sala',publico(sala));pausa(sala);}
  function atualizarPartida(sala){pausa(sala);for(const j of sala.jogadores)if(j.conectado&&j.socketId)io.to(j.socketId).emit('partida:estado',sala.partida.visao(j.id));}
  async function removerSala(sala,motivo){
    clearTimeout(timers.get(sala.codigo));timers.delete(sala.codigo);clearTimeout(timersIA.get(sala.codigo));timersIA.delete(sala.codigo);salas.delete(sala.codigo);
    io.to(sala.codigo).emit('partida:encerrada',{motivo,final:true});
    if(armazenamento)await armazenamento.excluir(sala.codigo);
  }
  function agendar(sala){
    clearTimeout(timers.get(sala.codigo));
    const ausentes=presentes(sala).filter(j=>!j.conectado);
    if(!ausentes.length){timers.delete(sala.codigo);return;}
    const prazo=Math.max(0,Math.min(...ausentes.map(j=>j.desconectadoEm+tempoReconexao))-Date.now());
    const timer=setTimeout(()=>{removerSala(sala,'O prazo para reconectar terminou. A partida foi encerrada.').catch(err=>console.error('Falha ao encerrar sessão:',err.code||err.message));},prazo);
    timer.unref?.();timers.set(sala.codigo,timer);
  }
  function cancelarIA(sala){clearTimeout(timersIA.get(sala.codigo));timersIA.delete(sala.codigo);}
  function agendarIA(sala){
    const p=sala.partida;
    if(timersIA.has(sala.codigo)||!p||p.estado.vencedor!==null||!p.estado.jogadores[p.estado.turno].maquina||presentes(sala).some(j=>!j.conectado))return;
    let inicio=iniciosIA.get(p);
    if(!inicio||inicio.turno!==p.estado.numTurno){inicio={turno:p.estado.numTurno,ate:Date.now()+tempoAvisoIA};iniciosIA.set(p,inicio);}
    const espera=Math.max(tempoIA,inicio.ate-Date.now());
    const timer=setTimeout(async()=>{
      timersIA.delete(sala.codigo);
      if(salas.get(sala.codigo)!==sala||sala.partida!==p||presentes(sala).some(j=>!j.conectado))return;
      if(sala.salvando){agendarIA(sala);return;}
      const antes=p.salvar();sala.salvando=true;
      try{
        if(!p.passoComputador())return;
        sala.atualizadoEm=Date.now();await persistir(sala);
        if(sala.partida===p)atualizarPartida(sala);
      }catch(err){if(sala.partida===p)sala.partida=Partida.restaurar(antes);console.error('Falha ao salvar jogada da máquina:',err.code||err.message);}
      finally{sala.salvando=false;agendarIA(sala);}
    },espera);
    timer.unref?.();timersIA.set(sala.codigo,timer);
  }
  const recuperarSessoes=async()=>{
    if(!armazenamento)return;
    for(const dados of await armazenamento.carregar()){
      if(!dados||!MODOS.has(dados.modo)||!Array.isArray(dados.jogadores)||!dados.jogadores.length)continue;
      if(Date.now()-(dados.atualizadoEm||0)>24*60*60*1000){await armazenamento.excluir(dados.codigo);continue;}
      if(salas.has(dados.codigo))continue;
      try{
        const sala={...dados,max:4,salvando:false,iniciando:false,revanche:new Set(dados.revanche||[]),partida:dados.partida?Partida.restaurar(dados.partida):null};
        sala.jogadores.forEach(j=>{j.conectado=false;j.socketId=null;j.desconectadoEm=Date.now();});
        salas.set(sala.codigo,sala);agendar(sala);
      }catch{console.error('Sessão salva inválida ignorada:',dados.codigo);}
    }
  };
  let inicializacao=null,falhou=false;
  function prepararSalas(){
    if(!inicializacao||falhou){
      falhou=false;inicializacao=recuperarSessoes();
      inicializacao.catch(err=>{falhou=true;console.error('Não foi possível recuperar as sessões:',err.code||err.message);});
    }
    return inicializacao;
  }
  const pronto=prepararSalas();
  io.on('connection',socket=>{
    const resposta=cb=>typeof cb==='function'?cb:()=>{};
    const salaAtual=()=>salas.get(socket.data.sala);
    const jogadorAtual=sala=>sala?.jogadores.find(j=>j.id===socket.data.jogadorId&&j.socketId===socket.id);
    async function sair(){
      const sala=salaAtual(),j=jogadorAtual(sala);
      socket.data.sala=null;socket.data.jogadorId=null;
      if(!sala||!j)return;
      socket.leave(sala.codigo);
      if((sala.partida&&sala.partida.estado.vencedor===null&&!espectador(sala,j))||sala.iniciando){
        cancelarIA(sala);sala.partida=null;sala.iniciando=false;
        io.to(sala.codigo).emit('partida:encerrada',{motivo:'Um jogador abandonou a partida. Preparem uma nova partida.'});
      }
      sala.jogadores=sala.jogadores.filter(x=>x!==j);
      if(sala.partida){sala.revanche=new Set();io.to(sala.codigo).emit('partida:revanche',{indisponivel:true});}
      if(!sala.jogadores.length)return removerSala(sala,'A sala foi encerrada.');
      if(sala.anfitriao===j.id)sala.anfitriao=sala.jogadores[0].id;
      sala.jogadores.forEach(x=>{x.pronto=false;});sala.atualizadoEm=Date.now();
      await persistir(sala);publicar(sala);agendar(sala);
    }
    async function entrar(sala,nome){
      const token=randomBytes(32).toString('hex');
      const j={id:socket.id,socketId:socket.id,nome,pronto:false,conectado:true,tokenHash:hash(token),desconectadoEm:null};
      sala.jogadores.push(j);sala.atualizadoEm=Date.now();
      socket.join(sala.codigo);socket.data.sala=sala.codigo;socket.data.jogadorId=j.id;
      await persistir(sala);
      socket.emit('sessao',{codigo:sala.codigo,token,jogadorId:j.id,nome:j.nome,modo:sala.modo});
      publicar(sala);
    }
    let operacoes=Promise.resolve();
    function tratar(evento,fn){
      socket.on(evento,(dados,cb)=>{
        operacoes=operacoes.then(async()=>{
          const responder=resposta(cb);
          try{
            // A falha de inicialização precisa chegar ao callback do navegador.
            await carregarComPrazo(prepararSalas,tempoInicializacao,'TEMPO_SESSOES_ESGOTADO');
            await fn(dados,responder);
          }catch(err){
            console.error('Falha na sala:',err.code||err.message);
            responder({erro:mensagemSessoes(err),codigo:err.code||'SESSOES_INDISPONIVEIS'});
          }
        });
      });
    }
    tratar('sala:criar',async(dados,responder)=>{
      const nome=limparNome(dados?.nome);if(!MODOS.has(dados?.modo))return responder({erro:'Modo de jogo inválido.'});
      if(!nome)return responder({erro:'Escolha um apelido.'});
      const total=dados.tamanhoBaralho??40,dificuldade=dados.dificuldade??'normal';
      if(![20,30,40].includes(total))return responder({erro:'Escolha 20, 30 ou 40 cartas no total.'});
      if(!IA.NIVEIS.includes(dificuldade))return responder({erro:'Dificuldade inválida.'});
      await sair();
      const sala={codigo:novoCodigo(salas),modo:dados.modo,formato:'livre',dificuldade,tamanhoBaralho:total,max:4,min:dados.modo==='coop'?1:2,anfitriao:socket.id,jogadores:[],atualizadoEm:Date.now()};
      salas.set(sala.codigo,sala);await entrar(sala,nome);responder({ok:true,sala:publico(sala)});
    });
    tratar('sala:entrar',async(dados,responder)=>{
      const codigo=String(dados?.codigo||'').toUpperCase(),nome=limparNome(dados?.nome),sala=salas.get(codigo);
      if(!nome)return responder({erro:'Escolha um apelido.'});if(!sala)return responder({erro:'Sala não encontrada. Confira o código.'});
      if(sala.partida||sala.iniciando)return responder({erro:'Essa sala já está em partida.'});
      if(sala.modo!==dados.modo)return responder({erro:'Essa sala é de outro modo de jogo.'});
      if(jogadorAtual(sala))return responder({ok:true,sala:publico(sala)});
      if(sala.jogadores.length>=sala.max)return responder({erro:'A sala está cheia.'});
      await sair();sala.jogadores.forEach(j=>{j.pronto=false;});await entrar(sala,nome);responder({ok:true,sala:publico(sala)});
    });
    tratar('sala:retomar',async(dados,responder)=>{
      if(typeof dados?.token!=='string'||!/^\w{64}$/.test(dados.token))return responder({erro:'Sessão inválida.'});
      const sala=salas.get(String(dados.codigo||'').toUpperCase());
      if(!sala)return responder({erro:'A sessão expirou ou a sala foi encerrada.',expirada:true});
      const tokenHash=hash(dados.token),j=sala.jogadores.find(x=>x.tokenHash&&timingSafeEqual(Buffer.from(x.tokenHash,'hex'),Buffer.from(tokenHash,'hex')));
      if(!j||sala.modo!==dados.modo)return responder({erro:'Não foi possível identificar sua sessão.',expirada:true});
      if(j.conectado&&j.socketId!==socket.id)return responder({erro:'Essa sessão já está aberta em outra aba.'});
      if(!j.conectado&&Date.now()-j.desconectadoEm>=tempoReconexao)return responder({erro:'O prazo para reconectar terminou.',expirada:true});
      j.socketId=socket.id;j.conectado=true;j.desconectadoEm=null;sala.atualizadoEm=Date.now();
      socket.data.sala=sala.codigo;socket.data.jogadorId=j.id;socket.join(sala.codigo);
      await persistir(sala);agendar(sala);
      socket.emit('sessao',{codigo:sala.codigo,token:dados.token,jogadorId:j.id,nome:j.nome,modo:sala.modo});
      publicar(sala);if(sala.partida)atualizarPartida(sala);agendarIA(sala);responder({ok:true,sala:publico(sala)});
    });
    tratar('sala:formato',async(formato,responder)=>{
      const sala=salaAtual(),j=jogadorAtual(sala);
      if(!j||sala.anfitriao!==j.id||sala.modo!=='multiplayer')return responder({erro:'Só o anfitrião do multiplayer pode escolher o formato.'});
      if(sala.partida||sala.iniciando)return responder({erro:'Escolha o formato antes de iniciar.'});
      if(!['livre','2v2'].includes(formato))return responder({erro:'Formato inválido.'});
      sala.formato=formato;sala.min=formato==='2v2'?4:2;sala.jogadores.forEach(x=>{x.pronto=false;});
      await persistir(sala);publicar(sala);responder({ok:true,sala:publico(sala)});
    });
    tratar('sala:baralho',async(total,responder)=>{
      const sala=salaAtual(),j=jogadorAtual(sala);
      if(!j||sala.anfitriao!==j.id)return responder({erro:'Só o anfitrião pode alterar o total de cartas.'});
      if(sala.partida||sala.iniciando)return responder({erro:'Altere o total de cartas antes de iniciar a partida.'});
      if(![20,30,40].includes(total))return responder({erro:'Escolha 20, 30 ou 40 cartas no total.'});
      if(sala.tamanhoBaralho!==total){
        sala.tamanhoBaralho=total;sala.jogadores.forEach(x=>{x.pronto=false;});sala.atualizadoEm=Date.now();
        await persistir(sala);publicar(sala);
      }
      responder({ok:true,sala:publico(sala)});
    });
    tratar('sala:pronto',async(valor,responder)=>{
      const sala=salaAtual(),j=jogadorAtual(sala);if(!j||sala.partida||sala.iniciando)return responder({erro:'Não é possível alterar a prontidão fora de uma sala disponível.'});
      j.pronto=Boolean(valor);sala.atualizadoEm=Date.now();await persistir(sala);publicar(sala);responder({ok:true});
    });
    tratar('sala:representante',async(codigo,responder)=>{
      const sala=salaAtual(),j=jogadorAtual(sala);
      if(!j||sala.partida||sala.iniciando)return responder({erro:'Escolha seu representante antes de iniciar a partida.'});
      if(codigo!==null&&(typeof codigo!=='string'||!/^[a-z0-9_-]{1,32}$/i.test(codigo)))return responder({erro:'Representante inválido.'});
      j.representante=codigo;sala.jogadores.forEach(x=>{x.pronto=false;});sala.atualizadoEm=Date.now();await persistir(sala);publicar(sala);responder({ok:true});
    });
    tratar('partida:iniciar',async(_,responder)=>{
      const sala=salaAtual(),j=jogadorAtual(sala);
      if(!j||sala.anfitriao!==j.id)return responder({erro:'Só o anfitrião pode iniciar.'});
      if(sala.partida||sala.iniciando)return responder({erro:'A partida já está iniciando ou em andamento.'});
      if(sala.jogadores.length<sala.min||!sala.jogadores.every(x=>x.pronto&&x.conectado))return responder({erro:'Aguarde todos os jogadores ficarem prontos.'});
      sala.iniciando=true;const ids=sala.jogadores.map(x=>x.id).join(',');publicar(sala);
      try{
        const cartas=await carregarComPrazo(carregarCartas,tempoCarregamento);
        if(!sala.iniciando||!salas.has(sala.codigo)||ids!==sala.jogadores.map(x=>x.id).join(',')||sala.jogadores.some(x=>!x.conectado)){
          sala.iniciando=false;publicar(sala);return responder({erro:'Os jogadores da sala mudaram. Tente novamente.'});
        }
        sala.partida=new Partida(sala.jogadores,cartas,sala.modo,sala.tamanhoBaralho,{dificuldade:sala.dificuldade,formato:sala.formato||'livre'});
        sala.revanche=new Set();sala.iniciando=false;sala.atualizadoEm=Date.now();await persistir(sala);publicar(sala);atualizarPartida(sala);responder({ok:true});
      }catch(err){sala.partida=null;sala.iniciando=false;publicar(sala);console.error('Não foi possível iniciar a partida:',err.code||err.message);responder({erro:mensagemInicio(err),codigo:err.code||'FALHA_INICIO_PARTIDA'});}
    });
    let janela=0,quantidade=0;
    tratar('partida:acao',async(dados,responder)=>{
      const agora=Date.now();if(agora-janela>1000){janela=agora;quantidade=0;}if(++quantidade>30)return responder({erro:'Muitas ações. Aguarde um instante.'});
      const sala=salaAtual(),j=jogadorAtual(sala);if(!j||!sala.partida)return responder({erro:'Não há partida em andamento.'});
      if(presentes(sala).some(x=>!x.conectado))return responder({erro:'A partida está pausada. Aguardando reconexão.'});
      if(sala.salvando)return responder({erro:'Aguardando a confirmação da ação anterior.'});
      const antes=sala.partida.salvar(),res=sala.partida.agir(j.id,dados);
      if(res.ok){
        sala.salvando=true;
        try{sala.atualizadoEm=Date.now();await persistir(sala);}
        catch(err){sala.partida=Partida.restaurar(antes);throw err;}
        finally{sala.salvando=false;}
      }
      if(!res.pergunta)atualizarPartida(sala);agendarIA(sala);responder(res);
    });
    socket.on('partida:sincronizar',()=>{const sala=salaAtual();if(jogadorAtual(sala)&&sala.partida)atualizarPartida(sala);});
    tratar('partida:revanche',async(aceitar,responder)=>{
      const sala=salaAtual(),j=jogadorAtual(sala);
      if(!j||!sala.partida||sala.partida.estado.vencedor===null)return responder({erro:'A partida ainda não terminou.'});
      if(sala.jogadores.length!==sala.partida.ids.length)return responder({erro:'Um jogador saiu. Volte ao lobby para preparar outra partida.'});
      if(typeof aceitar!=='boolean')return responder({erro:'Resposta inválida.'});
      sala.revanche=sala.revanche||new Set();if(aceitar)sala.revanche.add(j.id);
      if(!aceitar||sala.revanche.size===sala.jogadores.length){
        cancelarIA(sala);
        const empatou=sala.partida.estado.vencedor===-1;
        sala.partida=null;sala.revanche=new Set();sala.jogadores.forEach(x=>{x.pronto=false;});
        io.to(sala.codigo).emit('partida:encerrada',{empate:empatou,revanche:aceitar,motivo:aceitar?'Todos aceitaram jogar novamente. Confiram os representantes e fiquem prontos.':'A partida foi encerrada.'});
        await persistir(sala);publicar(sala);
      }else{await persistir(sala);io.to(sala.codigo).emit('partida:revanche',{votos:sala.revanche.size,total:sala.jogadores.length});}
      responder({ok:true});
    });
    tratar('sala:sair',async(_,responder)=>{await sair();responder({ok:true});});
    socket.on('disconnect',()=>{
      const sala=salaAtual(),j=jogadorAtual(sala);if(!j)return;
      j.conectado=false;j.socketId=null;j.desconectadoEm=Date.now();sala.atualizadoEm=Date.now();
      if(sala.iniciando)sala.iniciando=false;
      publicar(sala);agendar(sala);persistir(sala).catch(err=>console.error('Falha ao salvar desconexão:',err.code||err.message));
    });
  });
  return {pronto,salas,fechar(){for(const timer of [...timers.values(),...timersIA.values()])clearTimeout(timer);timers.clear();timersIA.clear();}};
};
