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
    function escolher(estado, nivel='normal', aleatorio=Math.random) {
        const dono=estado.turno,j=estado.jogadores[dono],tentativas=[],validas=[];
        for(const c of j.mao) {
            const cl=M.classeDe(c);
            if(M.ehCriatura(c))tentativas.push({tipo:'invocar',uid:c.uid});
            if(cl==='auxiliar')tentativas.push({tipo:'apoio',uid:c.uid});
            if(cl==='arma'||cl==='item')tentativas.push({tipo:'equipar',uid:c.uid});
        }
        tentativas.push({tipo:'atacar'});
        for(const c of [...j.mao,...j.campo,...j.apoio,...j.campo.flatMap(c=>c.equip)])tentativas.push({tipo:'habilidade',uid:c.uid});
        tentativas.push({tipo:'comprar'});
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
            validas.push({copia,res,tipo:pedido.tipo,pontos,pedido:{...pedido,alvo,...(escolha===undefined?{}:{escolha})}});
        }
        if(!validas.length)return null;
        validas.sort((a,b)=>b.pontos-a.pontos);
        if(nivel==='facil') {
            const invocar=validas.filter(v=>v.tipo==='invocar');
            const pool=!j.campo.length&&invocar.length?invocar:validas;
            return pool[Math.min(pool.length-1,Math.floor(aleatorio()*pool.length))];
        }
        return validas[0];
    }
    const IA={NIVEIS,ACOES,escolher};
    if(typeof module!=='undefined'&&module.exports)module.exports=IA;else raiz.IA=IA;
})(typeof window!=='undefined'?window:globalThis);
