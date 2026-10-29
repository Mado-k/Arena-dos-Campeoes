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
  habilidade: (e, d) => Motor.executarHabilidade(e, d.uid, d.escolha)
};
const ROTULOS = { comprar: 'comprou uma carta', encerrar: 'encerrou o turno', invocar: 'colocou uma criatura em batalha', apoio: 'colocou um auxiliar em apoio', equipar: 'equipou uma carta', atacar: 'atacou', habilidade: 'executou uma habilidade' };

class Partida {
  static tamanhoCoop(total, humanos) {
    return Motor.tamanhoParaParticipantes(total, humanos * 2);
  }

  constructor(jogadores, cartas, modo = 'multiplayer', tamanhoBaralho = 40, { dificuldade = 'normal' } = {}) {
    this.coop = modo === 'coop';
    this.local = modo === 'local';
    if (!IA.NIVEIS.includes(dificuldade)) throw new Error('Dificuldade inválida.');
    this.dificuldade = dificuldade;
    if (this.local && ![2,3,4].includes(jogadores.length)) throw new Error('O Local entre pessoas aceita de dois a quatro jogadores.');
    if (!this.coop && !this.local && jogadores.length !== 2) throw new Error('O duelo precisa de dois jogadores.');
    if (this.coop && ![1, 2, 3, 4].includes(jogadores.length)) throw new Error('O co-op aceita de um a quatro jogadores.');
    if (this.coop) tamanhoBaralho = Partida.tamanhoCoop(tamanhoBaralho, jogadores.length);
    this.ids = jogadores.map(j => j.id);
    const maquinas = this.coop ? jogadores.length : 0;
    const nomes = [...jogadores.map(j => j.nome), ...Array.from({ length: maquinas }, (_, i) => `Máquina ${i + 1}`)];
    const config = { nomes, tamanhoBaralho, todosContraTodos: this.local && jogadores.length > 2 };
    config.reps = jogadores.map(j => {
      if (!j.representante) return null;
      const rep = cartas.find(c => c.codigo === j.representante && Motor.norm(c.classe) === 'representante');
      if (!rep) throw Object.assign(new Error('O representante escolhido não está disponível. Volte à sala e escolha novamente.'), { code: 'REPRESENTANTE_INVALIDO' });
      return Motor.normalizarCarta(rep);
    });
    if (this.coop) {
      config.equipes = nomes.map((_, i) => i < jogadores.length ? 0 : 1);
      config.maquinas = nomes.map((_, i) => i >= jogadores.length);
      config.comeca = 0;
      config.ordemTurnos = jogadores.flatMap((_, i) => [i, i + jogadores.length]);
    }
    this.estado = Motor.novoJogo(config, cartas);
    this.revisao = 0;
    this.log = ['Partida iniciada. Cada jogador recebe três cartas e tem duas ações por turno.'];
  }

  agir(id, dados) {
    const participante = this.ids.indexOf(id);
    const indice = participante;
    if (indice < 0) return { erro: 'Você não participa desta partida.' };
    if (!dados || typeof dados !== 'object' || !Object.hasOwn(ACOES, dados.tipo)) return { erro: 'Ação inválida.' };
    if (dados.revisao !== this.revisao) return { erro: 'A mesa mudou. Confira o estado atualizado e tente novamente.' };
    if (this.estado.vencedor !== null) return { erro: 'A partida já terminou.' };
    if (this.estado.jogadores[indice].eliminado) return { erro: 'Você foi eliminado. Acompanhe a equipe até o fim.' };
    if (indice !== this.estado.turno) return { erro: 'Aguarde seu turno.' };
    if (['invocar', 'apoio', 'equipar', 'habilidade'].includes(dados.tipo)) {
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
    const redistribuiu = (proximo.redistribuicoes || 0) !== (this.estado.redistribuicoes || 0);
    const serieAnterior = this.estado.serieEvento || 0;
    this.estado = proximo;
    this.revisao++;
    // Logs internos de habilidades podem citar cartas compradas/escolhidas no baralho.
    // O registro público descreve a ação, sem revelar essas informações privadas.
    this.log.push(resposta.registroCombate || resposta.registroHabilidade || `${this.estado.jogadores[indice].nome} ${ROTULOS[dados.tipo]}.`);
    this.log.push(...(this.estado.eventosPublicos||[]).filter(x=>x.seq>serieAnterior).map(x=>x.texto));
    if (this.estado.motivoEmpate) this.log.push(this.estado.motivoEmpate);
    if (redistribuiu) this.log.push(this.estado.log.findLast(l => /^(Os dois|Todos os) baralhos acabaram\./.test(l)));
    if (this.estado.vencedor === null && this.estado.jogadores[this.estado.turno].eliminado) Motor.encerrarTurno(this.estado);
    this.log = this.log.slice(-100);
    return { ok: true };
  }

  jogarComputador() {
    if (!this.coop) return;
    // Processa todas as máquinas consecutivas quando turnos de humanos são pulados.
    let turnos = 0;
    const limiteTurnos = this.estado.jogadores.filter(j => j.maquina).length;
    while (this.estado.vencedor === null && this.estado.jogadores[this.estado.turno].maquina && turnos++ < limiteTurnos) {
      const indice = this.estado.turno;
      const nome = this.estado.jogadores[indice].nome;
      const limite = this.estado.jogadores[indice].acoesPorTurno;
      for (let passo = 0; passo < limite && this.estado.acoes > 0 && this.estado.vencedor === null && !this.estado.jogadores[indice].eliminado; passo++) {
        const melhor = IA.escolher(this.estado, this.dificuldade);
        if (!melhor) break;
        const serieAnterior = this.estado.serieEvento || 0;
        this.estado = melhor.copia;
        this.revisao++;
        this.log.push(melhor.res.registroCombate || melhor.res.registroHabilidade || `${nome} ${ROTULOS[melhor.tipo]}.`);
        this.log.push(...(this.estado.eventosPublicos||[]).filter(x=>x.seq>serieAnterior).map(x=>x.texto));
      }
      if (this.estado.vencedor === null) {
        const serieAnterior = this.estado.serieEvento || 0;
        Motor.encerrarTurno(this.estado);
        this.log.push(...(this.estado.eventosPublicos||[]).filter(x=>x.seq>serieAnterior).map(x=>x.texto));
        this.revisao++;
        this.log.push(`${nome} encerrou o turno. Vez de ${this.estado.jogadores[this.estado.turno].nome}.`);
      }
      this.log = this.log.slice(-100);
    }
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
      voce, cooperativo: this.coop, todosContraTodos: Boolean(e.todosContraTodos), dificuldade: this.dificuldade, tamanhoBaralho: e.tamanhoBaralho, revisao: this.revisao, turno: e.turno, numTurno: e.numTurno,
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
