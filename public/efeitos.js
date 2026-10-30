/* A apresentação representa eventos públicos; regras e dano pertencem ao motor. */
(function(raiz,fabrica){const api=fabrica(typeof module==='object'&&module.exports?require('./sprites'):raiz.ArenaSprites);if(typeof module==='object'&&module.exports)module.exports=api;else{raiz.ArenaEfeitos=api;raiz.criarEfeitosMesa=api.criar;}})(typeof window!=='undefined'?window:globalThis,function(S){
    'use strict';
    function planejar(antes,depois){
        if(!antes||!depois||antes.voce!==depois.voce||antes.revisao===depois.revisao)return [];
        const novos=(depois.efeitosVisuais||[]).filter(e=>Number.isSafeInteger(e.seq)&&e.seq>(antes.serieVisual||0));
        return novos.filter(e=>e.tipo!=='habilidade'||!novos.some(x=>x!==e&&x.codigo===e.codigo&&x.origem===e.origem&&['dano-feitico','captura','reforco'].includes(x.tipo)));
    }
    const suave=t=>t*t*(3-2*t);
    function trajeto(a,b,t,altura=0){const p=Math.max(0,Math.min(1,t));return{x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p-4*altura*p*(1-p)};}
    function estilo(e){
        if(/fogo/.test(e.tipo))return 'fogo';if(e.tipo==='veneno')return 'veneno';if(e.tipo==='confusao')return 'confusao';
        if(e.tipo==='cura')return 'cura';if(e.tipo==='paralisia')return 'raio';if(e.tipo==='bloqueio')return 'escudo';
        if(e.tipo==='pandora')return 'pandora';if(['representante','escudo'].includes(e.tipo))return 'defesa';
        if(e.tipo==='ataque')return S.perfil(e.codigo)?.efeito||'golpe';
        return S.perfil(e.copiada||e.codigo)?.efeito||'runa';
    }
    function textoEvento(e){
        const codigo=e.copiada||e.codigo;
        if(Number.isFinite(e.dano))return '−'+e.dano;
        if(e.tipo==='bloqueio')return 'Bloqueado';
        if(e.tipo==='paralisia')return 'Paralisado';
        if(e.tipo==='heranca')return 'Reserva: +'+e.valor+' DEF';
        if(e.tipo==='dino-fim')return 'Fim do apoio';
        if(e.tipo==='entrada'&&codigo==='n032'&&Number.isFinite(e.defesa))return 'DEF '+e.defesa;
        if(codigo==='n039'&&Number.isFinite(e.defesa))return 'DEF = '+e.defesa;
        if(codigo==='n028'&&e.tipo==='habilidade'&&Number.isFinite(e.defesa))return 'DEF '+e.defesa;
        if(codigo==='n040'&&e.tipo==='habilidade')return 'Derrotado';
        if(['n031','n035'].includes(codigo)&&Number.isFinite(e.valor))return e.valor+' carta(s)';
        if(e.tipo==='reforco'&&e.atributo&&Number.isFinite(e.valor))return e.atributo+' '+e.valor;
        if(Number.isFinite(e.valor)&&e.valor>0)return '+'+e.valor+(e.atributo?' '+e.atributo:'');
        if(e.tipo==='anulacao')return 'Habilidade anulada';
        if(e.tipo==='captura')return 'Para a mão';
        if(e.tipo==='pandora-aplicada')return 'Pandora ativa';
        if(e.tipo==='presenca'&&codigo==='n009')return 'Efeitos ×2';
        return '';
    }
    // Uma ação nunca ganha uma espera por carta atingida. Alvos do mesmo efeito são simultâneos.
    function roteiro(eventos){
        const cenas=[];let grupo=[];
        const fechar=()=>{if(grupo.length){cenas.push({eventos:grupo});grupo=[];}};
        for(const e of eventos){
            if(['dino','dino-fim','ataque'].includes(e.tipo)){fechar();cenas.push({eventos:[e]});}else grupo.push(e);
        }fechar();
        while(cenas.length>3){const ultima=cenas.pop();cenas.at(-1).eventos.push(...ultima.eventos);}
        const pesos=cenas.map(c=>c.eventos.some(e=>e.tipo==='dino')?4:c.eventos.some(e=>e.tipo==='ataque')?1.8:c.eventos.some(e=>['habilidade','dano-feitico','pandora-aplicada','captura'].includes(e.tipo))?2.4:c.eventos.some(e=>['entrada','presenca','equipar','representante'].includes(e.tipo))?2:1.2);
        const alvo=Math.min(3200,Math.max(1400,pesos.reduce((a,b)=>a+b,0)*1000));
        const reservado=cenas.length*1000,extra=Math.max(0,alvo-reservado),soma=pesos.reduce((a,b)=>a+b,0);
        return cenas.map((c,i)=>({...c,duracao:1000+extra*pesos[i]/soma}));
    }
    function criar(mesa,{capturarVista=()=>null,restaurarVista=()=>{}}={}){
        let geracao=0,camera=false,rodando=false,ultimoQuadro=0;
        const nos=new Set(),tarefas=new Set(),revelados=new Set();
        const camada=document.createElement('div');camada.className='efeitos-camada';document.body.append(camada);
        const reduzido=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
        function node(classe,texto){const n=document.createElement('div');n.className=classe;if(texto!==undefined)n.textContent=texto;n.setAttribute('aria-hidden','true');camada.append(n);nos.add(n);return n;}
        function remover(n){n?.remove();nos.delete(n);}
        function quadro(ms,acao,token=geracao){return new Promise(resolve=>{
            let raf,inicio;
            const tarefa={cancelar(){cancelAnimationFrame(raf);tarefas.delete(tarefa);resolve(false);}};tarefas.add(tarefa);
            function passo(agora){if(token!==geracao||document.hidden)return tarefa.cancelar();inicio??=agora;const t=Math.min(1,(agora-inicio)/ms);acao(t,agora);if(t<1)raf=requestAnimationFrame(passo);else{tarefas.delete(tarefa);resolve(true);}}
            raf=requestAnimationFrame(passo);
        });}
        function zona(dono,nome){return mesa.querySelector(`[data-jogador="${Number(dono)}"] [data-zona="${nome}"]`)||mesa;}
        function carta(uid,dono){
            const c=[...mesa.querySelectorAll('[data-carta]')].find(n=>n.dataset.carta===String(uid));const lado=(c||zona(dono,'campo')).closest('.assento');
            if(lado&&!lado.getClientRects().length){lado.classList.add('vfx-revelado');revelados.add(lado);}
            return c?.getClientRects().length?c:zona(dono,'campo');
        }
        function ponto(n){const r=n.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};}
        function posicionar(n,p){n.style.left=p.x+'px';n.style.top=p.y+'px';}
        function mundo(n,j){const p=ponto(n),r=j.getBoundingClientRect();return{x:p.x-r.left+j.scrollLeft,y:p.y-r.top+j.scrollTop};}
        function tela(p,j){const r=j.getBoundingClientRect();return{x:r.left+p.x-j.scrollLeft,y:r.top+p.y-j.scrollTop};}
        function seguir(p,j,agora){
            if(!camera)return;const dt=ultimoQuadro?Math.min(40,agora-ultimoQuadro):16;ultimoQuadro=agora;const alfa=1-Math.exp(-dt/145),r=j.getBoundingClientRect();
            if(j.scrollWidth>j.clientWidth)j.scrollLeft+=(p.x-r.left-j.clientWidth/2)*alfa;
            if(j.scrollHeight>j.clientHeight)j.scrollTop+=(p.y-r.top-j.clientHeight/2)*alfa;
            window.scrollTo({left:scrollX,top:Math.max(0,scrollY+(p.y-innerHeight*.48)*alfa),behavior:'instant'});
        }
        function simbolo(tipo){const n=document.createElement('span');n.className='vfx-glifo';if(['fogo','veneno'].includes(tipo))n.classList.add('sprite-estado','sprite-'+tipo);else n.innerHTML=S.glifo(tipo);return n;}
        function personagem(codigo){const n=document.createElement('div');n.className=codigo==='n022'?'sprite-dino':'sprite-criatura';if(codigo!=='n022')n.innerHTML=S.desenhar(codigo);return n;}
        function efeitoTipo(e){
            if(e.tipo==='entrada')return S.perfil(e.codigo)?.acao==='protecao'?'escudo':S.perfil(e.codigo)?.efeito||'runa';
            if(e.tipo==='equipar')return 'defesa';return estilo(e);
        }
        function alvoEvento(e){
            if(e.zonaAlvo)return zona(e.dono,e.zonaAlvo);
            return carta(e.alvo,e.alvoDono);
        }
        function emitirParticulas(e,t,nodes,alvo){
            const p=ponto(alvo);
            for(let i=0;i<nodes.length;i++){const n=nodes[i],angulo=i*Math.PI*2/nodes.length;posicionar(n,{x:p.x+Math.cos(angulo)*t*50,y:p.y+Math.sin(angulo)*t*50});n.style.opacity=String(1-t);}
        }
        async function cena(eventos,duracao,comCamera){
            const token=geracao,janela=mesa.querySelector('.arena-janela')||mesa;
            // Mesmo emissor e mesma ação não produzem vários personagens sobrepostos.
            const grupos=new Map();for(const e of eventos.slice(-16)){const chave=e.origem+':'+e.codigo;const g=grupos.get(chave)||[];g.push(e);grupos.set(chave,g);}
            const conjuntos=[];
            for(const [indice,grupo]of [...grupos.values()].entries()){
                const e=grupo[0],perfil=S.perfil(e.codigo),origem=carta(e.origem,e.dono),alvos=grupo.map(alvoEvento),tipo=efeitoTipo(e);
                const avatar=perfil&&e.codigo!=='n001'&&!['veneno','fogo','pandora','confusao','paralisia'].includes(e.tipo);
                const ator=avatar?node('vfx-invocado vfx-'+tipo):null;
                const recorte=avatar?document.createElement('div'):null,pessoa=avatar?personagem(e.codigo):null,borda=avatar?document.createElement('div'):null;
                if(ator){recorte.className='vfx-recorte';borda.className='vfx-abertura';recorte.append(pessoa);ator.append(recorte,borda);ator.dataset.codigo=e.codigo;}
                const arte=origem.querySelector('.c-arte')||origem;let a=mundo(arte,janela);a.y+=12;
                if(indice&&grupo.some(x=>x.tipo==='representante'))a.x+=65;
                const destino=alvos[0],b=mundo(destino,janela);b.y-=12;
                const atacar=e.tipo==='ataque'||e.tipo==='dino',retorno=(e.copiada||e.codigo)==='n019'&&e.tipo==='habilidade',fimDino=e.tipo==='dino-fim';
                const deslocar=atacar||['n006','n008','n016','n020','n028','n034','n036','n039','n040'].includes(e.codigo)&&e.tipo!=='entrada'&&e.tipo!=='equipar';
                const perto=deslocar?trajeto(a,b,atacar?.73:.42):a;
                const efeitos=grupo.map((ev,i)=>{
                    const marca=node('vfx-impacto vfx-'+efeitoTipo(ev));marca.append(simbolo(efeitoTipo(ev)));marca.hidden=true;
                    const texto=textoEvento(ev),numero=texto?node('vfx-numero vfx-'+efeitoTipo(ev),texto):null;if(numero)numero.hidden=true;
                    const projetil=node('vfx-projetil vfx-'+efeitoTipo(ev));projetil.hidden=true;
                    if(['fogo','veneno'].includes(efeitoTipo(ev)))projetil.classList.add('sprite-estado','sprite-'+efeitoTipo(ev));else projetil.append(simbolo(efeitoTipo(ev)));
                    const particulas=Array.from({length:6},()=>{const n=node('vfx-particula vfx-'+efeitoTipo(ev));n.hidden=true;return n;});
                    return{ev,marca,numero,projetil,particulas,alvo:alvos[i]};
                });
                const extras=[];
                if(e.ultimo||fimDino){const cacto=node('vfx-cacto');cacto.innerHTML='<svg viewBox="0 0 16 24" shape-rendering="crispEdges"><path fill="#38683d" d="M6 1H10V23H6ZM1 7H4V14H6V17H1ZM12 4H15V14H10V11H12Z"/><path fill="#97bd65" d="M7 2H8V22H7ZM2 8H3V13H2ZM13 5H14V10H13Z"/></svg>';cacto.hidden=true;extras.push(cacto);}
                conjuntos.push({e,ator,pessoa,borda,recorte,a,b,perto,atacar,retorno,fimDino,deslocar,efeitos,extras,origem,tipo});
            }
            const principal=conjuntos.find(c=>c.ator)||conjuntos[0];
            const anuncio=node('vfx-anuncio','');anuncio.removeAttribute('aria-hidden');anuncio.setAttribute('role','status');
            anuncio.textContent=principal?S.perfil(principal.e.codigo)?.nome||'Efeito da habilidade':'Efeito da habilidade';
            await quadro(duracao,(t,agora)=>{
                for(const c of conjuntos){
                    const {e,ator,pessoa,a,b,perto,efeitos}=c;let atual=a,fase='surgindo';
                    if(t<.16){pessoa?.style.setProperty('--saida',(100*(1-suave(t/.16)))+'%');}
                    else if(t<.38){fase='correndo';atual=trajeto(a,perto,suave((t-.16)/.22));}
                    else if(t<.55){fase=c.atacar?'pulando':'executando';atual=c.atacar?trajeto(perto,b,(t-.38)/.17,e.tipo==='dino'?90:30):perto;}
                    else if(t<.67){fase='impacto';atual=c.atacar?b:perto;}
                    else if(t<.86){fase='voltando';atual=trajeto(c.atacar?b:perto,c.retorno?b:a,suave((t-.67)/.19));}
                    else{fase='entrando';atual=c.retorno?b:a;pessoa?.style.setProperty('--saida',(100*suave((t-.86)/.14))+'%');}
                    if(pessoa&&t>=.16&&t<.86)pessoa.style.setProperty('--saida','0%');
                    if(c.fimDino&&t>=.16){atual={x:a.x+suave(Math.min(1,(t-.16)/.5))*45,y:a.y};fase=t<.66?'correndo':'cacto';}
                    if(e.ultimo&&t>.78){atual={x:a.x+suave(Math.min(1,(t-.78)/.16))*45,y:a.y};fase=t<.94?'voltando':'cacto';pessoa?.style.setProperty('--saida','0%');}
                    if(ator){
                        if(ator.dataset.fase!==fase)ator.dataset.fase=fase;
                        c.recorte.style.overflow=['surgindo','entrando'].includes(fase)?'hidden':'visible';c.borda.hidden=!['surgindo','entrando'].includes(fase);
                        pessoa.classList.toggle('correndo',fase==='correndo'||fase==='voltando');pessoa.classList.toggle('executando',['executando','impacto'].includes(fase));
                        pessoa.style.setProperty('--direcao',t>.67&&c.deslocar!==false?a.x<b.x?-1:1:b.x<a.x?-1:1);
                        pessoa.style.setProperty('--progresso',t);ator.style.opacity=(c.fimDino||e.ultimo)&&t>.94?String(Math.max(0,1-(t-.94)/.06)):'1';
                        let p=tela(atual,janela);
                        if(c===principal&&comCamera){
                            const f=efeitos.find(f=>f.ev.alvoDono!==e.dono)||efeitos[0];
                            const foco=!c.atacar&&t>=.38&&t<.67?trajeto(tela(perto,janela),ponto(f.alvo),suave(Math.min(1,(t-.38)/.17))):p;
                            seguir(foco,janela,agora);
                        }
                        p=tela(atual,janela);posicionar(ator,p);
                    }
                    if(pessoa&&e.copiada&&t>=.38&&t<.67&&pessoa.dataset.copiada!==e.copiada){pessoa.innerHTML=S.desenhar(e.copiada);pessoa.dataset.copiada=e.copiada;}
                    else if(pessoa&&e.copiada&&t>=.67&&pessoa.dataset.copiada){pessoa.innerHTML=S.desenhar(e.codigo);delete pessoa.dataset.copiada;}
                    if(!ator&&c===principal&&comCamera)seguir(ponto(efeitos[0].alvo),janela,agora);
                    for(const f of efeitos){
                        const p=ponto(f.alvo),desde=c.atacar?tela(perto,janela):e.zonaOrigem?ponto(zona(e.dono,e.zonaOrigem)):tela(perto,janela);
                        f.projetil.hidden=t<.38||t>.55||c.fimDino||c.atacar;
                        if(!f.projetil.hidden)posicionar(f.projetil,trajeto(desde,p,suave((t-.38)/.17),20));
                        const v=(t-.55)/.29,visivel=v>=0&&v<=1;f.marca.hidden=!visivel;f.particulas.forEach(n=>n.hidden=!visivel);if(f.numero)f.numero.hidden=!visivel;
                        if(visivel){posicionar(f.marca,p);f.marca.style.transform=`translate(-50%,-50%) scale(${.65+Math.sin(Math.PI*v)*.55})`;f.marca.style.opacity=String(1-v*.8);emitirParticulas(e,v,f.particulas,f.alvo);if(f.numero){posicionar(f.numero,{x:p.x,y:p.y-30-v*38-(e.seq%2)*20});f.numero.style.opacity=String(Math.min(1,(1-v)*4));}}
                    }
                    for(const n of c.extras){n.hidden=t<(c.fimDino ? .15 : .76);posicionar(n,tela({x:a.x+45,y:a.y},janela));}
                }
            },token);
            for(const c of conjuntos){remover(c.ator);for(const f of c.efeitos){remover(f.marca);remover(f.numero);remover(f.projetil);f.particulas.forEach(remover);}c.extras.forEach(remover);}remover(anuncio);
        }
        function limpar(){geracao++;camera=false;rodando=false;ultimoQuadro=0;for(const t of [...tarefas])t.cancelar();for(const n of [...nos])remover(n);for(const n of revelados)n.classList.remove('vfx-revelado');revelados.clear();mesa.classList.remove('mesa-animando');mesa.removeAttribute('aria-busy');}
        return{planejar,ocupado:()=>rodando,interromperCamera(){camera=false;},limpar,
            async executar(antes,depois){
                const eventos=planejar(antes,depois);if(!eventos.length||document.hidden||reduzido())return;
                const token=geracao,vista=capturarVista();camera=true;rodando=true;mesa.classList.add('mesa-animando');mesa.setAttribute('aria-busy','true');
                try{
                    for(const c of roteiro(eventos)){if(token!==geracao)break;await cena(c.eventos,c.duracao,true);}
                    if(token===geracao&&camera&&vista){
                        const x=scrollX,y=scrollY,j=mesa.querySelector('.arena-janela'),mx=j?.scrollLeft||0,my=j?.scrollTop||0;
                        await quadro(280,t=>{if(!camera)return;const v=suave(t);window.scrollTo({left:x+(vista.x-x)*v,top:y+(vista.y-y)*v,behavior:'instant'});if(j&&vista.mesa)j.scrollTo({left:mx+(vista.mesa.x-mx)*v,top:my+(vista.mesa.y-my)*v,behavior:'instant'});},token);
                    }
                }finally{if(token===geracao){const voltar=camera;limpar();if(voltar)restaurarVista(vista);}}
            }
        };
    }
    return{planejar,trajeto,estilo,textoEvento,roteiro,criar};
});
