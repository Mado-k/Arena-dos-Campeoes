// IA compartilhada pelo servidor e pelo modo Local. Não consulta mãos adversárias.
(function (raiz) {
    'use strict';
    const M = typeof module !== 'undefined' && module.exports ? require('./motor') : raiz.Motor;
    const NIVEIS = ['facil', 'normal', 'dificil'];
    const ACOES = {
        comprar: e => M.comprarAcao(e), invocar: (e,d) => M.invocar(e,d.uid),
        apoio: (e,d) => M.colocarApoio(e,d.uid), equipar: (e,d) => M.equipar(e,d.uid),
        atacar: e => M.atacar(e), habilidade: (e,d) => M.executarHabilidade(e,d.uid,d.escolha)
    };
    function riscoPublico(e, dono) {
        const c=e.jogadores[dono].campo[0];
        if(!c)return 0;
        let risco=0;
        for(const rival of M.adversarios(e,dono)) {
            const inimigo=e.jogadores[rival].campo[0];
            if(!inimigo || inimigo.st.paralisia>0 || !M.ferivel(e,dono,c,inimigo.base).ok)continue;
            const dano=M.ataqueTotal(inimigo,c.base,e);
            risco+=Math.min(c.defesa,dano)*.6+(dano>=c.defesa?65:0);
        }
        return risco;
    }
    const LIMITE_OBSERVACOES = 16;
    function impactoOfensivo(antes, depois, alvo) {
        const a=antes.jogadores[alvo],b=depois.jogadores[alvo];
        const defesa=j=>j.campo.reduce((s,c)=>s+c.defesa,0);
        return b.derrotados>a.derrotados || defesa(b)<defesa(a) || b.campo.length<a.campo.length || b.apoio.length<a.apoio.length || b.campo.some((c,i)=>['paralisia','confusao','veneno','queimadura'].some(k=>(Number(c.st[k])||0)>(Number(a.campo[i]?.st[k])||0)));
    }
    function observar(antes, depois, dono, tipo, alvo = null) {
        if (!Object.hasOwn(ACOES,tipo) && tipo !== 'encerrar') return;
        const memoria = structuredClone(antes.padroesIA || {});
        const lista = Array.isArray(memoria[dono]) ? memoria[dono] : [];
        let alvoPublico = null;
        if (Number.isInteger(alvo) && antes.jogadores[alvo] && ['atacar','habilidade'].includes(tipo)) {
            if (tipo === 'atacar' || impactoOfensivo(antes,depois,alvo)) alvoPublico = alvo;
        }
        memoria[dono] = [...lista.slice(-(LIMITE_OBSERVACOES-1)), { tipo, alvo: alvoPublico, turno: antes.numTurno }];
        depois.padroesIA = memoria;
    }
    function padrao(estado, dono) {
        const acoes = Array.isArray(estado.padroesIA?.[dono]) ? estado.padroesIA[dono] : [];
        const tipos = {};
        for (const a of acoes) tipos[a.tipo] = (tipos[a.tipo] || 0) + 1;
        const jogadas = acoes.filter(a=>a.tipo!=='encerrar').length;
        return { acoes, tipos, agressividade: (tipos.atacar || 0) / Math.max(1,jogadas) };
    }
    function bonusAprendizado(estado, copia, dono, alvo, tipo) {
        const rival = padrao(estado,alvo), propria = copia.jogadores[dono];
        let bonus = 0;
        if (rival.acoes.length >= 3) {
            if (['equipar','apoio','habilidade'].includes(tipo)) {
                const defesaAntes = estado.jogadores[dono].campo[0]?.defesa || 0;
                const ganho = Math.max(0,(propria.campo[0]?.defesa || 0)-defesaAntes);
                bonus += Math.min(15,ganho*.8)*rival.agressividade;
                bonus += Math.max(0,riscoPublico(estado,dono)-riscoPublico(copia,dono))*rival.agressividade*.2;
            }
            if (tipo === 'invocar') bonus += Math.min(20,propria.campo[0]?.defesa || 0)*rival.agressividade*.3;
            const apoiosRemovidos = estado.jogadores[alvo].apoio.length-copia.jogadores[alvo].apoio.length;
            if (apoiosRemovidos > 0) bonus += Math.min(12,apoiosRemovidos*6)*(rival.tipos.apoio || 0)/Math.max(1,rival.acoes.length);
        }
        if (tipo==='atacar'||(tipo==='habilidade'&&impactoOfensivo(estado,copia,alvo))) for (let i=0;i<estado.jogadores.length;i++) {
            if (i===dono || estado.equipes[i]!==estado.equipes[dono] || estado.jogadores[i].eliminado) continue;
            const ultima = padrao(estado,i).acoes.findLast(a=>a.alvo!==null);
            if (ultima && ultima.alvo===alvo && estado.numTurno-ultima.turno<=estado.jogadores.length*2) bonus += 10;
        }
        return Math.min(30,bonus);
    }
    function escolher(estado, nivel='normal', aleatorio=Math.random) {
        const dono=estado.turno,j=estado.jogadores[dono],tentativas=[],validas=[];
        if (estado.vencedor!==null || estado.acoes<=0 || j.eliminado || estado.torneio?.aguardando.includes(dono)) return null;
        const turno = j.iaTurno?.turno===estado.numTurno ? j.iaTurno : {turno:estado.numTurno,compras:0};
        for(const c of j.mao) {
            const cl=M.classeDe(c);
            if(M.ehCriatura(c))tentativas.push({tipo:'invocar',uid:c.uid});
            if(cl==='auxiliar')tentativas.push({tipo:'apoio',uid:c.uid});
            if(cl==='arma'||cl==='item')tentativas.push({tipo:'equipar',uid:c.uid});
        }
        tentativas.push({tipo:'atacar'});
        for(const c of [...j.mao,...j.campo,...j.apoio,...j.campo.flatMap(c=>c.equip)])tentativas.push({tipo:'habilidade',uid:c.uid});
        if (turno.compras<1) tentativas.push({tipo:'comprar'});
        for(const alvo of M.adversarios(estado))for(const pedido of tentativas) {
            let copia=structuredClone(estado);copia.alvo=alvo;
            let escolha,res=ACOES[pedido.tipo](copia,pedido);
            for(let i=0;res?.pergunta?.opcoes.length&&i<8;i++) {
                escolha=res.pergunta.opcoes[0].valor;
                copia=structuredClone(estado);copia.alvo=alvo;
                res=ACOES[pedido.tipo](copia,{...pedido,escolha});
            }
            if(!res?.ok)continue;
            const antes=estado.jogadores[alvo],depois=copia.jogadores[alvo],propria=copia.jogadores[dono];
            let pontos=({invocar:j.campo.length?0:30,apoio:12,equipar:16,atacar:14,habilidade:10,comprar:4})[pedido.tipo];
            pontos+=(depois.derrotados-antes.derrotados)*100-(propria.derrotados-j.derrotados)*110;
            if(antes.campo[0])pontos+=Math.max(0,antes.campo[0].defesa-(depois.campo[0]?.defesa||0));
            if(copia.vencedor===estado.equipes[dono])pontos+=1000;
            if(nivel==='dificil') {
                pontos+=riscoPublico(estado,dono)-riscoPublico(copia,dono);
                if(propria.campo[0])pontos+=Math.min(30,M.ataqueTotal(propria.campo[0],depois.campo[0]?.base,copia))*.4;
                pontos+=(propria.mao.length-j.mao.length)*2;
                if(j.derrotados>=2&&!propria.campo.length)pontos-=100;
            }
            const aprendizado=bonusAprendizado(estado,copia,dono,alvo,pedido.tipo);
            pontos+=aprendizado*(nivel==='dificil'?1.3:1);
            validas.push({copia,res,tipo:pedido.tipo,pontos,aprendizado,pedido:{...pedido,alvo,...(escolha===undefined?{}:{escolha})}});
        }
        if(!validas.length)return null;
        // Usar as cartas disponíveis vem antes de comprar; compra direta custa no máximo uma ação por turno.
        const comCartas=validas.filter(v=>v.tipo!=='comprar');
        const opcoes=comCartas.length?comCartas:validas;
        opcoes.sort((a,b)=>b.pontos-a.pontos);
        let escolhida;
        if(nivel==='facil') {
            const invocar=opcoes.filter(v=>v.tipo==='invocar');
            const pool=!j.campo.length&&invocar.length?invocar:opcoes;
            const pesos=pool.map(v=>1+v.aprendizado/30),total=pesos.reduce((s,n)=>s+n,0);
            let sorte=Math.min(.999999,Math.max(0,aleatorio()))*total;
            escolhida=pool[pool.length-1];
            for(let i=0;i<pool.length;i++){sorte-=pesos[i];if(sorte<0){escolhida=pool[i];break;}}
        }else escolhida=opcoes[0];
        escolhida.copia.jogadores[dono].iaTurno={turno:estado.numTurno,compras:turno.compras+(escolhida.tipo==='comprar'?1:0)};
        return escolhida;
    }
    const IA={NIVEIS,ACOES,escolher,observar};
    if(typeof module!=='undefined'&&module.exports)module.exports=IA;else raiz.IA=IA;
})(typeof window!=='undefined'?window:globalThis);
