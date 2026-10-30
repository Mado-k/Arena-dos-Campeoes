(function(){
    'use strict';
    const $=id=>document.getElementById(id),eventos=new Map();
    let treino=null,timer,timerAviso,geracao=0,alvoPasso=null;
    const setas=criarSetasTutorial({guia:document.querySelector('.guia-iniciante'),ajuda:$('mostrar-passo')});
    function limparAviso(){clearTimeout(timerAviso);if($('treino-aviso').matches(':popover-open'))$('treino-aviso').hidePopover();}
    function avisarEtapa(){
        const e=treino?.partida.estado,p=treino?.etapa;if(!p||e.vencedor!==null)return;
        const inicio=document.querySelector('.aviso-sua-vez[open]');
        const aviso=$('treino-aviso'),titulo=document.createElement('strong'),texto=document.createElement('p');
        titulo.textContent=e.turno===1?'Observe a máquina':`Siga a etapa ${p.numero} de ${p.total}`;
        texto.textContent=e.turno===1?'Aguarde a máquina terminar. Depois, siga a próxima dica do guia.':inicio?'Confirme em OK para começar esta explicação.':p.texto;
        aviso.replaceChildren(titulo,texto);
        if(!aviso.matches(':popover-open'))aviso.showPopover();
        clearTimeout(timerAviso);timerAviso=setTimeout(limparAviso,7000);destacar();
    }
    const emitir=()=>{limparAviso();const v=treino.visao();for(const fn of eventos.get('partida:estado')||[])fn(v);atualizarGuia();};
    const transporte={on(n,fn){if(!eventos.has(n))eventos.set(n,[]);eventos.get(n).push(fn);},timeout(){return this;},emit(n,d,cb){
        if(n==='partida:sincronizar'){emitir();return;}
        if(n==='partida:revanche'){iniciar();cb?.(null,{ok:true});return;}
        if(n!=='partida:acao'||!treino)return;
        const res=treino.agir(d);if(res.ok){emitir();programarIA();}else if(res.erro)avisarEtapa();cb?.(null,res);
    }};
    const mesa=criarMesaOnline(transporte,{aoSair:()=>location.assign('index.html#modos'),visaoLinearInicial:false,aoAlternarVisualizacao:completa=>{if(treino?.confirmarVisualizacao(completa)){limparAviso();atualizarGuia();}},aoConfirmarInicio:()=>{limparAviso();atualizarGuia();},confirmarInicioTurno:e=>e.numTurno===1,exibirResultadoPadrao:false,aoAbrirDescarte:dono=>{if(treino?.consultarDescarte(dono)){limparAviso();atualizarGuia();}}});
    // Ritmo curto apenas nesta página, sem alterar partidas normais.
    RITMO_ARENA.avisoTurno=900;
    function iniciar(){
        clearTimeout(timer);limparAviso();geracao++;setas.limpar();mesa.limpar();
        try{treino=new TreinoIniciante(window.CARTAS_OFFLINE);$('iniciar-treino').hidden=true;emitir();}
        catch(e){$('treino-erro').hidden=false;$('treino-erro').textContent=e.message;}
    }
    function programarIA(){
        if(!treino||treino.partida.estado.turno!==1||treino.partida.estado.vencedor!==null)return;
        clearTimeout(timer);const atual=geracao;
        timer=setTimeout(()=>{if(atual!==geracao)return;treino.passoComputador();emitir();programarIA();},1200);
    }
    function destino(){
        if(document.querySelector('.mesa-animando'))return null;
        if(!treino)return $('iniciar-treino');
        if(treino.partida.estado.turno!==0||treino.partida.estado.vencedor!==null)return null;
        const p=treino.etapa;if(!p)return null;
        const inicio=document.querySelector('.aviso-sua-vez[open]');
        if(inicio)return inicio.querySelector('button');
        const descarte=document.querySelector('.descarte-online[open]');
        if(descarte)return [...descarte.querySelectorAll('button')].find(b=>b.textContent==='Fechar');
        const confirmacao=document.querySelector('[aria-label="Confirmar eliminação"][open]');
        if(confirmacao)return [...confirmacao.querySelectorAll('button')].find(b=>b.textContent==='Confirmar eliminação');
        if(p.tipo.startsWith('visao-'))return document.querySelector('.alternar-tabuleiro');
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
        const e=treino?.partida.estado,modal=document.querySelector('dialog[open]');
        setas.atualizar(alvoPasso,{chave:`${geracao}:${treino?.etapa?.numero||0}:${e?.numTurno||0}:${modal?.getAttribute('aria-label')||''}`,aguardando:Boolean(treino&&e.vencedor===null&&e.turno===0&&!modal)});
    }
    // A seleção e a consulta do descarte não passam por agir(): protegê-las também.
    const controlesDeJogo='.carta-online,.equip,.acoes-painel button,.hab-box button,.acao-compra,.pilha-comprar,.pilha-descarte button,.acao-encerrar,.alternar-tabuleiro,dialog button';
    function interacaoPermitida(botao){
        const e=treino.partida.estado,p=treino.etapa,modal=document.querySelector('dialog[open]');
        if(e.turno!==0)return false;
        if(modal){
            if(botao===destino())return true;
            return modal.getAttribute('aria-label')==='Confirmar eliminação'&&botao.closest('dialog')===modal&&botao.textContent==='Cancelar';
        }
        if(botao===destino())return true;
        if(botao.matches('.alternar-tabuleiro')&&!p.tipo.startsWith('visao-'))return true;
        if(p.tipo==='comprar'&&botao.closest('.lado-ativo')&&botao.matches('.acao-compra,.pilha-comprar'))return true;
        if(p.tipo==='descarte'&&botao.closest('.lado-ativo .pilha-descarte'))return true;
        if(botao.matches('.carta-online')){
            const zona=['atacar','eliminar'].includes(p.tipo)?'campo':'mao';
            const c=e.jogadores[0][zona].find(c=>String(c.uid)===botao.dataset.carta);
            return Boolean(p.codigo&&c?.base.codigo===p.codigo);
        }
        return false;
    }
    function protegerEtapa(evento){
        if(!treino?.etapa||treino.partida.estado.vencedor!==null)return;
        const botao=evento.target.closest('button');
        if(!botao?.matches(controlesDeJogo)||(evento.type==='pointerdown'&&!botao.disabled))return;
        if(!interacaoPermitida(botao)){
            evento.preventDefault();evento.stopImmediatePropagation();avisarEtapa();
        }else limparAviso();
    }
    document.addEventListener('click',protegerEtapa,true);
    document.addEventListener('pointerdown',protegerEtapa,true);
    function atualizarGuia(){
        if(!treino)return;
        if(document.querySelector('.mesa-animando')){
            $('guia-titulo').textContent='Observe o efeito da jogada';
            $('guia-texto').textContent='A animação mostra o resultado. Em seguida, vamos para a próxima dica.';
            $('mostrar-passo').hidden=true;setas.limpar();return;
        }
        const e=treino.partida.estado,p=treino.etapa,ganhou=e.vencedor===0,inicio=document.querySelector('.aviso-sua-vez[open]');
        $('guia-progresso').textContent=ganhou?'Partida TUTORIAL concluída':`Partida TUTORIAL · etapa ${p?.numero||treino.totalEtapas} de ${treino.totalEtapas}`;
        $('guia-avanco').hidden=false;$('guia-avanco').max=treino.totalEtapas;$('guia-avanco').value=ganhou?treino.totalEtapas:(p?.numero||1)-1;
        $('guia-titulo').textContent=ganhou?'Você aprendeu jogando!':inicio?'Sua vez de jogar':e.turno===1?'Observe a máquina':p.titulo;
        $('guia-texto').textContent=ganhou?'Você usou as pilhas, combinou cartas, substituiu sua campeã e venceu três campeões. Agora experimente o Local ou jogue este treino novamente.':inicio?'Este aviso indica quando você pode jogar. Clique em OK para começar. No treino ele aparece só nesta explicação; nas partidas normais, aparece a cada nova vez sua.':e.turno===1?'A máquina prepara o próximo confronto. Quando ela terminar, continue pela próxima dica.':p.texto;
        $('mostrar-passo').hidden=ganhou||e.turno===1;$('treino-concluido').hidden=!ganhou;$('reiniciar-treino').hidden=!ganhou;$('voltar-menu-treino').hidden=!ganhou;
        document.querySelector('.guia-acoes').classList.toggle('treino-finalizado',ganhou);
        destacar();
    }
    document.addEventListener('mesa:atualizada',atualizarGuia);
    $('iniciar-treino').onclick=iniciar;
    $('reiniciar-treino').onclick=iniciar;
    $('mostrar-passo').onclick=()=>{limparAviso();destacar();setas.ajudar();alvoPasso?.scrollIntoView({block:'center',inline:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});alvoPasso?.focus({preventScroll:true});};
    new MutationObserver(()=>destacar()).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','aria-pressed']});
    destacar();
})();
