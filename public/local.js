// Usa o mesmo motor, IA e mesa do online, sem abrir conexão com o servidor.
(function(){
    'use strict';
    const $=id=>document.getElementById(id),eventos=new Map();
    let modo=null,cartas=(window.CARTAS_OFFLINE||[]).map(Motor.normalizarCarta),partida=null,humanoAtual=0,timer,sessao=0;
    const disparar=(nome,dados)=>{for(const fn of eventos.get(nome)||[])fn(dados);};
    function voltar(){sessao++;clearTimeout(timer);partida=null;mesa.limpar();$('passar-local').hidden=true;$('config-local').hidden=false;document.body.classList.remove('em-partida');window.scrollTo(0,0);}
    function mostrar(){if(partida)disparar('partida:estado',partida.visao('local'+humanoAtual));}
    function proximo(){
        if(!partida)return;
        if(partida.estado.vencedor!==null){mostrar();return;}
        const indice=partida.estado.turno;
        if(partida.estado.jogadores[indice].maquina){
            mostrar();const geracao=sessao;
            timer=setTimeout(()=>{if(geracao!==sessao||!partida)return;partida.jogarComputador();proximo();},350);return;
        }
        if(indice!==humanoAtual){humanoAtual=indice;mesa.limpar();$('vez-local').textContent='Vez de '+partida.estado.jogadores[indice].nome;$('passar-local').hidden=false;}
        else mostrar();
    }
    const transporte={
        on(nome,fn){if(!eventos.has(nome))eventos.set(nome,[]);eventos.get(nome).push(fn);},
        timeout(){return this;},
        emit(nome,dados,cb){
            if(nome==='partida:sincronizar'){mostrar();return;}
            if(nome==='partida:revanche'){voltar();cb?.(null,{ok:true});return;}
            if(nome!=='partida:acao'||!partida)return;
            const res=partida.agir('local'+humanoAtual,dados);
            if(res.ok)proximo();
            cb?.(null,res);
        }
    };
    const mesa=criarMesaOnline(transporte,{compartilhada:true,aoMostrar(){$('config-local').hidden=true;document.body.classList.add('em-partida');},aoSair:voltar});
    const representantes=()=>cartas.filter(c=>Motor.norm(c.classe)==='representante');
    function resumo(){
        if(!modo)return;
        const n=Number($('quantidade-local').value),participantes=modo==='maquina'?2*n:n;
        const total=Motor.tamanhoParaParticipantes(Number($('baralho-local').value),participantes);
        $('resumo-local').textContent=`${modo==='maquina'?n+' pessoa(s) × '+n+' máquina(s)':n+' pessoas, todos contra todos'} · ${total} cartas únicas · no mínimo 5 por participante, incluindo as 3 da mão inicial.${total!==Number($('baralho-local').value)?' Total ajustado automaticamente.':''}`;
    }
    function formularios(){
        const anteriores=[...$('participantes-local').querySelectorAll('fieldset')].map(f=>({nome:f.querySelector('input').value,rep:f.querySelector('select').value}));
        $('participantes-local').replaceChildren();
        for(let i=0;i<Number($('quantidade-local').value);i++){
            const f=document.createElement('fieldset');f.className='j-cfg';const legend=document.createElement('legend');legend.textContent='Jogador '+(i+1);f.append(legend);
            const label=document.createElement('label');label.htmlFor='nome-local-'+i;label.textContent='Apelido';const input=document.createElement('input');input.id=label.htmlFor;input.maxLength=20;input.placeholder='Jogador '+(i+1);input.value=anteriores[i]?.nome||'';
            const lr=document.createElement('label');lr.htmlFor='rep-local-'+i;lr.textContent='Representante (opcional)';const select=document.createElement('select');select.id=lr.htmlFor;select.add(new Option('Sem representante',''));representantes().forEach(c=>select.add(new Option(c.nome,c.codigo)));select.value=anteriores[i]?.rep||'';
            const info=document.createElement('p');info.className='suave rep-info';const atualizar=()=>{const r=representantes().find(c=>c.codigo===select.value);info.textContent=r?Motor.descricao(r).texto:'Sem bônus de representante.';};select.onchange=atualizar;atualizar();
            f.append(label,input,lr,select,info);$('participantes-local').append(f);
        }
        resumo();
    }
    function escolher(tipo){modo=tipo;for(const t of ['maquina','pessoas'])$('modo-'+t).setAttribute('aria-pressed',String(t===tipo));$('opcoes-local').hidden=false;$('campo-dificuldade-local').hidden=tipo!=='maquina';$('quantidade-local').replaceChildren();for(let i=tipo==='maquina'?1:2;i<=4;i++)$('quantidade-local').add(new Option(String(i),String(i)));formularios();}
    $('modo-maquina').onclick=()=>escolher('maquina');$('modo-pessoas').onclick=()=>escolher('pessoas');$('quantidade-local').onchange=formularios;$('baralho-local').onchange=resumo;
    $('confirmar-local').onclick=()=>{$('passar-local').hidden=true;mostrar();};
    $('comecar-local').onclick=()=>{
        $('erro-local').textContent='';
        try{
            const jogadores=[...$('participantes-local').querySelectorAll('fieldset')].map((f,i)=>({id:'local'+i,nome:f.querySelector('input').value.trim()||'Jogador '+(i+1),representante:f.querySelector('select').value||null}));
            partida=new Partida(jogadores,cartas,modo==='maquina'?'coop':'local',Number($('baralho-local').value),{dificuldade:$('dificuldade-local').value});
            humanoAtual=partida.estado.turno;sessao++;
            if(jogadores.length>1){mesa.limpar();$('config-local').hidden=true;$('vez-local').textContent='Vez de '+partida.estado.jogadores[humanoAtual].nome;$('passar-local').hidden=false;}
            else mostrar();
        }catch(err){partida=null;$('erro-local').textContent=err.message;}
    };
    (async()=>{
        try{const r=await fetch(`${typeof API==='string'?API:''}/cartas`,{signal:AbortSignal.timeout(2500)});const lista=await r.json();if(r.ok&&Array.isArray(lista)&&lista.length)cartas=lista.map(Motor.normalizarCarta);}catch{/* cópia embutida */}
        $('fonte-local').textContent='Cartas disponíveis: '+cartas.filter(c=>Motor.norm(c.classe)!=='representante').length+'. O modo Local funciona sem servidor com a cópia embutida.';
        $('comecar-local').disabled=false;if(modo)formularios();
    })();
})();
