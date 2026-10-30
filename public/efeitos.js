/* Efeitos usam exclusivamente acontecimentos públicos do motor, sem calcular dano. */
(function (raiz, fabrica) {
    const api = fabrica();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else { raiz.ArenaEfeitos = api; raiz.criarEfeitosMesa = api.criar; }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';
    function planejar(antes, depois) {
        if (!antes || !depois || antes.voce !== depois.voce || antes.revisao === depois.revisao) return [];
        const novas = (depois.efeitosVisuais || []).filter(e => Number.isSafeInteger(e.seq) && e.seq > (antes.serieVisual || 0));
        // Uma aplicação específica substitui a faísca genérica da mesma habilidade.
        return novas.filter(e => e.tipo !== 'habilidade' || !novas.some(x => x !== e && x.codigo === e.codigo && x.origem === e.origem && ['dano-feitico', 'captura', 'reforco'].includes(x.tipo)));
    }
    function trajeto(a, b, t, altura = 0) {
        const p = Math.max(0, Math.min(1, t));
        return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p - 4 * altura * p * (1 - p) };
    }
    function estilo(e) {
        if (/fogo/.test(e.tipo)) return 'fogo';
        if (/veneno/.test(e.tipo)) return 'veneno';
        if (e.tipo === 'ataque') return 'golpe';
        if (e.tipo === 'cura') return 'cura';
        if (['escudo', 'bloqueio', 'equipar', 'heranca', 'reforco'].includes(e.tipo)) return 'escudo';
        return ({ n001:'busca',n002:'pandora',n005:'cura',n006:'captura',n008:'captura',n016:'veneno',n017:'raio',n019:'portal',n020:'confusao',n024:'portal',n030:'sol',n031:'busca',n034:'copia',n035:'busca',n036:'agua',n039:'escudo',n040:'raio' })[e.codigo] || e.tipo === 'confusao' && 'confusao' || 'runa';
    }
    function criar(mesa, { capturarVista = () => null, restaurarVista = () => {} } = {}) {
        let geracao = 0, camera = false, rodando = false;
        const nos = new Set(), tarefas = new Set(), revelados = new Set();
        const movimentoReduzido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
        function node(classe, texto) {
            const n = document.createElement('div'); n.className = classe;
            if (texto !== undefined) n.textContent = texto;
            n.setAttribute('aria-hidden','true'); document.body.append(n); nos.add(n); return n;
        }
        function remover(n) { n?.remove(); nos.delete(n); }
        function quadro(ms, acao, token = geracao) {
            return new Promise(resolve => {
                let raf, inicio;
                const tarefa = { cancelar() { cancelAnimationFrame(raf); tarefas.delete(tarefa); resolve(false); } };
                tarefas.add(tarefa);
                function passo(agora) {
                    if (token !== geracao || document.hidden) return tarefa.cancelar();
                    inicio ??= agora;
                    const t = Math.min(1, (agora-inicio)/ms); acao(t);
                    if (t < 1) raf = requestAnimationFrame(passo);
                    else { tarefas.delete(tarefa); resolve(true); }
                }
                raf = requestAnimationFrame(passo);
            });
        }
        function carta(uid, dono) {
            const c = [...mesa.querySelectorAll('[data-carta]')].find(n => n.dataset.carta === String(uid));
            const lado = c?.closest('.assento');
            if (lado && !lado.getClientRects().length) { lado.classList.add('vfx-revelado'); revelados.add(lado); }
            if (c?.getClientRects().length) return c;
            return mesa.querySelector(`[data-jogador="${Number(dono)}"] [data-zona="campo"]`) || mesa;
        }
        function ponto(n) { const r = n.getBoundingClientRect(); return { x:r.left+r.width/2, y:r.top+r.height/2 }; }
        function posicionar(n,p) { n.style.left=p.x+'px'; n.style.top=p.y+'px'; }
        function mundo(n, janela) { const p=ponto(n),r=janela.getBoundingClientRect();return {x:p.x-r.left+janela.scrollLeft,y:p.y-r.top+janela.scrollTop}; }
        function tela(p, janela) { const r=janela.getBoundingClientRect();return {x:r.left+p.x-janela.scrollLeft,y:r.top+p.y-janela.scrollTop}; }
        function seguir(p, janela) {
            if (!camera) return;
            const r = janela.getBoundingClientRect();
            if(janela.scrollWidth>janela.clientWidth)janela.scrollLeft += (p.x-r.left-janela.clientWidth/2)*.12;
            if(janela.scrollHeight>janela.clientHeight)janela.scrollTop += (p.y-r.top-janela.clientHeight/2)*.12;
            window.scrollTo({left:scrollX,top:Math.max(0,scrollY+(p.y-innerHeight*.48)*.12),behavior:'instant'});
        }
        function glifo(tipo) {
            // Silhuetas próprias numa grade de 16 pixels, sem fontes de emoji.
            const formas = {
                raio:'M9 0H4V8H7L5 16 14 5H9Z',
                cura:'M6 1H10V6H15V10H10V15H6V10H1V6H6Z',
                escudo:'M2 1H14V9H12V12H10V14H6V12H4V9H2ZM5 4V8H7V11H9V8H11V4Z',
                golpe:'M12 0H16V4H13V7H10V10H7V13H4V16H0V12H3V9H6V6H9V3H12Z',
                agua:'M6 0H10V4H12V6H14V12H12V14H4V12H2V6H4V4H6ZM5 8V11H7V8Z',
                confusao:'M3 1H13V3H15V11H13V13H5V11H3V5H11V9H7V7H5V11H13V3H3V15H1V3H3Z',
                sol:'M6 0H10V3H13V6H16V10H13V13H10V16H6V13H3V10H0V6H3V3H6Z',
                runa:'M6 0H10V3H13V6H16V10H13V13H10V16H6V13H3V10H0V6H3V3H6ZM6 5V11H10V5Z'
            };
            const n=document.createElementNS('http://www.w3.org/2000/svg','svg');n.setAttribute('viewBox','0 0 16 16');n.setAttribute('aria-hidden','true');
            const p=document.createElementNS(n.namespaceURI,'path');p.setAttribute('d',formas[tipo]||formas.runa);n.append(p);return n;
        }
        async function impacto(e, tipo = estilo(e)) {
            const alvo=carta(e.alvo,e.alvoDono), p=ponto(alvo);
            const marca=node('vfx-impacto vfx-'+tipo);posicionar(marca,p);marca.append(glifo(tipo));
            const texto=Number.isFinite(e.dano)?'−'+e.dano:Number.isFinite(e.valor)&&e.valor>0?'+'+e.valor:e.tipo==='bloqueio'?'Bloqueado':'';
            const deslocamento=(e.seq%3)*22;
            const numero=texto?node('vfx-numero vfx-'+tipo,texto):null;
            if(numero)posicionar(numero,{x:p.x,y:p.y-25});
            const estilhaços=Array.from({length:8},(_,i)=>{const n=node('vfx-particula vfx-'+tipo);return {n,angulo:i*Math.PI/4};});
            await quadro(640,t=>{
                const atual=ponto(alvo);posicionar(marca,atual);marca.style.transform=`translate(-50%,-50%) scale(${.6+Math.sin(t*Math.PI)*.65}) rotate(${tipo==='confusao'?t*180:0}deg)`;marca.style.opacity=String(1-t*t);
                if(numero){posicionar(numero,{x:atual.x,y:atual.y-30-deslocamento-t*48});numero.style.opacity=String(Math.min(1,(1-t)*4));}
                for(const {n,angulo} of estilhaços){posicionar(n,{x:atual.x+Math.cos(angulo)*t*65,y:atual.y+Math.sin(angulo)*t*65});n.style.opacity=String(1-t);}
            });
            remover(marca);remover(numero);for(const {n} of estilhaços)remover(n);
        }
        async function magia(e) {
            const token=geracao;
            if(e.tipo==='habilidade'&&['n016','n036'].includes(e.codigo))return invocar(e);
            const tipo=estilo(e),origem=carta(e.origem,e.dono),alvo=carta(e.alvo,e.alvoDono);
            if(origem!==alvo){
                const projetil=node('vfx-projetil vfx-'+tipo);
                if(tipo==='fogo'||tipo==='veneno')projetil.classList.add('sprite-estado','sprite-'+tipo);else projetil.append(glifo(tipo));
                const terminou=await quadro(520,t=>{const p=trajeto(ponto(origem),ponto(alvo),t,35);posicionar(projetil,p);projetil.style.transform=`translate(-50%,-50%) rotate(${t*120}deg)`;},token);remover(projetil);if(!terminou)return;
            }
            if(token===geracao)await impacto(e,tipo);
        }
        async function invocar(e) {
            const token=geracao,janela=mesa.querySelector('.arena-janela')||mesa;
            const origem=carta(e.origem,e.dono),alvo=carta(e.alvo,e.alvoDono);
            const arte=origem.querySelector('.c-arte')||origem;
            const a=mundo(arte,janela), b=mundo(alvo,janela);a.y+=15;b.y-=15;
            const ator=node('vfx-invocado'),recorte=document.createElement('div'),personagem=document.createElement('div'),borda=document.createElement('div');
            const ehDino=e.codigo==='n022',tipo=ehDino?'golpe':estilo(e);
            recorte.className='vfx-recorte';personagem.className=ehDino?'sprite-dino':'sprite-criatura vfx-'+tipo;
            if(!ehDino){
                // Avatares originais de Kappa e Leviatã; mesma abertura e retorno do Dino.
                const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 32 32');
                const kappa=[[10,2,12,3,'#b7ee7d'],[6,5,20,12,'#568447'],[10,7,12,12,'#9bd85b'],[9,9,3,3,'#162c2e'],[20,9,3,3,'#162c2e'],[12,13,8,3,'#e9ce71'],[9,19,14,9,'#426a37'],[4,19,5,5,'#9bd85b'],[23,19,5,5,'#9bd85b'],[8,28,6,4,'#9bd85b'],[19,28,6,4,'#9bd85b']];
                const leviata=[[6,2,15,3,'#d6f7ee'],[9,5,18,6,'#6bc7d8'],[4,10,20,8,'#4195b5'],[20,7,3,3,'#172638'],[7,18,12,6,'#397a9f'],[1,22,20,6,'#6bc7d8'],[16,26,12,5,'#4195b5'],[1,18,4,7,'#d6f7ee'],[24,28,7,3,'#d6f7ee']];
                for(const [x,y,w,h,cor]of (e.codigo==='n016'?kappa:leviata)){const r=document.createElementNS(svg.namespaceURI,'rect');for(const [k,v]of Object.entries({x,y,width:w,height:h,fill:cor}))r.setAttribute(k,v);svg.append(r);}personagem.append(svg);
            }
            borda.className='vfx-abertura';recorte.append(personagem);ator.append(recorte,borda);
            const anuncio=node('vfx-anuncio',(ehDino?'Dino do Google':e.codigo==='n016'?'Kappa':'Leviatã')+' saiu da carta!');anuncio.removeAttribute('aria-hidden');anuncio.setAttribute('role','status');
            let fase='surgindo';ator.dataset.fase=fase;ator.dataset.codigo=e.codigo;
            function orientar(destino,partida){personagem.style.setProperty('--direcao',destino.x<partida.x?-1:1);}
            function mover(p){let atual=tela(p,janela);seguir(atual,janela);atual=tela(p,janela);posicionar(ator,atual);}
            orientar(b,a);
            if(!await quadro(650,t=>{mover(a);personagem.style.setProperty('--saida',(100*(1-t))+'%');},token))return;
            recorte.style.overflow='visible';borda.hidden=true;personagem.classList.add('correndo');
            fase='correndo';ator.dataset.fase=fase;
            const espera={x:a.x+(b.x-a.x)*.78,y:a.y+(b.y-a.y)*.78};
            if(!await quadro(1000,t=>mover(trajeto(a,espera,t*t*(3-2*t))),token))return;
            personagem.classList.remove('correndo');personagem.classList.add('pulando');ator.dataset.fase='pulando';
            if(ehDino){if(!await quadro(650,t=>mover(trajeto(espera,b,t,100)),token))return;}
            else {
                const projetil=node('vfx-projetil vfx-'+tipo);if(tipo==='veneno')projetil.classList.add('sprite-estado','sprite-veneno');else projetil.append(glifo(tipo));
                if(!await quadro(550,t=>{mover(espera);posicionar(projetil,tela(trajeto(espera,b,t,25),janela));},token))return;remover(projetil);
            }
            ator.dataset.fase='impacto';await impacto(e,tipo);if(token!==geracao)return;
            anuncio.textContent=ehDino?`Dino causou ${e.dano} de dano. Voltando à carta.`:'Habilidade aplicada. Voltando à carta.';
            personagem.classList.remove('pulando');personagem.classList.add('correndo');orientar(a,b);ator.dataset.fase='voltando';
            const volta=ehDino?b:espera;
            if(!await quadro(1150,t=>mover(trajeto(volta,a,t*t*(3-2*t))),token))return;
            personagem.classList.remove('correndo');recorte.style.overflow='hidden';borda.hidden=false;ator.dataset.fase='entrando';
            await quadro(650,t=>{mover(a);personagem.style.setProperty('--saida',(100*t)+'%');},token);
            remover(ator);remover(anuncio);
        }
        function limpar() {
            geracao++;camera=false;rodando=false;
            for(const t of [...tarefas])t.cancelar();
            for(const n of [...nos])remover(n);
            for(const n of revelados)n.classList.remove('vfx-revelado');revelados.clear();
            mesa.classList.remove('mesa-animando');mesa.removeAttribute('aria-busy');
        }
        return {
            planejar, ocupado:()=>rodando, interromperCamera(){camera=false;}, limpar,
            async executar(antes,depois) {
                const eventos=planejar(antes,depois);
                if(!eventos.length||document.hidden||movimentoReduzido())return;
                const token=geracao,vista=capturarVista();camera=true;rodando=true;mesa.classList.add('mesa-animando');mesa.setAttribute('aria-busy','true');
                try {
                    // O fim do turno acontece antes dos efeitos do próximo dono.
                    // Agrupa só acontecimentos contíguos, preservando essa ordem.
                    let grupo=[];
                    const liberar=async()=>{await Promise.all(grupo.slice(-12).map(magia));grupo=[];};
                    for(const e of eventos){
                        if(token!==geracao)break;
                        if(e.tipo==='dino'||e.tipo==='habilidade'&&['n016','n036'].includes(e.codigo)){
                            await liberar();if(token!==geracao)break;await invocar(e);
                        }else grupo.push(e);
                    }
                    if(token===geracao)await liberar();
                } finally {
                    if(token===geracao){const voltar=camera;limpar();if(voltar)restaurarVista(vista);}
                }
            }
        };
    }
    return { planejar, trajeto, estilo, criar };
});
