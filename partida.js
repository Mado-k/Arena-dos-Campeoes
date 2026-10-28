// Autoridade da partida: o cliente pede ações; apenas o servidor altera o motor.
const Motor = require('./public/motor');

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
  constructor(jogadores, cartas, modo = 'multiplayer', tamanhoBaralho = 40) {
    this.coop = modo === 'coop';
    if (!this.coop && jogadores.length !== 2) throw new Error('O duelo precisa de dois jogadores.');
    if (this.coop && ![2, 4].includes(jogadores.length)) throw new Error('O co-op precisa de dois ou quatro jogadores.');
    if (this.coop && jogadores.length === 4 && tamanhoBaralho === 20) throw new Error('Quatro jogadores precisam de 30 ou 40 cartas.');
    this.ids = jogadores.map(j => j.id);
    const maquinas = this.coop ? jogadores.length / 2 : 0;
    const nomes = [...jogadores.map(j => j.nome), ...Array.from({ length: maquinas }, (_, i) => `Máquina ${i + 1}`)];
    const config = { nomes, tamanhoBaralho };
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
      config.ordemTurnos = jogadores.length === 2 ? [0, 1, 2] : [0, 1, 4, 2, 3, 5];
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
    this.estado = proximo;
    this.revisao++;
    // Logs internos de habilidades podem citar cartas compradas/escolhidas no baralho.
    // O registro público descreve a ação, sem revelar essas informações privadas.
    this.log.push(resposta.registroCombate || `${this.estado.jogadores[indice].nome} ${ROTULOS[dados.tipo]}.`);
    if (redistribuiu) this.log.push(this.estado.log.findLast(l => l.startsWith('Os dois baralhos acabaram.')));
    if (this.estado.vencedor === null && this.estado.jogadores[this.estado.turno].eliminado) Motor.encerrarTurno(this.estado);
    this.log = this.log.slice(-100);
    return { ok: true };
  }

  jogarComputador() {
    if (!this.coop) return;
    // No máximo duas máquinas consecutivas quando os humanos de uma equipe foram eliminados.
    let turnos = 0;
    while (this.estado.vencedor === null && this.estado.jogadores[this.estado.turno].maquina && turnos++ < 2) {
      const indice = this.estado.turno;
      const nome = this.estado.jogadores[indice].nome;
      const limite = this.estado.jogadores[indice].acoesPorTurno;
      for (let passo = 0; passo < limite && this.estado.acoes > 0 && this.estado.vencedor === null && !this.estado.jogadores[indice].eliminado; passo++) {
        const j = this.estado.jogadores[indice];
        const tentativas = [];
        for (const c of j.mao) {
          const cl = Motor.classeDe(c);
          if (Motor.ehCriatura(c)) tentativas.push(['invocar', c.uid]);
          if (cl === 'auxiliar') tentativas.push(['apoio', c.uid]);
          if (cl === 'arma' || cl === 'item') tentativas.push(['equipar', c.uid]);
        }
        tentativas.push(['atacar']);
        for (const c of [...j.mao, ...j.campo, ...j.apoio, ...j.campo.flatMap(c => c.equip)]) tentativas.push(['habilidade', c.uid]);
        tentativas.push(['comprar']);
        let melhor = null;
        // Avalia a própria mão e os campos públicos; não usa a mão nem a ordem dos baralhos humanos.
        for (const alvo of Motor.adversarios(this.estado)) for (const [tipo, uid] of tentativas) {
          let copia = structuredClone(this.estado);
          copia.alvo = alvo;
          let res = ACOES[tipo](copia, { uid });
          for (let pergunta = 0; res?.pergunta?.opcoes.length && pergunta < 8; pergunta++) {
            const escolha = res.pergunta.opcoes[0].valor;
            copia = structuredClone(this.estado); copia.alvo = alvo;
            res = ACOES[tipo](copia, { uid, escolha });
          }
          if (!res || !res.ok) continue;
          const antes = this.estado.jogadores[alvo], depois = copia.jogadores[alvo];
          const propria = copia.jogadores[indice];
          let pontos = ({ invocar: j.campo.length ? 0 : 30, apoio: 12, equipar: 16, atacar: 14, habilidade: 10, comprar: 4 })[tipo];
          pontos += (depois.derrotados - antes.derrotados) * 100 - (propria.derrotados - j.derrotados) * 110;
          if (antes.campo[0]) pontos += Math.max(0, antes.campo[0].defesa - (depois.campo[0]?.defesa || 0));
          if (copia.vencedor === 1) pontos += 1000;
          if (!melhor || pontos > melhor.pontos) melhor = { copia, res, tipo, pontos };
        }
        if (!melhor) break;
        this.estado = melhor.copia;
        this.revisao++;
        this.log.push(melhor.res.registroCombate || `${nome} ${ROTULOS[melhor.tipo]}.`);
      }
      if (this.estado.vencedor === null) {
        Motor.encerrarTurno(this.estado);
        this.revisao++;
        this.log.push(`${nome} encerrou o turno. Vez de ${this.estado.jogadores[this.estado.turno].nome}.`);
      }
      this.log = this.log.slice(-100);
    }
  }

  visao(id) {
    const participante = this.ids.indexOf(id);
    const voce = participante;
    if (voce < 0) return null;
    const e = this.estado;
    const carta = c => ({ ...structuredClone(c), equip: c.equip.map(carta), habilidade: Motor.estadoHabilidade(e, c.uid) });
    return {
      voce, cooperativo: this.coop, tamanhoBaralho: e.tamanhoBaralho, revisao: this.revisao, turno: e.turno, numTurno: e.numTurno,
      acoes: e.acoes, acoesPorTurno: e.jogadores[e.turno].acoesPorTurno, equipes: e.equipes, ordemTurnos: e.ordemTurnos, alvo: Motor.indiceOponente(e), vencedor: e.vencedor, pandora: e.pandora, reservaCentralTotal: e.reservaCentral?.length || 0, log: this.log.slice(),
      jogadores: e.jogadores.map((j, i) => ({
        nome: j.nome, rep: j.rep ? structuredClone(j.rep) : null, derrotados: j.derrotados, equipe: j.equipe, maquina: j.maquina, eliminado: j.eliminado,
        maoTotal: j.mao.length, baralhoTotal: j.baralho.length,
        mao: i === voce ? j.mao.map(carta) : [],
        campo: j.campo.map(carta), apoio: j.apoio.map(carta), descarte: j.descarte.map(carta)
      }))
    };
  }
}

module.exports = Partida;
