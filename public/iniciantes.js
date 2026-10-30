(function(){
    'use strict';
    const $=id=>document.getElementById(id),eventos=new Map();
    let treino=null,timer,geracao=0,alvoPasso=null;
    const emitir=()=>{const v=treino.visao();for(const fn of eventos.get('partida:estado')||[])fn(v);atualizarGuia();};
    const transporte={on(n,fn){if(!eventos.has(n))eventos.set(n,[]);eventos.get(n).push(fn);},timeout(){return this;},emit(n,d,cb){
        if(n==='partida:sincronizar'){emitir();return;}
        if(n==='partida:revanche'){iniciar();cb?.(null,{ok:true});return;}
        if(n!=='partida:acao'||!treino)return;
        const res=treino.agir(d);if(res.ok){emitir();programarIA();}cb?.(null,res);
    }};
    const mesa=criarMesaOnline(transporte,{aoSair:()=>location.assign('index.html#modos'),aoConfirmarInicio:()=>atualizarGuia(),confirmarInicioTurno:e=>e.numTurno===1,exibirResultadoPadrao:false,aoAbrirDescarte:dono=>{if(treino?.consultarDescarte(dono))atualizarGuia();}});
    // Ritmo curto apenas nesta página, sem alterar partidas normais.
    RITMO_ARENA.avisoTurno=900;
    function iniciar(){
        clearTimeout(timer);geracao++;mesa.limpar();
        try{treino=new TreinoIniciante(window.CARTAS_OFFLINE);$('iniciar-treino').hidden=true;emitir();}
        catch(e){$('treino-erro').hidden=false;$('treino-erro').textContent=e.message;}
    }
    function programarIA(){
        if(!treino||treino.partida.estado.turno!==1||treino.partida.estado.vencedor!==null)return;
        clearTimeout(timer);const atual=geracao;
        timer=setTimeout(()=>{if(atual!==geracao)return;treino.passoComputador();emitir();programarIA();},1200);
    }
    function destino(){
        if(!treino||treino.partida.estado.turno!==0||treino.partida.estado.vencedor!==null)return null;
        const p=treino.etapa;if(!p)return null;
        const inicio=document.querySelector('.aviso-sua-vez[open]');
        if(inicio)return inicio.querySelector('button');
        const descarte=document.querySelector('.descarte-online[open]');
        if(descarte)return [...descarte.querySelectorAll('button')].find(b=>b.textContent==='Fechar');
        const confirmacao=document.querySelector('[aria-label="Confirmar eliminação"][open]');
        if(confirmacao)return [...confirmacao.querySelectorAll('button')].find(b=>b.textContent==='Confirmar eliminação');
        if(p.tipo==='comprar')return document.querySelector('.lado-ativo .pilha-comprar');
        if(p.tipo==='descarte')return document.querySelector('.lado-ativo .pilha-ver-descarte');
        if(p.tipo==='encerrar')return document.querySelector('.aviso-acoes[open] .acao-encerrar')||document.querySelector('.barra .acao-encerrar');
        const j=treino.partida.estado.jogadores[0],c=[...j.mao,...j.campo].find(c=>c.base.codigo===p.codigo);
        if(!c)return null;
        const carta=document.querySelector(`.lado-ativo .carta-online[data-carta="${c.uid}"]`);
        const nome=({invocar:'Colocar em batalha',apoio:'Colocar em apoio',equipar:'Equipar',atacar:'Atacar criatura inimiga',eliminar:'Eliminar carta'})[p.tipo];
        if(carta?.getAttribute('aria-pressed')==='true')return [...document.querySelectorAll('.detalhe-online button')].find(b=>b.textContent.startsWith(nome))||carta;
        return carta;
    }
    function destacar(){
        for(const n of document.querySelectorAll('.passo-destacado'))n.classList.remove('passo-destacado');
        alvoPasso=destino();alvoPasso?.classList.add('passo-destacado');
    }
    function atualizarGuia(){
        const e=treino.partida.estado,p=treino.etapa,ganhou=e.vencedor===0,inicio=document.querySelector('.aviso-sua-vez[open]');
        $('guia-progresso').textContent=ganhou?'Treino concluído · sua primeira vitória':`Partida guiada · etapa ${p?.numero||treino.totalEtapas} de ${treino.totalEtapas} · 10 cartas`;
        $('guia-titulo').textContent=ganhou?'Você aprendeu jogando!':inicio?'Sua vez de jogar':e.turno===1?'Observe a máquina':p.titulo;
        $('guia-texto').textContent=ganhou?'Você usou as pilhas, combinou cartas, substituiu sua campeã e venceu três campeões. Agora experimente o Local ou jogue este treino novamente.':inicio?'Este aviso indica quando você pode jogar. Clique em OK para começar. No treino ele aparece só nesta explicação; nas partidas normais, aparece a cada nova vez sua.':e.turno===1?'A máquina prepara o próximo confronto. Quando ela terminar, continue pela próxima dica.':p.texto;
        $('mostrar-passo').hidden=ganhou||e.turno===1;$('treino-concluido').hidden=!ganhou;$('reiniciar-treino').hidden=!ganhou;
        destacar();
    }
    $('iniciar-treino').onclick=iniciar;
    $('reiniciar-treino').onclick=iniciar;
    $('mostrar-passo').onclick=()=>{destacar();alvoPasso?.scrollIntoView({block:'center',inline:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});alvoPasso?.focus({preventScroll:true});};
    new MutationObserver(()=>destacar()).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','aria-pressed']});
})();
