// Usa o mesmo motor, IA e mesa do online, sem abrir conexão com o servidor.
(function(){
    'use strict';
    const $=id=>document.getElementById(id),eventos=new Map();
    let modo=null,cartas=(window.CARTAS_OFFLINE||[]).map(Motor.normalizarCarta),partida=null,humanoAtual=0,timer,sessao=0,ultimoTurnoIA=null;
    const configuracoesHumanos=[],representantesDasMaquinas=new Map();
    let carregandoCartas=true;
    const disparar=(nome,dados)=>{for(const fn of eventos.get(nome)||[])fn(dados);};
    function voltar(){sessao++;clearTimeout(timer);partida=null;mesa.limpar();$('passar-local').hidden=true;$('config-local').hidden=false;document.body.classList.remove('em-partida');window.scrollTo(0,0);}
    function mostrar(){if(partida)disparar('partida:estado',partida.visao('local'+humanoAtual));}
    function proximo(){
        if(!partida)return;
        if(partida.estado.vencedor!==null){mostrar();return;}
        const indice=partida.estado.turno;
        if(partida.estado.jogadores[indice].maquina){
            const chave=sessao+':'+partida.estado.numTurno;
            const primeira=ultimoTurnoIA!==chave;ultimoTurnoIA=chave;
            mostrar();const geracao=sessao;
            timer=setTimeout(()=>{if(geracao!==sessao||!partida)return;partida.passoComputador();proximo();},primeira?RITMO_ARENA.inicioIA:RITMO_ARENA.entreAcoesIA+Math.random()*250);return;
        }
        if(indice!==humanoAtual){humanoAtual=indice;mesa.limpar();$('vez-local').textContent='Vez de '+partida.estado.jogadores[indice].nome;$('passar-local').hidden=false;}
        else mostrar();
    }
    const transporte={
        on(nome,fn){if(!eventos.has(nome))eventos.set(nome,[]);eventos.get(nome).push(fn);},
        timeout(){return this;},
        emit(nome,dados,cb){
            if(nome==='partida:sincronizar'){mostrar();return;}
            if(nome==='partida:revanche'){
                if(!partida||partida.estado.vencedor===null){cb?.(null,{erro:'A partida ainda não terminou.'});return;}
                if(!dados){voltar();cb?.(null,{ok:true});return;}
                const reiniciar=()=>{sessao++;clearTimeout(timer);mesa.limpar();$('comecar-local').click();cb?.(null,{ok:true});};
                if(modo==='pessoas')confirmarRevanche(aceitou=>{if(aceitou)reiniciar();else cb?.(null,{erro:'Revanche não aceita. Você pode consultar o tabuleiro ou voltar ao lobby.'});});
                else reiniciar();
                return;
            }
            if(nome!=='partida:acao'||!partida)return;
            const res=partida.agir('local'+humanoAtual,dados);
            if(res.ok)proximo();
            cb?.(null,res);
        }
    };
    const mesa=criarMesaOnline(transporte,{compartilhada:true,aoMostrar(){$('config-local').hidden=true;document.body.classList.add('em-partida');},aoSair:voltar});
    function confirmarRevanche(concluir){
        const dialogo=document.createElement('dialog');dialogo.className='escolha-online resultado-partida';
        dialogo.setAttribute('aria-label','Confirmar revanche');
        const titulo=document.createElement('h2'),texto=document.createElement('p');
        texto.textContent='Passe o dispositivo para este jogador confirmar se deseja jogar novamente.';
        const aceitar=document.createElement('button'),recusar=document.createElement('button');
        aceitar.type=recusar.type='button';aceitar.className='btn primario';recusar.className='btn';
        aceitar.textContent='Aceitar revanche';recusar.textContent='Não jogar';
        let indice=0;
        const atualizar=()=>{titulo.textContent=partida.estado.jogadores[indice].nome+': aceita a revanche?';};
        function terminar(aceitou){dialogo.close();dialogo.remove();concluir(aceitou);}
        aceitar.onclick=()=>{if(++indice===partida.ids.length)terminar(true);else atualizar();};
        recusar.onclick=()=>terminar(false);dialogo.addEventListener('cancel',evento=>{evento.preventDefault();terminar(false);});
        const botoes=document.createElement('div');botoes.className='resultado-botoes';botoes.append(aceitar,recusar);
        dialogo.append(titulo,texto,botoes);document.body.append(dialogo);atualizar();dialogo.showModal();
    }
    const representantes=()=>cartas.filter(c=>Motor.norm(c.classe)==='representante');
    const formato=()=>$('formato-local').value;
    const humanos=()=>modo==='pessoas'||formato()==='coop'?Number($('quantidade-local').value):1;
    const tamanhoEquipe=()=>Number($('maquinas-equipe-local').value);
    const aliadas=()=>formato()==='coop'?Math.max(0,tamanhoEquipe()-humanos()):0;
    const maquinas=()=>modo==='pessoas'?0:formato()==='coop'?2*tamanhoEquipe()-humanos():formato()==='2v2'?3:Number($('quantidade-local').value);
    function representanteMaquina(chave){
        const lista=representantes(),anterior=representantesDasMaquinas.get(chave);
        if(!representantesDasMaquinas.has(chave)||(anterior!==null&&!lista.some(c=>c.codigo===anterior))){
            representantesDasMaquinas.set(chave,[null,...lista.map(c=>c.codigo)][Math.floor(Math.random()*(lista.length+1))]);
        }
        return representantesDasMaquinas.get(chave);
    }
    function chavesMaquinas(){
        return [...Array.from({length:aliadas()},(_,i)=>'aliada'+i),...Array.from({length:tamanhoEquipe()},(_,i)=>'adversaria'+i)];
    }
    function fichaMaquina(nome,chave,aliada=false){
        const ficha=document.createElement('article');ficha.className='j-cfg maquina-cfg'+(aliada?' maquina-aliada':'');
        const titulo=document.createElement('h3');titulo.textContent=nome;
        const rep=document.createElement('p');rep.className='representante-maquina';
        const codigo=representanteMaquina(chave);ficha.dataset.representante=codigo||'';
        rep.textContent=representantes().find(c=>c.codigo===codigo)?.nome||'Sem representante';
        const quantidade=document.createElement('p');quantidade.className='cartas-participante';quantidade.dataset.quantidade='';
        ficha.append(titulo,rep,quantidade);return ficha;
    }
    function ajustarTamanhoEquipe(){
        if(formato()!=='coop')return;
        const seletor=$('maquinas-equipe-local');
        if(Number(seletor.value)<humanos())seletor.value=String(humanos());
        for(const opcao of seletor.options)opcao.disabled=Number(opcao.value)<humanos();
    }
    function resumo(){
        if(!modo)return;
        const participantes=humanos()+maquinas(),pedido=Number($('baralho-local').value),total=Motor.tamanhoParaParticipantes(pedido,participantes),porPessoa=total/participantes;
        const descricao=formato()==='2v2'?'Duplas 2v2':formato()==='coop'?'Equipe contra máquinas':'Duelo individual · mata-mata';
        const composicao=formato()==='coop'?`${humanos()} pessoa(s)${aliadas()?' + '+aliadas()+' máquina(s) aliada(s)':''} contra ${tamanhoEquipe()} máquina(s)`:`${humanos()} pessoa(s) + ${maquinas()} máquina(s)`;
        $('resumo-local').textContent=`${descricao} · ${composicao} · ${total} cartas únicas.${total!==pedido?' Total ajustado de '+pedido+' para '+total+' para dividir igualmente e garantir pelo menos 5 por participante.':''}${formato()==='2v2'&&modo==='maquina'?' Você e a Máquina 2 contra as Máquinas 1 e 3.':''}`;
        for(const campo of $('opcoes-local').querySelectorAll('[data-quantidade]')){
            campo.textContent=`${porPessoa} cartas no início`;
            if(campo.closest('fieldset')){
                const divisao=document.createElement('small');divisao.textContent=`3 na mão · ${porPessoa-3} no baralho de compra`;campo.append(divisao);
            }
        }
        $('completar-equipe-local').hidden=formato()!=='coop';
        $('completar-equipe-local').textContent=aliadas()?`${aliadas()} vaga(s) da sua equipe será(ão) preenchida(s) automaticamente por máquinas ao iniciar. Cada equipe terá ${tamanhoEquipe()} invocador(es).`:`Sua equipe está completa: ${tamanhoEquipe()} pessoa(s) contra ${tamanhoEquipe()} máquina(s).`;
        const disponiveis=new Set(cartas.filter(c=>Motor.norm(c.classe)!=='representante').map(c=>c.codigo?String(c.codigo).trim().toLowerCase():c.numero??Motor.norm(c.nome))).size;
        const insuficiente=total>disponiveis;
        $('aviso-distribuicao-local').hidden=!insuficiente;
        $('aviso-distribuicao-local').textContent=insuficiente?`Esta divisão precisa de ${total} cartas únicas, mas há ${disponiveis} disponíveis. Escolha um total menor de cartas ou menos participantes.`:'';
        $('comecar-local').disabled=carregandoCartas||insuficiente;
    }
    function formularios(){
        for(const [i,f]of [...$('participantes-local').querySelectorAll('fieldset')].entries())configuracoesHumanos[i]={nome:f.querySelector('input').value,rep:f.querySelector('select').value};
        ajustarTamanhoEquipe();
        const equipe=formato()==='coop';
        $('opcoes-local').classList.toggle('config-equipes',equipe);
        $('equipe-adversaria-local').hidden=!equipe;
        $('titulo-aliados-local').hidden=!equipe;$('controle-pessoas-local').hidden=!equipe;
        (equipe?$('controle-pessoas-local'):$('controles-gerais-local')).append($('campo-quantidade-local'));
        $('maquinas-local').replaceChildren();$('participantes-local').replaceChildren();
        if(equipe)for(let i=0;i<tamanhoEquipe();i++)$('maquinas-local').append(fichaMaquina('Máquina '+(i+1),'adversaria'+i));
        for(let i=0;i<humanos();i++){
            const f=document.createElement('fieldset');f.className='j-cfg';const legend=document.createElement('legend');legend.textContent='Jogador '+(i+1);f.append(legend);
            const label=document.createElement('label');label.htmlFor='nome-local-'+i;label.textContent='Apelido';const input=document.createElement('input');input.id=label.htmlFor;input.maxLength=20;input.placeholder='Jogador '+(i+1);input.value=configuracoesHumanos[i]?.nome||'';
            const lr=document.createElement('label');lr.htmlFor='rep-local-'+i;lr.textContent='Representante (opcional)';const select=document.createElement('select');select.id=lr.htmlFor;select.add(new Option('Sem representante',''));representantes().forEach(c=>select.add(new Option(c.nome,c.codigo)));select.value=configuracoesHumanos[i]?.rep||'';
            const info=document.createElement('p');info.className='suave rep-info';const atualizar=()=>{const r=representantes().find(c=>c.codigo===select.value);info.textContent=r?Motor.descricao(r).texto:'Sem bônus de representante.';};select.onchange=atualizar;atualizar();
            const quantidade=document.createElement('p');quantidade.className='cartas-participante';quantidade.dataset.quantidade='';
            f.append(label,input,lr,select,info,quantidade);$('participantes-local').append(f);
        }
        if(equipe)for(let i=0;i<aliadas();i++)$('participantes-local').append(fichaMaquina('Máquina aliada '+(i+1),'aliada'+i,true));
        resumo();
    }
    function atualizarFormato(){
        const coop=$('formato-local').querySelector('option[value="coop"]');coop.hidden=modo!=='maquina';
        if(modo==='pessoas'&&formato()==='coop')$('formato-local').value='livre';
        const q=$('quantidade-local'),anterior=q.value;q.replaceChildren();
        if(formato()==='2v2')q.add(new Option(modo==='maquina'?'3 máquinas (4 invocadores)':'4 pessoas',modo==='maquina'?'3':'4'));
        else for(let i=modo==='pessoas'?2:1;i<=4;i++)q.add(new Option(String(i),String(i)));
        if([...q.options].some(o=>o.value===anterior))q.value=anterior;
        q.disabled=formato()==='2v2';
        $('quantidade-rotulo').textContent=modo==='pessoas'||formato()==='coop'?'Pessoas neste dispositivo':'Máquinas na partida';
        formularios();
    }
    function escolher(tipo){modo=tipo;for(const t of ['maquina','pessoas'])$('modo-'+t).setAttribute('aria-pressed',String(t===tipo));$('opcoes-local').hidden=false;$('campo-dificuldade-local').hidden=tipo!=='maquina';atualizarFormato();}
    $('modo-maquina').onclick=()=>escolher('maquina');$('modo-pessoas').onclick=()=>escolher('pessoas');$('quantidade-local').onchange=formularios;$('maquinas-equipe-local').onchange=formularios;$('baralho-local').onchange=resumo;$('formato-local').onchange=atualizarFormato;
    $('confirmar-local').onclick=()=>{$('passar-local').hidden=true;mostrar();};
    $('comecar-local').onclick=()=>{
        $('erro-local').textContent='';
        try{
            const jogadores=[...$('participantes-local').querySelectorAll('fieldset')].map((f,i)=>({id:'local'+i,nome:f.querySelector('input').value.trim()||'Jogador '+(i+1),representante:f.querySelector('select').value||null}));
            partida=new Partida(jogadores,cartas,formato()==='coop'?'coop':'local',Number($('baralho-local').value),{dificuldade:$('dificuldade-local').value,formato:formato()==='2v2'?'2v2':'livre',maquinas:formato()==='coop'?0:maquinas(),...(formato()==='coop'?{vagasEquipe:tamanhoEquipe(),representantesMaquinas:chavesMaquinas().map(representanteMaquina)}:{})});
            humanoAtual=partida.estado.turno;sessao++;
            if(jogadores.length>1){mesa.limpar();$('config-local').hidden=true;$('vez-local').textContent='Vez de '+partida.estado.jogadores[humanoAtual].nome;$('passar-local').hidden=false;}
            else mostrar();
        }catch(err){partida=null;$('erro-local').textContent=err.message;}
    };
    (async()=>{
        try{const r=await fetch(`${typeof API==='string'?API:''}/cartas`,{signal:AbortSignal.timeout(2500)});const lista=await r.json();if(r.ok&&Array.isArray(lista)&&lista.length)cartas=lista.map(Motor.normalizarCarta);}catch{/* cópia embutida */}
        $('fonte-local').textContent='Cartas disponíveis: '+cartas.filter(c=>Motor.norm(c.classe)!=='representante').length+'.';
        carregandoCartas=false;$('comecar-local').disabled=false;if(modo)formularios();
    })();
})();
