// Usa o mesmo motor, IA e mesa do online, sem abrir conexão com o servidor.
(function(){
    'use strict';
    const $=id=>document.getElementById(id),eventos=new Map();
    let modo=null,cartas=(window.CARTAS_OFFLINE||[]).map(Motor.normalizarCarta),partida=null,humanoAtual=0,timer,sessao=0,ultimoTurnoIA=null;
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
    const maquinas=()=>modo==='pessoas'?0:formato()==='coop'?humanos():formato()==='2v2'?3:Number($('quantidade-local').value);
    function resumo(){
        if(!modo)return;
        const participantes=humanos()+maquinas();
        const pedido=Number($('baralho-local').value),total=Motor.tamanhoParaParticipantes(pedido,participantes);
        const descripcion=formato()==='2v2'?'Duplas 2v2':formato()==='coop'?'Equipe contra máquinas':'Duelo individual · mata-mata';
        $('resumo-local').textContent=`${descripcion} · ${humanos()} pessoa(s) + ${maquinas()} máquina(s) · ${total} cartas únicas · ${total/participantes} por participante (3 na mão e ${total/participantes-3} na compra).${total!==pedido?' Total ajustado automaticamente.':''}${formato()==='2v2'&&modo==='maquina'?' Você e a Máquina 2 contra as Máquinas 1 e 3.':''}`;
    }
    function formularios(){
        const anteriores=[...$('participantes-local').querySelectorAll('fieldset')].map(f=>({nome:f.querySelector('input').value,rep:f.querySelector('select').value}));
        $('participantes-local').replaceChildren();
        for(let i=0;i<humanos();i++){
            const f=document.createElement('fieldset');f.className='j-cfg';const legend=document.createElement('legend');legend.textContent='Jogador '+(i+1);f.append(legend);
            const label=document.createElement('label');label.htmlFor='nome-local-'+i;label.textContent='Apelido';const input=document.createElement('input');input.id=label.htmlFor;input.maxLength=20;input.placeholder='Jogador '+(i+1);input.value=anteriores[i]?.nome||'';
            const lr=document.createElement('label');lr.htmlFor='rep-local-'+i;lr.textContent='Representante (opcional)';const select=document.createElement('select');select.id=lr.htmlFor;select.add(new Option('Sem representante',''));representantes().forEach(c=>select.add(new Option(c.nome,c.codigo)));select.value=anteriores[i]?.rep||'';
            const info=document.createElement('p');info.className='suave rep-info';const atualizar=()=>{const r=representantes().find(c=>c.codigo===select.value);info.textContent=r?Motor.descricao(r).texto:'Sem bônus de representante.';};select.onchange=atualizar;atualizar();
            f.append(label,input,lr,select,info);$('participantes-local').append(f);
        }
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
    $('modo-maquina').onclick=()=>escolher('maquina');$('modo-pessoas').onclick=()=>escolher('pessoas');$('quantidade-local').onchange=formularios;$('baralho-local').onchange=resumo;$('formato-local').onchange=atualizarFormato;
    $('confirmar-local').onclick=()=>{$('passar-local').hidden=true;mostrar();};
    $('comecar-local').onclick=()=>{
        $('erro-local').textContent='';
        try{
            const jogadores=[...$('participantes-local').querySelectorAll('fieldset')].map((f,i)=>({id:'local'+i,nome:f.querySelector('input').value.trim()||'Jogador '+(i+1),representante:f.querySelector('select').value||null}));
            partida=new Partida(jogadores,cartas,formato()==='coop'?'coop':'local',Number($('baralho-local').value),{dificuldade:$('dificuldade-local').value,formato:formato()==='2v2'?'2v2':'livre',maquinas:formato()==='coop'?0:maquinas()});
            humanoAtual=partida.estado.turno;sessao++;
            if(jogadores.length>1){mesa.limpar();$('config-local').hidden=true;$('vez-local').textContent='Vez de '+partida.estado.jogadores[humanoAtual].nome;$('passar-local').hidden=false;}
            else mostrar();
        }catch(err){partida=null;$('erro-local').textContent=err.message;}
    };
    (async()=>{
        try{const r=await fetch(`${typeof API==='string'?API:''}/cartas`,{signal:AbortSignal.timeout(2500)});const lista=await r.json();if(r.ok&&Array.isArray(lista)&&lista.length)cartas=lista.map(Motor.normalizarCarta);}catch{/* cópia embutida */}
        $('fonte-local').textContent='Cartas disponíveis: '+cartas.filter(c=>Motor.norm(c.classe)!=='representante').length+'.';
        $('comecar-local').disabled=false;if(modo)formularios();
    })();
})();
