// Autoridade da partida: o cliente pede ações; apenas o servidor altera o motor.
(function(raiz) {
const Motor = typeof module !== 'undefined' && module.exports ? require('./motor') : raiz.Motor;
const IA = typeof module !== 'undefined' && module.exports ? require('./ia') : raiz.IA;

const ACOES = {
  comprar: (e) => Motor.comprarAcao(e),
  encerrar: (e) => Motor.encerrarTurno(e),
  invocar: (e, d) => Motor.invocar(e, d.uid),
  apoio: (e, d) => Motor.colocarApoio(e, d.uid),
  equipar: (e, d) => Motor.equipar(e, d.uid),
  atacar: (e) => Motor.atacar(e),
  eliminar: (e, d) => Motor.eliminarCarta(e,d.uid),
  habilidade: (e, d) => Motor.executarHabilidade(e, d.uid, d.escolha)
};
const ROTULOS = { comprar: 'comprou uma carta', encerrar: 'encerrou o turno', invocar: 'colocou uma criatura em batalha', apoio: 'colocou um auxiliar em apoio', equipar: 'equipou uma carta', atacar: 'atacou', eliminar:'eliminou sua criatura em batalha', habilidade: 'executou uma habilidade' };

class Partida {
  static tamanhoCoop(total, humanos) {
    return Motor.tamanhoParaParticipantes(total, humanos * 2);
  }

  constructor(jogadores, cartas, modo = 'multiplayer', tamanhoBaralho = 40, { dificuldade = 'normal', formato = 'livre', maquinas = 0, vagasEquipe, representantesMaquinas } = {}) {
    this.coop = modo === 'coop';
    this.local = modo === 'local';
    if (!IA.NIVEIS.includes(dificuldade)) throw new Error('Dificuldade inválida.');
    if (!['livre','2v2'].includes(formato)) throw new Error('Formato inválido.');
    if (!Number.isInteger(maquinas) || maquinas < 0 || maquinas > 4 || (!this.local && maquinas)) throw new Error('Quantidade de máquinas inválida.');
    const tamanhoEquipe=this.coop?(vagasEquipe??jogadores.length):null;
    if(vagasEquipe!==undefined&&(!this.coop||!Number.isInteger(vagasEquipe)||vagasEquipe<1||vagasEquipe>4||vagasEquipe<jogadores.length))throw new Error('A equipe precisa de uma a quatro vagas e espaço para todas as pessoas.');
    const aliadas=this.coop?tamanhoEquipe-jogadores.length:0;
    if (this.coop) maquinas = 2*tamanhoEquipe-jogadores.length;
    if(representantesMaquinas!==undefined&&(!Array.isArray(representantesMaquinas)||representantesMaquinas.length!==maquinas))throw new Error('A lista de representantes deve corresponder às máquinas da partida.');
    const quantidade = jogadores.length + maquinas;
    if (this.local && (!jogadores.length || jogadores.length > 4 || quantidade < 2 || quantidade > 5)) throw new Error('O Local aceita de dois a cinco participantes, sendo até quatro pessoas.');
    if (!this.coop && !this.local && ![2,3,4].includes(jogadores.length)) throw new Error('O multiplayer aceita de dois a quatro jogadores.');
    if (this.coop && ![1,2,3,4].includes(jogadores.length)) throw new Error('O co-op aceita de um a quatro jogadores.');
    if (formato === '2v2' && (this.coop || quantidade !== 4)) throw new Error('O 2v2 precisa de exatamente quatro invocadores.');
    this.dificuldade = dificuldade;
    this.ids = jogadores.map(j => j.id);
    const nomes = [...jogadores.map(j => j.nome), ...Array.from({ length: aliadas }, (_, i) => `Máquina aliada ${i + 1}`), ...Array.from({ length: maquinas-aliadas }, (_, i) => `Máquina ${i + 1}`)];
    const config = { nomes, tamanhoBaralho, todosContraTodos: !this.coop && formato !== '2v2' && quantidade > 2,
      torneio: !this.coop && formato !== '2v2' && quantidade > 2, equipes2v2: formato === '2v2' };
    config.reps = jogadores.map(j => {
      if (!j.representante) return null;
      const rep = cartas.find(c => c.codigo === j.representante && Motor.norm(c.classe) === 'representante');
      if (!rep) throw Object.assign(new Error('O representante escolhido não está disponível. Volte à sala e escolha novamente.'), { code: 'REPRESENTANTE_INVALIDO' });
      return Motor.normalizarCarta(rep);
    });
    const representantes = cartas.filter(c => Motor.norm(c.classe) === 'representante').map(Motor.normalizarCarta);
    for(let i=0;i<maquinas;i++){
      if(representantesMaquinas===undefined)config.reps.push([null,...representantes][Math.floor(Math.random()*(representantes.length+1))]);
      else{
        const codigo=representantesMaquinas[i],rep=representantes.find(c=>c.codigo===codigo);
        if(codigo!==null&&!rep)throw Object.assign(new Error('O representante de uma máquina não está disponível. Atualize a configuração antes de começar.'),{code:'REPRESENTANTE_INVALIDO'});
        config.reps.push(rep||null);
      }
    }
    config.maquinas = nomes.map((_,i) => i >= jogadores.length);
    if (this.coop) {
      config.equipes = nomes.map((_, i) => i < tamanhoEquipe ? 0 : 1);
      config.comeca = 0;
      config.ordemTurnos = Array.from({length:tamanhoEquipe},(_,i)=>[i,i+tamanhoEquipe]).flat();
    } else if (formato === '2v2') config.equipes = [0,1,0,1];
    if (this.local && maquinas && formato!=='2v2') config.comeca = 0;
    this.estado = Motor.novoJogo(config, cartas);
    this.revisao = 0;
    this.log = ['Partida iniciada. Cada jogador recebe três cartas e tem duas ações por turno.'];
    if(this.estado.arenas2v2)this.log.push(`Arena ${this.estado.arenaInicial} começa por sorteio. Os dois participantes de cada arena jogam em sequência.`);
  }

  agir(id, dados) {
    const participante = this.ids.indexOf(id);
    const indice = participante;
    if (indice < 0) return { erro: 'Você não participa desta partida.' };
    if (!dados || typeof dados !== 'object' || !Object.hasOwn(ACOES, dados.tipo)) return { erro: 'Ação inválida.' };
    if (dados.revisao !== this.revisao) return { erro: 'A mesa mudou. Confira o estado atualizado e tente novamente.' };
    if (this.estado.vencedor !== null) return { erro: 'A partida já terminou.' };
    if (this.estado.jogadores[indice].eliminado) return { erro: 'Você foi eliminado. Acompanhe a partida até o fim.' };
    if (this.estado.torneio?.aguardando.includes(indice)) return { erro: 'Você aguarda o próximo duelo do mata-mata.' };
    if (indice !== this.estado.turno) return { erro: 'Aguarde seu turno.' };
    if (['invocar', 'apoio', 'equipar', 'habilidade', 'eliminar'].includes(dados.tipo)) {
      if (!Number.isSafeInteger(dados.uid)) return { erro: 'Carta inválida.' };
      const loc = Motor.localizar(this.estado, dados.uid);
      if (!loc || loc.dono !== indice) return { erro: 'Escolha uma carta sua.' };
    }
    if (dados.escolha !== undefined && !['string', 'number'].includes(typeof dados.escolha)) return { erro: 'Escolha inválida.' };
    // Executar numa cópia também impede mutações parciais em ações recusadas.
    const proximo = structuredClone(this.estado);
    if (dados.alvo !== undefined) {
      if (!Number.isSafeInteger(dados.alvo) || !Motor.adversarios(proximo).includes(dados.alvo)) return { erro: 'Escolha um adversário que ainda esteja em jogo.' };
      proximo.alvo = dados.alvo;
    }
    const resposta = ACOES[dados.tipo](proximo, dados);
    if (!resposta || !resposta.ok) return resposta || { erro: 'Não foi possível executar a ação.' };
    IA.observar(this.estado,proximo,indice,dados.tipo,dados.alvo??Motor.indiceOponente(this.estado,indice));
    const redistribuiu = (proximo.redistribuicoes || 0) !== (this.estado.redistribuicoes || 0);
    const serieAnterior = this.estado.serieEvento || 0;
    this.estado = proximo;
    this.revisao++;
    // Logs internos de habilidades podem citar cartas compradas/escolhidas no baralho.
    // O registro público descreve a ação, sem revelar essas informações privadas.
    this.log.push(resposta.registroCombate || resposta.registroEliminacao || resposta.registroHabilidade || `${this.estado.jogadores[indice].nome} ${ROTULOS[dados.tipo]}.`);
    if (this.estado.vencedor === null && (this.estado.jogadores[this.estado.turno].eliminado || this.estado.torneio?.aguardando.includes(this.estado.turno))) Motor.encerrarTurno(this.estado);
    this.log.push(...(this.estado.eventosPublicos||[]).filter(x=>x.seq>serieAnterior).map(x=>x.texto));
    if (this.estado.motivoEmpate) this.log.push(this.estado.motivoEmpate);
    if (redistribuiu) this.log.push(this.estado.log.findLast(l => /^(Os dois|Todos os) baralhos acabaram\./.test(l)));
    this.log = this.log.slice(-100);
    return { ok: true };
  }

  passoComputador() {
    if(this.estado.vencedor!==null||!this.estado.jogadores[this.estado.turno].maquina)return false;
    const antes=this.estado,dono=antes.turno,nome=antes.jogadores[dono].nome;
    const serieAnterior=this.estado.serieEvento||0;
    const melhor=this.estado.acoes>0?IA.escolher(this.estado,this.dificuldade):null;
    if(melhor){
      this.estado=melhor.copia;
      IA.observar(antes,this.estado,dono,melhor.tipo,melhor.pedido.alvo);
      this.log.push(melhor.res.registroCombate||melhor.res.registroHabilidade||`${nome} ${ROTULOS[melhor.tipo]}.`);
    }else{
      this.estado=structuredClone(antes);Motor.encerrarTurno(this.estado);
      IA.observar(antes,this.estado,dono,'encerrar');
      this.log.push(this.estado.vencedor===null?`${nome} encerrou o turno. Vez de ${this.estado.jogadores[this.estado.turno].nome}.`:`${nome} encerrou o turno.`);
    }
    this.log.push(...(this.estado.eventosPublicos||[]).filter(x=>x.seq>serieAnterior).map(x=>x.texto));
    this.revisao++;this.log=this.log.slice(-100);return true;
  }

  jogarComputador() {
    // Execução sem espera para simulações. Interfaces publicam um passo por vez.
    const limite=this.estado.jogadores.length*4;
    for(let i=0;i<limite&&this.passoComputador();i++);
  }

  static restaurar(dados) {
    const p=Object.create(Partida.prototype);
    Object.assign(p,structuredClone(dados));
    p.dificuldade=p.dificuldade||'normal';
    if(p.estado.pandoraVersao!==2){p.estado.pandoraUsos=p.estado.pandoraUsada?1:0;p.estado.pandora=false;delete p.estado.danoPandora;}
    return p;
  }

  salvar() {
    return structuredClone({estado:this.estado,revisao:this.revisao,ids:this.ids,coop:this.coop,local:this.local,dificuldade:this.dificuldade,log:this.log});
  }

  visao(id) {
    const participante = this.ids.indexOf(id);
    const voce = participante;
    if (voce < 0) return null;
    const e = this.estado;
    const carta = c => ({ ...structuredClone(c), equip: c.equip.map(carta), habilidade: Motor.estadoHabilidade(e, c.uid) });
    return {
      voce, cooperativo: e.cooperativo, equipes2v2: Boolean(e.equipes2v2), arenas2v2:e.arenas2v2?structuredClone(e.arenas2v2):null, arenaInicial:e.arenaInicial??null, torneio: e.torneio ? structuredClone(e.torneio) : null, todosContraTodos: Boolean(e.todosContraTodos), dificuldade: this.dificuldade, tamanhoBaralho: e.tamanhoBaralho, revisao: this.revisao, turno: e.turno, numTurno: e.numTurno,
      serieVisual: e.serieVisual || 0, efeitosVisuais: structuredClone(e.efeitosVisuais || []),
      acoes: e.acoes, acoesPorTurno: e.jogadores[e.turno].acoesPorTurno, equipes: e.equipes, ordemTurnos: e.ordemTurnos, alvo: Motor.indiceOponente(e), vencedor: e.vencedor, motivoEmpate: e.motivoEmpate || '', pandora: e.pandora, danoPandora: e.danoPandora || 10, pandoraUsos: e.pandoraUsos || 0, reservaCentralTotal: e.reservaCentral?.length || 0, log: this.log.slice(),
      jogadores: e.jogadores.map((j, i) => ({
        nome: j.nome, bonusCampeao: j.bonusCampeao || 0, rep: j.rep ? structuredClone(j.rep) : null, derrotados: j.derrotados, equipe: j.equipe, maquina: j.maquina, eliminado: j.eliminado, acoesPorTurno: j.acoesPorTurno,
        maoTotal: j.mao.length, baralhoTotal: j.baralho.length,
        mao: i === voce ? j.mao.map(carta) : [],
        campo: j.campo.map(carta), apoio: j.apoio.map(carta), descarte: j.descarte.map(carta)
      }))
    };
  }
}

if(typeof module!=='undefined'&&module.exports)module.exports=Partida;else raiz.Partida=Partida;
})(typeof window!=='undefined'?window:globalThis);
