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

class Partida {
  constructor(jogadores, cartas, modo = 'multiplayer', tamanhoBaralho = 40) {
    this.coop = modo === 'coop';
    if (!this.coop && jogadores.length !== 2) throw new Error('O duelo precisa de dois jogadores.');
    this.ids = jogadores.map(j => j.id);
    this.estado = Motor.novoJogo({ nomes: this.coop ? ['Equipe', 'Computador'] : jogadores.map(j => j.nome), tamanhoBaralho, ...(this.coop ? { comeca: 0 } : {}) }, cartas);
    this.revisao = 0;
    this.log = ['Partida iniciada. Cada jogador recebe três cartas e tem duas ações por turno.'];
  }

  agir(id, dados) {
    const participante = this.ids.indexOf(id);
    const indice = participante < 0 ? -1 : this.coop ? 0 : participante;
    if (indice < 0) return { erro: 'Você não participa desta partida.' };
    if (!dados || typeof dados !== 'object' || !Object.hasOwn(ACOES, dados.tipo)) return { erro: 'Ação inválida.' };
    if (dados.revisao !== this.revisao) return { erro: 'A mesa mudou. Confira o estado atualizado e tente novamente.' };
    if (this.estado.vencedor !== null) return { erro: 'A partida já terminou.' };
    if (indice !== this.estado.turno) return { erro: 'Aguarde seu turno.' };
    if (['invocar', 'apoio', 'equipar', 'habilidade'].includes(dados.tipo)) {
      if (!Number.isSafeInteger(dados.uid)) return { erro: 'Carta inválida.' };
      const loc = Motor.localizar(this.estado, dados.uid);
      if (!loc || loc.dono !== indice) return { erro: 'Escolha uma carta sua.' };
    }
    if (dados.escolha !== undefined && !['string', 'number'].includes(typeof dados.escolha)) return { erro: 'Escolha inválida.' };
    // Executar numa cópia também impede mutações parciais em ações recusadas.
    const proximo = structuredClone(this.estado);
    const resposta = ACOES[dados.tipo](proximo, dados);
    if (!resposta || !resposta.ok) return resposta || { erro: 'Não foi possível executar a ação.' };
    this.estado = proximo;
    this.revisao++;
    // Logs internos de habilidades podem citar cartas compradas/escolhidas no baralho.
    // O registro público descreve a ação, sem revelar essas informações privadas.
    const rotulos = { comprar: 'comprou uma carta', encerrar: 'encerrou o turno', invocar: 'colocou uma criatura em batalha', apoio: 'colocou um auxiliar em apoio', equipar: 'equipou uma carta', atacar: 'atacou', habilidade: 'executou uma habilidade' };
    this.log.push(resposta.registroCombate || `${this.estado.jogadores[indice].nome} ${rotulos[dados.tipo]}.`);
    this.log = this.log.slice(-100);
    return { ok: true };
  }

  jogarComputador() {
    if (!this.coop || this.estado.turno !== 1 || this.estado.vencedor !== null) return;
    // A IA só consulta a própria mão e as zonas públicas. Não olha a mão da equipe.
    for (let passo = 0; passo < 2 && this.estado.acoes > 0 && this.estado.vencedor === null; passo++) {
      const j = this.estado.jogadores[1];
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
      let executou = false;
      for (const [tipo, uid] of tentativas) {
        let copia = structuredClone(this.estado);
        let res = ACOES[tipo](copia, { uid });
        if (res && res.pergunta && res.pergunta.opcoes.length) {
          copia = structuredClone(this.estado);
          res = ACOES[tipo](copia, { uid, escolha: res.pergunta.opcoes[0].valor });
        }
        if (res && res.ok) {
          this.estado = copia;
          this.revisao++;
          this.log.push(res.registroCombate || 'O computador executou uma ação: ' + tipo + '.');
          executou = true;
          break;
        }
      }
      if (!executou) break;
    }
    if (this.estado.vencedor === null) {
      Motor.encerrarTurno(this.estado);
      this.revisao++;
      this.log.push('O computador encerrou o turno. Vez da equipe.');
    }
    this.log = this.log.slice(-100);
  }

  visao(id) {
    const participante = this.ids.indexOf(id);
    const voce = participante < 0 ? -1 : this.coop ? 0 : participante;
    if (voce < 0) return null;
    const e = this.estado;
    const carta = c => ({ ...structuredClone(c), equip: c.equip.map(carta), habilidade: Motor.estadoHabilidade(e, c.uid) });
    return {
      voce, cooperativo: this.coop, tamanhoBaralho: e.tamanhoBaralho, revisao: this.revisao, turno: e.turno, numTurno: e.numTurno,
      acoes: e.acoes, vencedor: e.vencedor, pandora: e.pandora, log: this.log.slice(),
      jogadores: e.jogadores.map((j, i) => ({
        nome: j.nome, derrotados: j.derrotados,
        maoTotal: j.mao.length, baralhoTotal: j.baralho.length,
        mao: i === voce ? j.mao.map(carta) : [],
        campo: j.campo.map(carta), apoio: j.apoio.map(carta), descarte: j.descarte.map(carta)
      }))
    };
  }
}

module.exports = Partida;
