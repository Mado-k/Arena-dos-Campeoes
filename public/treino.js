// Roteiro isolado da partida para iniciantes. As ações usam o motor normal.
(function(raiz){
    'use strict';
    const M=typeof module!=='undefined'&&module.exports?require('./motor'):raiz.Motor;
    const Partida=typeof module!=='undefined'&&module.exports?require('./partida'):raiz.Partida;
    const passos=[
        ['invocar','n032','Seu primeiro campeão','Toque em Marie Curie Zumbi na sua mão e depois em Colocar em batalha. Ela tem ataque e defesa altos para este treino.'],
        ['apoio','n009','Uma ajuda em campo','Toque em Fuleco e depois em Colocar em apoio. Auxiliares precisam de uma criatura em batalha; sua habilidade passiva funciona sozinha.'],
        ['encerrar',null,'Duas ações por turno','Suas duas ações acabaram. Clique em Encerrar turno no aviso para ver a máquina jogar.'],
        ['comprar',null,'Prepare sua próxima jogada','Clique diretamente na pilha de compra. Você receberá o Cobertor e gastará uma ação. O contador ao lado do seu nome mostra quantas restam.'],
        ['equipar','n026','Defesa com uma combinação','Selecione o Cobertor comprado e clique em Equipar. Fuleco dobra seu bônus de defesa de 11 para 22.'],
        ['encerrar',null,'Preparação concluída','Encerre o turno. Sua campeã está protegida e pronta para atacar na próxima vez.'],
        ['atacar','n032','Seu primeiro ataque','Selecione Marie Curie Zumbi em batalha e clique em Atacar criatura inimiga. Compare seu ATQ com a DEF adversária: aqui, um ataque basta.'],
        ['equipar','n021','Mais força para o próximo confronto','Selecione Batsopra Bolha na mão e clique em Equipar. Uma arma aumenta o ataque do campeão; bestas não podem usar armas.'],
        ['encerrar',null,'Um campeão já foi derrotado','Encerre o turno. Observe a pontuação: o objetivo é derrotar três campeões adversários.'],
        ['atacar','n032','Repita a boa escolha','Selecione sua campeã e ataque. Sua preparação continua valendo nos próximos turnos.'],
        ['comprar',null,'Tenha uma reserva','Clique na pilha de compra para receber Guss Deus do Design. Guarde a criatura: vamos praticar uma substituição antes do último confronto.'],
        ['encerrar',null,'Prepare o último confronto','Encerre o turno. A máquina colocará seu terceiro campeão em batalha.'],
        ['eliminar','n032','Uma troca tem consequências','Selecione Marie Curie Zumbi, clique em Eliminar carta e confirme. Custa uma ação e conta uma derrota de campeão para você. Seus equipamentos e Fuleco também vão ao descarte.'],
        ['descarte',null,'Confira o que foi descartado','Clique diretamente na pilha de descarte para ver a campeã e seus anexos. Consultar a pilha não gasta ação. Três campeões seus derrotados fazem você perder: use a troca com cuidado.'],
        ['invocar','n034','Sua criatura de reserva','Feche o descarte, selecione Guss Deus do Design na mão e coloque-o em batalha. O contador ao lado do seu nome mostra que essa é a última ação do turno.'],
        ['encerrar',null,'Troca concluída','Encerre o turno para preparar os dois ataques finais. Guss é seu novo campeão; você ainda pode vencer mesmo com uma derrota própria.'],
        ['atacar','n034','Observe o contra-ataque','Selecione Guss Deus do Design e ataque. Como o adversário sobrevive ao primeiro golpe, ele contra-ataca. O registro mostra o dano e a defesa restante de ambos.'],
        ['atacar','n034','Agora, conquiste a vitória','Ataque novamente com Guss Deus do Design. A terceira derrota de campeão adversário encerra a partida a seu favor!']
    ];
    class TreinoIniciante{
        constructor(cartas){
            const seus=['n032','n009','n021','n034','n026'],rival=['n039','n013','n035','n024','n005'];
            const escolhidos=[...seus,...rival].map(cod=>cartas.find(c=>c.codigo===cod));
            if(escolhidos.some(c=>!c))throw new Error('As cartas necessárias para o treino não estão disponíveis.');
            // Inicializar pelo controlador comum, depois montar apenas as dez cartas ensaiadas.
            const pool=[...escolhidos,...cartas.filter(c=>!escolhidos.includes(c)&&M.norm(c.classe)!=='representante').slice(0,10)];
            this.partida=new Partida([{id:'iniciante',nome:'Você'}],pool,'local',20,{maquinas:1,dificuldade:'facil',representantesMaquinas:[null]});
            const e=this.partida.estado,todas=e.jogadores.flatMap(j=>[...j.mao,...j.baralho]);
            const obter=cod=>todas.find(c=>c.base.codigo===cod);
            for(const j of e.jogadores)for(const z of ['mao','baralho','campo','apoio','descarte'])j[z]=[];
            e.jogadores[0].mao=seus.slice(0,3).map(obter);e.jogadores[0].baralho=seus.slice(3).map(obter);
            e.jogadores[1].nome='Máquina de treino';e.jogadores[1].mao=rival.slice(0,3).map(obter);e.jogadores[1].baralho=rival.slice(3).map(obter);
            e.tamanhoBaralho=10;e.turno=0;e.numTurno=1;e.acoes=2;e.log=[];delete e.padroesIA;
            this.partida.log=['Treino ensaiado: cinco cartas por invocador. Siga as indicações para aprender e vencer.'];
            this.indice=0;this.compraIA=-1;
        }
        get etapa(){
            const p=passos[this.indice];
            return p?{tipo:p[0],codigo:p[1],titulo:p[2],texto:p[3],numero:this.indice+1,total:passos.length}:null;
        }
        get totalEtapas(){return passos.length;}
        consultarDescarte(dono){
            if(this.etapa?.tipo!=='descarte'||dono!==0||!this.partida.estado.jogadores[0].descarte.length)return false;
            this.indice++;return true;
        }
        visao(){return this.partida.visao('iniciante');}
        agir(dados){
            const p=this.etapa,e=this.partida.estado;
            if(!p||e.vencedor!==null)return {erro:'Este treino terminou. Você pode jogar novamente.'};
            if(e.turno!==0)return {erro:'Observe a jogada da máquina. Sua vez já vai chegar.'};
            const loc=dados?.uid==null?null:M.localizar(e,dados.uid);
            const origem=dados?.tipo==='atacar'?e.jogadores[0].campo[0]:loc?.inst;
            if(dados?.tipo!==p.tipo||(p.codigo&&origem?.base.codigo!==p.codigo))return {erro:'Vamos por partes: '+p.texto};
            const res=this.partida.agir('iniciante',dados);
            if(res.ok)this.indice++;
            return res;
        }
        passoComputador(){
            const e=this.partida.estado,j=e.jogadores[1];
            if(e.vencedor!==null||e.turno!==1)return false;
            let res,texto;
            // A adversária é ensaiada: oferece três confrontos curtos, sem habilidades ofensivas.
            const c=j.mao.find(M.ehCampeao);
            if(e.acoes>0&&!j.campo.length&&c){res=M.invocar(e,c.uid);texto='Máquina de treino colocou '+c.base.nome+' em batalha.';}
            else if(e.acoes>0&&j.baralho.length&&this.compraIA!==e.numTurno){res=M.comprarAcao(e);this.compraIA=e.numTurno;texto='Máquina de treino comprou uma carta.';}
            else {res=M.encerrarTurno(e);texto='Máquina de treino encerrou o turno.';}
            if(!res.ok)throw new Error(res.erro);
            this.partida.revisao++;this.partida.log.push(texto);return true;
        }
    }
    if(typeof module!=='undefined'&&module.exports)module.exports=TreinoIniciante;else raiz.TreinoIniciante=TreinoIniciante;
})(typeof window!=='undefined'?window:globalThis);
