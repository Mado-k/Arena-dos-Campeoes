// Usa apenas as cartas públicas e a mão do próprio jogador recebidas na visão.
(function(){
    'use strict';
    window.criarMovimentosMesa=function(mesa){
        const ativas=new Set();
        function capturar(estado){
            if(!estado||mesa.hidden)return null;
            const zonas=new Map(),cartas=new Map(),locais=new Map();
            for(const lado of mesa.querySelectorAll('[data-jogador]')){
                const dono=Number(lado.dataset.jogador);
                for(const z of lado.querySelectorAll('[data-zona]'))zonas.set(dono+':'+z.dataset.zona,(z.querySelector('.pilha-cartas')||z).getBoundingClientRect());
                for(const c of lado.querySelectorAll('[data-carta]'))cartas.set(c.dataset.carta,c.getBoundingClientRect());
            }
            estado.jogadores.forEach((j,dono)=>{
                for(const zona of ['mao','campo','apoio','descarte','feiticos'])for(const c of j[zona]||[]){
                    locais.set(String(c.uid),{dono,zona});
                    for(const eq of c.equip)locais.set(String(eq.uid),{dono,zona});
                }
            });
            return {zonas,cartas,locais,estado,scrollY:window.scrollY};
        }
        function voar(origem,destino,tipo){
            if(!origem||!destino||!origem.width||!destino.width)return;
            const carta=document.createElement('div');carta.className='carta-verso carta-em-movimento';carta.dataset.movimento=tipo;carta.setAttribute('aria-hidden','true');
            const emblema=document.createElement('span');emblema.className='verso-emblema';emblema.textContent='A';carta.append(emblema);
            document.body.append(carta);
            const largura=origem.width<=165?origem.width:145;
            const altura=origem.height<=350?origem.height:245;
            carta.style.width=largura+'px';carta.style.height=altura+'px';
            const ponto=r=>({x:Math.max(0,Math.min(innerWidth-largura,r.left+r.width/2-largura/2)),y:Math.max(0,Math.min(innerHeight-altura,r.top+r.height/2-altura/2))});
            const a=ponto(origem),b=ponto(destino);
            const quadros=[0,.25,.5,.75,1].map(t=>({
                transform:`translate(${a.x+(b.x-a.x)*t}px,${a.y+(b.y-a.y)*t-Math.sin(Math.PI*t)*18}px) rotate(${Math.sin(Math.PI*t)*3}deg)`,
                opacity:t===1?.15:1,offset:t
            }));
            const animacao=carta.animate(quadros,{duration:1050,easing:'cubic-bezier(.4,0,.2,1)'});
            const limpar=()=>{carta.remove();ativas.delete(animacao);};
            animacao.onfinish=limpar;animacao.oncancel=limpar;ativas.add(animacao);
        }
        function animar(antes,estado){
            if(!antes||antes.estado.voce!==estado.voce||antes.estado.revisao===estado.revisao||window.matchMedia('(prefers-reduced-motion: reduce)').matches||!Element.prototype.animate)return;
            const depois=capturar(estado);if(!depois)return;
            const ajustar=r=>r?{...r,left:r.left,top:r.top-(window.scrollY-antes.scrollY),width:r.width,height:r.height}:null;
            for(const [uid,destino]of depois.locais){
                const origem=antes.locais.get(uid);
                if(origem&&origem.dono===destino.dono&&origem.zona===destino.zona)continue;
                if(!origem&&destino.zona==='descarte'&&antes.estado.jogadores[destino.dono].descarte.some(c=>String(c.uid)===uid))continue;
                const zonaOrigem=origem?.zona||(destino.zona==='mao'?'baralho':'mao');
                const tipo=destino.zona==='descarte'?'descarte':destino.zona==='mao'?'compra':'jogada';
                voar(ajustar(antes.cartas.get(uid)||antes.zonas.get((origem?.dono??destino.dono)+':'+zonaOrigem)),depois.cartas.get(uid)||depois.zonas.get(destino.dono+':'+destino.zona),tipo);
            }
            estado.jogadores.forEach((j,i)=>{
                if(i===estado.voce)return;
                const diferenca=j.maoTotal-antes.estado.jogadores[i].maoTotal;
                const inicio=estado.log.lastIndexOf(antes.estado.log.at(-1))+1;
                const compras=estado.log.slice(inicio).filter(l=>l===j.nome+' comprou uma carta.').length;
                for(let k=0;k<Math.min(6,Math.max(diferenca,compras));k++)voar(ajustar(antes.zonas.get(i+':baralho')),depois.zonas.get(i+':mao'),'compra');
            });
        }
        return {capturar,animar,limpar(){for(const a of [...ativas])a.cancel();}};
    };
})();
