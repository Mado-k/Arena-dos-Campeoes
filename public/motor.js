// Motor de regras do Arena dos Campeões (sem nada de tela: só lógica).
// Funciona no navegador (window.Motor) e no Node (testes e seed.js).
(function (raiz) {
    'use strict';

    // ---------- Regras (documento de regras do Arena dos Campeões) ----------
    const REGRAS = {
        acoesPorTurno: 2,        // atacar, comprar, usar habilidade ou jogar uma carta
        maoInicial: 3,           // cartas na mão no início do jogo
        maxCampo: 1,             // só 1 campeão ou besta em batalha por jogador
        maxApoio: 2,             // auxiliares na batalha
        maxArmasCampeao: 1,      // cada campeão carrega uma única arma (bestas não carregam armas)
        maxItensCampeao: 1,      // um item por campeão
        maxItensBesta: 3,        // até três itens por besta
        campeoesParaVencer: 3,   // vença três campeões do adversário
        bonusRepresentante: 10   // defesa extra para criaturas do universo do representante (opcional)
    };

    // ---------- Efeitos passivos (aplicados sozinhos, chave = código da carta) ----------
    const EFEITOS = {
        n003: { maisContra: { quando: { origem: ['humanidade'] }, bonus: 2 } },
        n004: { silenciaAux: true },
        n007: { bonusCondicional: { elemento: ['fantasma', 'sombrio'] } },
        n010: { imuneA: { classe: ['campeão'] } },
        n011: { dobraContra: { elemento: ['metálico'] } },
        n012: { anulaUniverso: ['game'] },
        n013: { dobraACada3: true },
        n014: { dobraContra: { elemento: ['sombrio', 'fantasma', 'divino'] } },
        n015: { imuneA: { classe: ['besta'] } },
        n018: { dobraContra: { elemento: ['metálico'] } },
        n021: { silenciaAux: true },
        n022: { dino: 4 },
        n023: { fenrir: 100 },
        n025: { anulaElemento: ['divino'] },
        n026: { anulaHabElemento: ['fantasma'] },
        n027: { queimaContato: 7 },
        n029: { x10Se: ['sombrio'] },
        n030: { dobraContra: { universo: ['normal'] } },
        n033: { dobraBaseComArma: true },
        n037: { soFeridoPorElemento: ['fantasma'] },
        n038: { semEquip: true }
    };

    // ---------- utilidades ----------
    const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const classeDe = (inst) => norm(inst.base.classe);
    const ehCampeao = (inst) => classeDe(inst) === 'campeao';
    const ehCriatura = (inst) => ['campeao', 'besta'].includes(classeDe(inst));
    const temEfeito = (codigo) => Boolean(codigo && EFEITOS[codigo]);

    // Nome de exibição: primeira letra maiúscula em cada palavra, exceto "de", "da", "do"...
    // (palavras que já têm maiúsculas no meio, como "TI", ficam como estão). Não altera o banco.
    function tituloNome(nome) {
        const peq = ['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o'];
        return String(nome == null ? '' : nome).trim().split(/\s+/).map((p, i) => {
            if (/[A-ZÀ-Ý]/.test(p.slice(1))) return p;
            const min = p.toLowerCase();
            if (i > 0 && peq.includes(min)) return min;
            return min.charAt(0).toUpperCase() + min.slice(1);
        }).join(' ');
    }

    // toda carta tem ataque e defesa (aceita também o formato antigo dano/vida)
    function normalizarCarta(c) {
        const ataque = c.ataque != null ? c.ataque : c.dano;
        const defesa = c.defesa != null ? c.defesa : c.vida;
        return Object.assign({}, c, { nome: tituloNome(c.nome), ataque: Number(ataque) || 0, defesa: Number(defesa) || 0 });
    }

    function casa(criterios, base) {
        if (!criterios || !base) return false;
        return Object.entries(criterios).some(([campo, valores]) =>
            valores.some((v) => norm(v) === norm(base[campo])));
    }

    function embaralhar(lista) {
        const a = lista.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function log(estado, texto) {
        estado.log.push(texto);
        if (estado.log.length > 300) estado.log.shift();
    }

    const atual = (estado) => estado.jogadores[estado.turno];
    const outro = (estado) => estado.jogadores[1 - estado.turno];
    const fim = (estado) => (estado.vencedor !== null ? { erro: 'A partida já terminou.' } : null);
    const erro = (texto) => ({ erro: texto });
    const pedir = (titulo, opcoes) => ({ pergunta: { titulo, opcoes } });

    // st = efeitos temporários (somem quando a carta sai de batalha)
    // usos = habilidades de uso único (permanecem); rec = turnos para recarregar
    function nova(estado, base) {
        return {
            uid: estado.proxUid++, base,
            ataqueBase: base.ataque, ataqueAjuste: 0,
            defesa: base.defesa, defesaMax: base.defesa,
            equip: [], st: {}, usos: {}, rec: 0
        };
    }

    function reiniciar(inst) {
        inst.ataqueBase = inst.base.ataque;
        inst.ataqueAjuste = 0;
        inst.defesa = inst.base.defesa;
        inst.defesaMax = inst.base.defesa;
        inst.st = {};
    }

    // manda uma carta (e o que estava equipado nela) para o descarte do dono
    function paraDescarte(jogador, inst) {
        const equipadas = inst.equip;
        inst.equip = [];
        reiniciar(inst);
        jogador.descarte.push(inst);
        equipadas.forEach((e) => { e.equip = []; reiniciar(e); jogador.descarte.push(e); });
    }

    // ---------- localizar cartas ----------
    function localizar(estado, uid) {
        for (let dono = 0; dono < 2; dono++) {
            const j = estado.jogadores[dono];
            for (const zona of ['mao', 'campo', 'apoio', 'descarte']) {
                const inst = j[zona].find((c) => c.uid === uid);
                if (inst) return { dono, zona, inst };
            }
            for (const zona of ['campo', 'apoio']) {
                for (const portador of j[zona]) {
                    const eq = portador.equip.find((c) => c.uid === uid);
                    if (eq) return { dono, zona: 'equip', inst: eq, portador };
                }
            }
        }
        return null;
    }

    // ---------- efeitos passivos e anulações ----------
    function efeitosBrutos(inst) {
        const proprio = EFEITOS[inst.base.codigo] || {};
        const copiado = inst.st && inst.st.copia ? (EFEITOS[inst.st.copia] || {}) : {};
        return Object.assign({}, copiado, proprio);
    }

    // motivo pelo qual a habilidade da carta está anulada (ou null)
    function silenciada(estado, inst) {
        const loc = localizar(estado, inst.uid);
        if (!loc) return null;
        const oc = estado.jogadores[1 - loc.dono].campo[0];
        if (!oc) return null;
        const efo = efeitosBrutos(oc);
        if (efo.anulaUniverso && efo.anulaUniverso.some((v) => norm(v) === norm(inst.base.universo))) {
            return `${oc.base.nome} anula as habilidades de cartas do universo ${inst.base.universo}.`;
        }
        if (loc.zona === 'apoio') {
            const arma = oc.equip.find((e) => efeitosBrutos(e).silenciaAux && !silenciada(estado, e));
            if (arma) return `${arma.base.nome} transformou os auxiliares em peixes: eles não podem usar habilidades.`;
        }
        return null;
    }

    function efeitosDe(estado, inst) {
        if (estado && silenciada(estado, inst)) return {};
        return efeitosBrutos(inst);
    }

    // proteções do jogador-alvo contra cartas de certos elementos
    function protecao(estado, donoAlvo, alvo, origemBase, comHabilidade) {
        const j = estado.jogadores[donoAlvo];
        const el = norm(origemBase.elemento);
        for (const a of j.apoio) {
            const ef = efeitosDe(estado, a);
            if (ef.anulaElemento && ef.anulaElemento.some((v) => norm(v) === el)) {
                return `${a.base.nome} anula o dano e os efeitos de cartas do tipo ${origemBase.elemento}.`;
            }
        }
        if (comHabilidade && alvo) {
            for (const e of alvo.equip) {
                const ef = efeitosDe(estado, e);
                if (ef.anulaHabElemento && ef.anulaHabElemento.some((v) => norm(v) === el)) {
                    return `${e.base.nome} anula habilidades de cartas do tipo ${origemBase.elemento}.`;
                }
            }
        }
        return null;
    }

    // ---------- ataque e defesa ----------
    function ataqueTotal(atacante, alvoBase, estado) {
        const ef = efeitosDe(estado, atacante);
        const proprio = atacante.ataqueBase + atacante.ataqueAjuste;
        let d = proprio;
        let temArma = false;

        for (const e of atacante.equip) {
            const efe = efeitosDe(estado, e);
            const bonus = Number(e.base.ataque) || 0;
            if (classeDe(e) === 'arma') temArma = true;
            if (efe.bonusCondicional) {
                if (alvoBase && casa(efe.bonusCondicional, alvoBase)) d += bonus;
            } else {
                d += bonus;
            }
        }

        if (ef.dobraBaseComArma && temArma) d += proprio;

        // dino do google (auxiliar em apoio do mesmo jogador)
        if (estado) {
            const loc = localizar(estado, atacante.uid);
            if (loc && loc.zona === 'campo') {
                for (const aux of estado.jogadores[loc.dono].apoio) {
                    const efa = efeitosDe(estado, aux);
                    if (efa.dino && aux.st.dino > 0) d += efa.dino;
                }
            }
        }

        if (alvoBase && ef.maisContra && casa(ef.maisContra.quando, alvoBase)) d += ef.maisContra.bonus;
        if (alvoBase && ef.dobraContra && casa(ef.dobraContra, alvoBase)) d *= 2;
        if (atacante.st.torcida) d *= 2;
        return Math.max(0, d);
    }

    function ataqueFeitico(feitico, alvoBase) {
        const ef = efeitosBrutos(feitico);
        let d = Number(feitico.base.ataque) || 0;
        if (alvoBase && ef.dobraContra && casa(ef.dobraContra, alvoBase)) d *= 2;
        return d;
    }

    // o alvo pode ser ferido por essa carta (ataque ou feitiço)?
    function ferivel(estado, donoAlvo, alvo, origemBase) {
        const ef = efeitosDe(estado, alvo);
        if (ef.imuneA && casa(ef.imuneA, origemBase)) {
            return { ok: false, motivo: `${alvo.base.nome} não sofre dano de cartas da classe ${origemBase.classe}.` };
        }
        if (ef.soFeridoPorElemento && !ef.soFeridoPorElemento.some((v) => norm(v) === norm(origemBase.elemento))) {
            return { ok: false, motivo: `${alvo.base.nome} só pode ser ferido por cartas do tipo ${ef.soFeridoPorElemento.join(', ')}.` };
        }
        const prot = protecao(estado, donoAlvo, alvo, origemBase, false);
        if (prot) return { ok: false, motivo: prot };
        return { ok: true };
    }

    function verificarFim(estado) {
        if (estado.vencedor !== null) return;
        const perdeu = estado.jogadores.map((j) => j.derrotados >= REGRAS.campeoesParaVencer);
        if (perdeu[0] && perdeu[1]) estado.vencedor = -1;
        else if (perdeu[0]) estado.vencedor = 1;
        else if (perdeu[1]) estado.vencedor = 0;
        if (estado.vencedor !== null) {
            log(estado, estado.vencedor === -1
                ? 'A partida terminou empatada.'
                : `${estado.jogadores[estado.vencedor].nome} venceu: derrotou ${REGRAS.campeoesParaVencer} campeões do adversário!`);
        }
    }

    // criatura sem defesa sai de batalha; campeão derrotado conta para a vitória do adversário
    function morrer(estado, dono, inst) {
        const j = estado.jogadores[dono];
        const ef = efeitosDe(estado, inst);
        const i = j.campo.indexOf(inst);
        if (i >= 0) j.campo.splice(i, 1);
        const campeao = ehCampeao(inst);
        const nome = inst.base.nome;
        paraDescarte(j, inst);
        if (campeao) {
            j.derrotados++;
            log(estado, `${nome} (${j.nome}) foi derrotado! Campeões derrotados de ${j.nome}: ${j.derrotados}/${REGRAS.campeoesParaVencer}.`);
        } else {
            log(estado, `${nome} (${j.nome}) foi derrotada.`);
        }
        if (ef.fenrir) {
            j.bonusCampeao += ef.fenrir;
            log(estado, `${nome} deixou uma herança: o próximo campeão de ${j.nome} entra com +${ef.fenrir} de defesa.`);
        }
    }

    // remove um item/arma equipado (perde o bônus de defesa que ele dava)
    function removerEquip(estado, donoIdx, portador, eq) {
        const j = estado.jogadores[donoIdx];
        portador.equip.splice(portador.equip.indexOf(eq), 1);
        const d = Number(eq.base.defesa) || 0;
        portador.defesaMax = Math.max(1, portador.defesaMax - d);
        portador.defesa = Math.min(portador.defesaMax, Math.max(1, portador.defesa - d));
        eq.equip = [];
        reiniciar(eq);
        j.descarte.push(eq);
    }

    // gatilhos que dependem de duas criaturas frente a frente (lobisomem)
    function verificarPresenca(estado) {
        for (let i = 0; i < 2; i++) {
            const c = estado.jogadores[i].campo[0];
            if (!c) continue;
            const ef = efeitosDe(estado, c);
            if (!ef.x10Se || c.st.x10) continue;
            const op = estado.jogadores[1 - i].campo[0];
            if (op && ef.x10Se.some((v) => norm(v) === norm(op.base.elemento))) {
                c.defesa *= 10;
                c.defesaMax *= 10;
                c.st.x10 = true;
                log(estado, `${c.base.nome} enfrentou ${op.base.nome} (${op.base.elemento}): sua defesa foi multiplicada por 10!`);
            }
        }
    }

    // ---------- baralho e turnos ----------
    // compra até n cartas; devolve quantas foram compradas
    function comprar(estado, indice, n) {
        const j = estado.jogadores[indice];
        let compradas = 0;
        for (let k = 0; k < n; k++) {
            if (!j.baralho.length) {
                if (!j.descarte.length) break;
                j.baralho = embaralhar(j.descarte);
                j.descarte = [];
                log(estado, `${j.nome} reembaralhou o descarte no baralho.`);
            }
            j.mao.push(j.baralho.pop());
            compradas++;
        }
        return compradas;
    }

    // efeitos de início de turno: recargas, Hércules, dano por turno e confusão
    function iniciarTurno(estado) {
        estado.acoes = REGRAS.acoesPorTurno;
        const j = atual(estado);
        log(estado, `Turno ${estado.numTurno}: vez de ${j.nome}.`);

        const todas = [...j.mao, ...j.campo, ...j.apoio];
        j.campo.forEach((c) => todas.push(...c.equip));
        todas.forEach((c) => { if (c.rec > 0) c.rec--; });

        let c = j.campo[0];
        if (c) {
            const ef = efeitosDe(estado, c);
            if (ef.dobraACada3) {
                c.st.turnos = (c.st.turnos || 0) + 1;
                if (c.st.turnos % 3 === 0) {
                    c.ataqueBase *= 2;
                    log(estado, `${c.base.nome} está há ${c.st.turnos} turnos em batalha: o ataque dobrou para ${c.ataqueBase}!`);
                }
            }

            const danos = [];
            if (estado.pandora) danos.push(['A Caixa de Pandora', 10]);
            if (c.st.veneno) danos.push(['O veneno', c.st.veneno]);
            if (c.st.queimadura) danos.push(['A queimadura', c.st.queimadura]);
            for (const [origem, valor] of danos) {
                c.defesa -= valor;
                log(estado, `${origem} causou ${valor} de dano a ${c.base.nome}.`);
                if (c.defesa <= 0) { morrer(estado, estado.turno, c); c = null; break; }
            }
        }

        if (c && c.st.confusao) {
            delete c.st.confusao;
            const d = ataqueTotal(c, c.base, estado);
            c.defesa -= d;
            log(estado, `${c.base.nome} está confusa e atacou a si mesma: ${d} de dano.`);
            if (c.defesa <= 0) morrer(estado, estado.turno, c);
        }
        verificarFim(estado);
    }

    function novoJogo(config, cartas) {
        const lista = cartas.map(normalizarCarta);
        const pool = lista.filter((c) => norm(c.classe) !== 'representante');
        const estado = {
            jogadores: [0, 1].map((i) => ({
                nome: config.nomes[i],
                rep: (config.reps && config.reps[i]) || null,
                baralho: [], mao: [], campo: [], apoio: [], descarte: [],
                derrotados: 0,
                bonusCampeao: 0
            })),
            turno: config.comeca === 0 || config.comeca === 1 ? config.comeca : Math.floor(Math.random() * 2),
            numTurno: 1,
            acoes: REGRAS.acoesPorTurno,
            vencedor: null,
            pandora: false,
            log: [],
            proxUid: 1
        };
        estado.jogadores.forEach((j, i) => {
            j.baralho = embaralhar(pool).slice(0, config.tamanhoBaralho).map((c) => nova(estado, c));
            comprar(estado, i, REGRAS.maoInicial);
        });
        log(estado, `${estado.jogadores[estado.turno].nome} começa. Cada jogador recebeu ${REGRAS.maoInicial} cartas.`);
        iniciarTurno(estado);
        return estado;
    }

    function encerrarTurno(estado) {
        const e = fim(estado); if (e) return e;
        const j = atual(estado);
        const c = j.campo[0];
        if (c) {
            delete c.st.torcida;
            if (c.st.paralisia > 0) c.st.paralisia--;
        }
        for (const aux of j.apoio.slice()) {
            const ef = efeitosBrutos(aux);
            if (ef.dino && aux.st.dino > 0) {
                aux.st.dino--;
                if (aux.st.dino === 0) {
                    j.apoio.splice(j.apoio.indexOf(aux), 1);
                    paraDescarte(j, aux);
                    log(estado, `${aux.base.nome} bateu em um cacto, foi destruído e vai para o descarte de ${j.nome}.`);
                }
            }
        }
        estado.turno = 1 - estado.turno;
        estado.numTurno++;
        iniciarTurno(estado);
        return { ok: true };
    }

    // todas as ações do turno custam 1 das 2 ações
    function semAcoes(estado) {
        return estado.acoes <= 0 ? erro('Você não tem mais ações neste turno.') : null;
    }

    // ---------- ações do turno ----------
    function comprarAcao(estado) {
        const e = fim(estado) || semAcoes(estado); if (e) return e;
        const j = atual(estado);
        if (!j.baralho.length && !j.descarte.length) return erro('Não há cartas para comprar.');
        comprar(estado, estado.turno, 1);
        estado.acoes--;
        log(estado, `${j.nome} comprou uma carta.`);
        return { ok: true };
    }

    function cartaDaMao(estado, uid) {
        const j = atual(estado);
        const i = j.mao.findIndex((c) => c.uid === uid);
        return { j, i, inst: i >= 0 ? j.mao[i] : null };
    }

    // cartas de uso único: vão da mão direto para o descarte depois de usadas
    const consumivel = (inst) => classeDe(inst) === 'feitico' || Boolean(HAB[inst.base.codigo] && HAB[inst.base.codigo].consumivel);

    function invocar(estado, uid) {
        const e = fim(estado) || semAcoes(estado); if (e) return e;
        const { j, i, inst } = cartaDaMao(estado, uid);
        if (!inst) return erro('Essa carta não está na sua mão.');
        if (!ehCriatura(inst)) return erro('Só campeões e bestas podem ser colocados em batalha.');
        if (j.campo.length >= REGRAS.maxCampo) return erro('Já há um campeão ou uma besta em batalha. Só pode haver um por vez.');

        j.mao.splice(i, 1);
        const rep = j.rep;
        if (rep && rep.universo && norm(rep.universo) === norm(inst.base.universo)) {
            inst.defesa += REGRAS.bonusRepresentante;
            inst.defesaMax += REGRAS.bonusRepresentante;
            log(estado, `${rep.nome} deu +${REGRAS.bonusRepresentante} de defesa para ${inst.base.nome}.`);
        }
        if (ehCampeao(inst) && j.bonusCampeao > 0) {
            inst.defesa += j.bonusCampeao;
            inst.defesaMax += j.bonusCampeao;
            log(estado, `${inst.base.nome} recebeu +${j.bonusCampeao} de defesa (herança de Zord Fenrir).`);
            j.bonusCampeao = 0;
        }
        j.campo.push(inst);
        estado.acoes--;
        log(estado, `${j.nome} colocou ${inst.base.nome} em batalha.`);
        verificarPresenca(estado);
        return { ok: true };
    }

    function colocarApoio(estado, uid) {
        const e = fim(estado) || semAcoes(estado); if (e) return e;
        const { j, i, inst } = cartaDaMao(estado, uid);
        if (!inst) return erro('Essa carta não está na sua mão.');
        if (classeDe(inst) !== 'auxiliar') return erro('Só auxiliares vão para a zona de apoio.');
        if (j.apoio.length >= REGRAS.maxApoio) return erro(`Só pode haver ${REGRAS.maxApoio} auxiliares na batalha.`);

        j.mao.splice(i, 1);
        j.apoio.push(inst);
        if (efeitosBrutos(inst).dino) inst.st.dino = 3;
        estado.acoes--;
        log(estado, `${j.nome} colocou ${inst.base.nome} em apoio.`);
        return { ok: true };
    }

    // equipa na criatura que está em batalha
    function equipar(estado, uid) {
        const e = fim(estado) || semAcoes(estado); if (e) return e;
        const { j, i, inst } = cartaDaMao(estado, uid);
        if (!inst) return erro('Essa carta não está na sua mão.');
        const cl = classeDe(inst);
        if (cl !== 'arma' && cl !== 'item') return erro('Só armas e itens podem ser equipados.');
        if (consumivel(inst)) return erro(`${inst.base.nome} é de uso único: use "Executar habilidade".`);
        const alvo = j.campo[0];
        if (!alvo) return erro('Você precisa de um campeão ou uma besta em batalha para equipar.');
        if (efeitosDe(estado, alvo).semEquip) return erro(`Não é possível equipar nada em ${alvo.base.nome}.`);

        const campeao = ehCampeao(alvo);
        const armas = alvo.equip.filter((x) => classeDe(x) === 'arma').length;
        const itens = alvo.equip.filter((x) => classeDe(x) === 'item').length;
        if (cl === 'arma') {
            if (!campeao) return erro('Armas não podem ser equipadas em bestas.');
            if (armas >= REGRAS.maxArmasCampeao) return erro('Cada campeão carrega uma única arma.');
        } else if (campeao) {
            if (itens >= REGRAS.maxItensCampeao) return erro('Só pode ser equipado um item por campeão.');
        } else if (itens >= REGRAS.maxItensBesta) {
            return erro(`Uma besta aceita no máximo ${REGRAS.maxItensBesta} itens.`);
        }

        j.mao.splice(i, 1);
        const defesa = Number(inst.base.defesa) || 0;
        alvo.defesa += defesa;
        alvo.defesaMax += defesa;
        alvo.equip.push(inst);
        estado.acoes--;
        log(estado, `${j.nome} equipou ${inst.base.nome} em ${alvo.base.nome}.`);
        return { ok: true };
    }

    // a criatura em batalha ataca a criatura em batalha do adversário (dano e contra-ataque)
    function contato(estado, atacante, alvo) {
        for (const eq of alvo.equip) {
            const ef = efeitosDe(estado, eq);
            if (ef.queimaContato && atacante.defesa > 0 && !atacante.st.queimadura) {
                atacante.st.queimadura = ef.queimaContato;
                log(estado, `${atacante.base.nome} se queimou ao tocar ${alvo.base.nome}: ${ef.queimaContato} de dano por turno.`);
            }
        }
    }

    function atacar(estado) {
        const e = fim(estado) || semAcoes(estado); if (e) return e;
        const j = atual(estado);
        const o = outro(estado);
        const a = j.campo[0];
        const t = o.campo[0];
        if (!a) return erro('Você não tem campeão nem besta em batalha para atacar.');
        if (!t) return erro('O adversário não tem criatura em batalha para ser atacada.');
        if (a.st.paralisia > 0) return erro(`${a.base.nome} está paralisada e não pode atacar neste turno.`);

        const f = ferivel(estado, 1 - estado.turno, t, a.base);
        if (!f.ok) return erro(f.motivo);

        const d = ataqueTotal(a, t.base, estado);
        t.defesa -= d;
        estado.acoes--;
        let texto = `${a.base.nome} atacou ${t.base.nome}: ${d} de dano.`;
        contato(estado, a, t);

        if (t.defesa <= 0) {
            log(estado, texto);
            morrer(estado, 1 - estado.turno, t);
        } else {
            const f2 = ferivel(estado, estado.turno, a, t.base);
            if (f2.ok) {
                const d2 = ataqueTotal(t, a.base, estado);
                a.defesa -= d2;
                texto += ` Contra-ataque: ${d2} de dano.`;
                contato(estado, t, a);
            }
            log(estado, texto);
            if (a.defesa <= 0) morrer(estado, estado.turno, a);
        }
        verificarFim(estado);
        return { ok: true };
    }

    // ---------- habilidades ----------
    // tipo: 'ativa' (botão "Executar habilidade", gasta 1 ação) ou 'passiva' (funciona sozinha)
    // local: onde a carta precisa estar: mao (uso único), campo, apoio ou equip (equipada)
    // texto: descrição corrigida; detalhe: como o jogo aplica o efeito
    const alvoCriatura = (c) => {
        const t = c.o.campo[0];
        return t ? { t } : { erro: 'O adversário não tem criatura em batalha.' };
    };
    const bloqueio = (c, t) => protecao(c.estado, c.idxOp, t, c.origem, true);
    const passiva = (texto, detalhe, extra) => Object.assign({ tipo: 'passiva', texto, detalhe: detalhe || '' }, extra);

    const HAB = {
        n001: {
            tipo: 'ativa', local: ['apoio'], botao: 'Comprar e filtrar',
            texto: 'Compre uma carta do baralho. Se ela for do tipo metálico, fica na sua mão; caso contrário, vai para a pilha de descarte.',
            detalhe: 'Gasta 1 ação.',
            exec(c) {
                const { j, estado } = c;
                if (!j.baralho.length && !j.descarte.length) return erro('Não há cartas para comprar.');
                comprar(estado, c.dono, 1);
                const carta = j.mao[j.mao.length - 1];
                if (norm(carta.base.elemento) === 'metalico') {
                    return { ok: true, texto: 'comprou uma carta metálica, que ficou na mão.' };
                }
                j.mao.pop();
                paraDescarte(j, carta);
                return { ok: true, texto: `comprou ${carta.base.nome}, que não é metálica e foi para o descarte.` };
            }
        },
        n002: {
            tipo: 'ativa', consumivel: true, local: ['mao'], botao: 'Lançar feitiço',
            texto: 'Todos os campeões e bestas em batalha passam a sofrer 10 de dano por turno (inclusive os do invocador).',
            detalhe: 'Vale até o fim da partida. O dano é aplicado no início do turno do dono de cada criatura.',
            exec(c) {
                if (c.estado.pandora) return erro('A Caixa de Pandora já foi aberta nesta partida.');
                c.estado.pandora = true;
                return { ok: true, texto: 'abriu a Caixa de Pandora! Toda criatura em batalha sofre 10 de dano no início do turno do seu dono.' };
            }
        },
        n003: passiva('Causa 2 de dano a mais em cartas da origem humanidade.'),
        n004: passiva('Transforma os auxiliares do adversário em peixes e os impede de usar habilidades.',
            'Funciona enquanto a lança estiver equipada na criatura em batalha.'),
        n005: {
            tipo: 'ativa', consumivel: true, local: ['mao'], botao: 'Lançar feitiço',
            texto: 'Escolha uma carta zumbi da sua pilha de descarte e coloque-a na sua mão.',
            detalhe: 'Vale qualquer carta do universo zumbi que esteja no seu descarte.',
            exec(c) {
                const lista = c.j.descarte.filter((x) => norm(x.base.universo) === 'zumbi');
                if (!lista.length) return erro('Você não tem cartas do universo zumbi no seu descarte.');
                const alvo = lista.length === 1 ? lista[0] : lista.find((x) => x.uid === c.escolha);
                if (!alvo) return pedir('Qual carta zumbi volta para a sua mão?', lista.map((x) => ({ valor: x.uid, rotulo: `${x.base.nome} (${x.base.classe})` })));
                c.j.descarte.splice(c.j.descarte.indexOf(alvo), 1);
                c.j.mao.push(alvo);
                return { ok: true, texto: `trouxe ${alvo.base.nome} do descarte para a mão.` };
            }
        },
        n006: {
            tipo: 'ativa', local: ['equip'], botao: 'Arremessar equipamento',
            texto: 'Joga para longe um item ou uma arma do oponente.',
            detalhe: 'O equipamento escolhido vai para o descarte do adversário e a criatura dele perde o bônus de defesa que ele dava.',
            exec(c) {
                const r = alvoCriatura(c); if (r.erro) return r;
                const t = r.t;
                if (!t.equip.length) return erro(`${t.base.nome} não tem itens nem armas equipados.`);
                const alvo = t.equip.length === 1 ? t.equip[0] : t.equip.find((x) => x.uid === c.escolha);
                if (!alvo) return pedir('Qual equipamento será arremessado?', t.equip.map((x) => ({ valor: x.uid, rotulo: `${x.base.nome} (${x.base.classe})` })));
                const b = bloqueio(c, t); if (b) return erro(b);
                removerEquip(c.estado, c.idxOp, t, alvo);
                return { ok: true, texto: `arremessou ${alvo.base.nome} para longe: o equipamento foi para o descarte do adversário.` };
            }
        },
        n007: passiva('Causa dano apenas em cartas dos tipos fantasma e sombrio.',
            'O ataque desta arma só é somado quando o alvo é fantasma ou sombrio.'),
        n008: {
            tipo: 'ativa', local: ['apoio'], botao: 'Chamar auxiliares de volta',
            texto: 'Manda para a sua mão os auxiliares do universo normal que estão em apoio.',
            detalhe: 'Os auxiliares voltam para a mão e podem ser jogados de novo. O próprio Heimdall fica em apoio.',
            exec(c) {
                const lista = c.j.apoio.filter((x) => x !== c.inst && norm(x.base.universo) === 'normal');
                if (!lista.length) return erro('Não há outros auxiliares do universo normal em apoio.');
                lista.forEach((x) => {
                    c.j.apoio.splice(c.j.apoio.indexOf(x), 1);
                    reiniciar(x);
                    c.j.mao.push(x);
                });
                return { ok: true, texto: `devolveu à mão: ${lista.map((x) => x.base.nome).join(', ')}.` };
            }
        },
        n009: {
            tipo: 'ativa', local: ['apoio'], botao: 'Levantar a torcida',
            texto: 'Ao levantar a torcida, o Fuleco faz os efeitos do seu time dobrarem.',
            detalhe: 'O ataque do seu campeão ou da sua besta em batalha fica dobrado até o fim deste turno.',
            exec(c) {
                const a = c.j.campo[0];
                if (!a) return erro('Você precisa de um campeão ou de uma besta em batalha.');
                if (a.st.torcida) return erro('A torcida já está em festa neste turno.');
                a.st.torcida = true;
                return { ok: true, texto: `levantou a torcida: o ataque de ${a.base.nome} dobra até o fim do turno.` };
            }
        },
        n010: passiva('Não sofre dano direto de campeões.'),
        n011: passiva('Causa o dobro de dano em cartas do tipo metálico.'),
        n012: passiva('Com o seu canto, bloqueia e anula as habilidades das cartas do universo game do adversário.',
            'Funciona enquanto Iara estiver em batalha.'),
        n013: passiva('O ataque dobra a cada três turnos.',
            'Conta os seus turnos com Hércules em batalha: no 3º, 6º, 9º... o ataque base dobra.'),
        n014: passiva('Causa o dobro de dano em cartas dos tipos sombrio, fantasma e divino.'),
        n015: passiva('Não sofre dano de cartas da classe besta.'),
        n016: {
            tipo: 'ativa', local: ['campo'], botao: 'Envenenar',
            texto: 'Envenena o oponente: ele recebe 2 de dano por turno.',
            detalhe: 'A criatura do adversário sofre 2 de dano no início de cada turno dele, até sair de batalha.',
            exec(c) {
                const r = alvoCriatura(c); if (r.erro) return r;
                const b = bloqueio(c, r.t); if (b) return erro(b);
                if (r.t.st.veneno) return erro(`${r.t.base.nome} já está envenenada.`);
                r.t.st.veneno = 2;
                return { ok: true, texto: `envenenou ${r.t.base.nome}: 2 de dano por turno.` };
            }
        },
        n017: {
            tipo: 'ativa', consumivel: true, local: ['mao'], botao: 'Lançar feitiço',
            texto: 'Causa 3 de dano e paralisa por 1 turno os seres do universo game.',
            detalhe: 'Uma criatura paralisada não ataca nem usa habilidades no próximo turno do dono dela.',
            exec(c) {
                const t = c.o.campo[0];
                if (t && norm(t.base.universo) === 'game') {
                    t.st.paralisia = 1;
                    return { ok: true, texto: `${t.base.nome} foi paralisada por 1 turno.` };
                }
                return { ok: true, texto: '' };
            }
        },
        n018: passiva('Causa o dobro de dano em criaturas do tipo metálico.'),
        n019: {
            tipo: 'ativa', local: ['campo'], botao: 'Voltar para a mão',
            texto: 'Consegue voltar para a sua mão uma única vez, para recuperar seus atributos.',
            detalhe: 'Kitsune volta com defesa e ataque originais. Itens e armas equipados também voltam para a mão. Só pode ser usada uma vez.',
            exec(c) {
                if (c.inst.usos[c.chave]) return erro('Essa habilidade só pode ser usada uma vez e já foi usada.');
                const eq = c.inst.equip;
                c.inst.equip = [];
                c.j.campo.splice(c.j.campo.indexOf(c.inst), 1);
                reiniciar(c.inst);
                c.inst.usos[c.chave] = true;
                c.j.mao.push(c.inst);
                eq.forEach((x) => { reiniciar(x); c.j.mao.push(x); });
                return { ok: true, texto: `voltou para a mão e recuperou seus atributos${eq.length ? ' (o equipamento também voltou)' : ''}.` };
            }
        },
        n020: {
            tipo: 'ativa', local: ['campo'], botao: 'Confundir o oponente',
            texto: 'Deixa o oponente confuso e faz com que ele ataque a si mesmo por 1 turno. Recarga de 3 turnos para usar de novo.',
            detalhe: 'No início do próximo turno do adversário, a criatura dele se ataca e sofre o próprio dano.',
            exec(c) {
                if (c.inst.rec > 0) return erro(`A habilidade está recarregando: faltam ${c.inst.rec} turno(s) seus.`);
                const r = alvoCriatura(c); if (r.erro) return r;
                const b = bloqueio(c, r.t); if (b) return erro(b);
                if (r.t.st.confusao) return erro(`${r.t.base.nome} já está confusa.`);
                r.t.st.confusao = true;
                c.inst.rec = 3;
                return { ok: true, texto: `confundiu ${r.t.base.nome}: ela vai atacar a si mesma no início do próximo turno do adversário.` };
            }
        },
        n021: passiva('Sopra bolhas no oponente, distraindo os auxiliares dele e impedindo que usem habilidades.',
            'Funciona enquanto a arma estiver equipada na criatura em batalha.'),
        n022: passiva('Pula sobre os inimigos durante três turnos, causando 4 de dano a mais. Depois, bate em um cacto, morre e a carta vai para a pilha de descarte.',
            'Começa a contar quando é colocado em apoio (esse turno conta). Soma +4 ao ataque da sua criatura e some no fim do 3º turno.'),
        n023: passiva('Ao ser derrotada, a próxima carta de campeão que você colocar em batalha recebe +100 de defesa.'),
        n024: {
            tipo: 'ativa', consumivel: true, local: ['mao'], botao: 'Lançar feitiço',
            texto: 'Joga todas as cartas da pilha de descarte de volta ao baralho e embaralha as cartas.',
            detalhe: 'Vale para o seu descarte e o seu baralho.',
            exec(c) {
                if (!c.j.descarte.length) return erro('Seu descarte está vazio.');
                const n = c.j.descarte.length;
                c.j.baralho = embaralhar(c.j.baralho.concat(c.j.descarte.map((x) => { reiniciar(x); return x; })));
                c.j.descarte = [];
                return { ok: true, texto: `devolveu ${n} carta(s) do descarte ao baralho e embaralhou.` };
            }
        },
        n025: passiva('Anula o dano e o efeito de cartas do tipo divino contra você.',
            'Funciona enquanto estiver em apoio.'),
        n026: passiva('Defesa +11. Anula habilidades de cartas do tipo fantasma.',
            'O bônus de defesa vale ao equipar. As habilidades fantasma do adversário não afetam a criatura equipada.'),
        n027: passiva('Aplica efeito de fogo em qualquer um que tocar a criatura: o oponente recebe 7 de dano por turno.',
            'Quem atacar (ou contra-atacar) a criatura equipada pega fogo e sofre 7 de dano no início de cada turno seu.'),
        n028: {
            tipo: 'ativa', local: ['equip'], botao: 'Zumbificar',
            texto: 'Zumbifica a carta do oponente, fazendo a defesa dela ser reduzida pela metade.',
            detalhe: 'Uma criatura só pode ser zumbificada uma vez.',
            exec(c) {
                const r = alvoCriatura(c); if (r.erro) return r;
                const t = r.t;
                const b = bloqueio(c, t); if (b) return erro(b);
                if (t.st.zumbi) return erro(`${t.base.nome} já está zumbificada.`);
                const antes = t.defesa;
                t.defesaMax = Math.max(1, Math.floor(t.defesaMax / 2));
                t.defesa = Math.min(t.defesaMax, Math.max(1, Math.floor(t.defesa / 2)));
                t.st.zumbi = true;
                return { ok: true, texto: `zumbificou ${t.base.nome}: a defesa caiu de ${antes} para ${t.defesa}.` };
            }
        },
        n029: passiva('Se o oponente for do tipo sombrio, a defesa desta carta é multiplicada por 10.',
            'Acontece uma vez, quando as duas criaturas ficam frente a frente.'),
        n030: {
            tipo: 'ativa', consumivel: true, local: ['mao'], botao: 'Lançar feitiço',
            texto: 'Causa 5 de dano. Criaturas do universo normal sofrem o dobro de dano.',
            detalhe: 'Atinge a criatura em batalha do adversário.',
            exec() { return { ok: true, texto: '' }; }
        },
        n031: {
            tipo: 'ativa', consumivel: true, local: ['mao'], botao: 'Usar pergaminho',
            texto: 'Compre três cartas do baralho e coloque esta carta na pilha de descarte.',
            detalhe: 'É de uso único e não pode ser equipada.',
            exec(c) {
                if (!c.j.baralho.length && !c.j.descarte.length) return erro('Não há cartas para comprar.');
                const n = comprar(c.estado, c.dono, 3);
                return { ok: true, texto: `comprou ${n} carta(s).` };
            }
        },
        n032: passiva('Como foi a primeira infectada, tem muito mais defesa que o normal.',
            'Já está refletido na defesa da carta.', { semEfeito: true }),
        n033: passiva('Dobra o ataque base se estiver com uma arma.'),
        n034: {
            tipo: 'ativa', local: ['campo'], botao: 'Copiar habilidade',
            texto: 'Consegue copiar a habilidade do campeão ou da besta do oponente.',
            detalhe: 'Executa na hora a habilidade ativa do adversário, ou passa a ter a habilidade passiva dele enquanto estiver em batalha.',
            exec(c) {
                const r = alvoCriatura(c); if (r.erro) return r;
                const t = r.t;
                const src = t.base.codigo === 'n034' ? t.st.copia : t.base.codigo;
                const h = src && HAB[src];
                if (!h || h.semEfeito) return erro(`${t.base.nome} não tem habilidade que possa ser copiada.`);
                if (h.tipo === 'passiva') {
                    c.inst.st.copia = src;
                    return { ok: true, texto: `copiou a habilidade passiva de ${t.base.nome}: "${h.texto}"` };
                }
                if (!h.local.includes('campo')) return erro(`A habilidade de ${t.base.nome} não pode ser copiada.`);
                const copia = Object.assign({}, c, { chave: src, origem: t.base });
                const res = h.exec(copia);
                if (res.ok) res.texto = `copiou a habilidade de ${t.base.nome} e ${res.texto}`;
                return res;
            }
        },
        n035: {
            tipo: 'ativa', local: ['campo'], botao: 'Buscar um campeão',
            texto: 'Procure uma carta de campeão no baralho e coloque-a na sua mão.',
            detalhe: 'Depois da busca, o baralho é embaralhado.',
            exec(c) {
                const lista = c.j.baralho.filter((x) => ehCampeao(x));
                if (!lista.length) return erro('Não há campeões no seu baralho.');
                const alvo = lista.length === 1 ? lista[0] : lista.find((x) => x.uid === c.escolha);
                if (!alvo) return pedir('Qual campeão do baralho vai para a sua mão?', lista.map((x) => ({ valor: x.uid, rotulo: `${x.base.nome} (ATQ ${x.base.ataque} · DEF ${x.base.defesa})` })));
                c.j.baralho.splice(c.j.baralho.indexOf(alvo), 1);
                c.j.baralho = embaralhar(c.j.baralho);
                c.j.mao.push(alvo);
                return { ok: true, texto: 'procurou um campeão no baralho e o colocou na mão.' };
            }
        },
        n036: {
            tipo: 'ativa', local: ['campo'], botao: 'Afogar o adversário',
            texto: 'Auxiliares, itens e armas do tipo água do adversário são mandados para a pilha de descarte.',
            detalhe: 'Afeta só as cartas do adversário.',
            exec(c) {
                const o = c.o;
                const nomes = [];
                for (const a of o.apoio.slice()) {
                    if (norm(a.base.elemento) === 'agua') {
                        o.apoio.splice(o.apoio.indexOf(a), 1);
                        paraDescarte(o, a);
                        nomes.push(a.base.nome);
                    }
                }
                const t = o.campo[0];
                if (t) {
                    for (const e of t.equip.slice()) {
                        if (norm(e.base.elemento) === 'agua') { removerEquip(c.estado, c.idxOp, t, e); nomes.push(e.base.nome); }
                    }
                }
                if (!nomes.length) return erro('O adversário não tem auxiliares, itens nem armas do tipo água.');
                return { ok: true, texto: `mandou para o descarte: ${nomes.join(', ')}.` };
            }
        },
        n037: passiva('Só pode ser ferido por cartas do tipo fantasma.'),
        n038: passiva('Não é possível equipar auxiliares, itens nem armas nesta carta.'),
        n039: {
            tipo: 'ativa', local: ['campo'], botao: 'Igualar a defesa',
            texto: 'Faz o oponente ter a mesma defesa que você.',
            detalhe: 'A defesa atual da criatura do adversário passa a ser igual à de Gaiamon.',
            exec(c) {
                const r = alvoCriatura(c); if (r.erro) return r;
                const t = r.t;
                const b = bloqueio(c, t); if (b) return erro(b);
                t.defesa = c.inst.defesa;
                if (t.defesa > t.defesaMax) t.defesaMax = t.defesa;
                return { ok: true, texto: `igualou a defesa de ${t.base.nome} à sua: ${t.defesa}.` };
            }
        },
        n040: {
            tipo: 'ativa', local: ['campo'], botao: 'Destruir o oponente',
            texto: 'Destrói a carta do oponente. Essa habilidade só pode ser usada uma vez.',
            detalhe: 'A criatura em batalha do adversário vai para o descarte. Se for um campeão, conta como derrotado.',
            exec(c) {
                if (c.inst.usos[c.chave]) return erro('Essa habilidade só pode ser usada uma vez e já foi usada.');
                const r = alvoCriatura(c); if (r.erro) return r;
                const b = bloqueio(c, r.t); if (b) return erro(b);
                c.inst.usos[c.chave] = true;
                const nome = r.t.base.nome;
                morrer(c.estado, c.idxOp, r.t);
                return { ok: true, texto: `destruiu ${nome}!` };
            }
        }
    };

    ['D001', 'D002', 'D003', 'D004', 'D005', 'D006'].forEach((cod) => {
        HAB[cod] = passiva('Dá mais 10 de defesa para os seres do seu universo.',
            'As criaturas do universo do representante entram em batalha com +10 de defesa.');
    });
    HAB.D007 = passiva('Tem mais defesa que os outros representantes.', 'Não altera as criaturas em batalha.', { semEfeito: true });

    // textos corrigidos por código (usados também pelo seed.js e pelo catálogo)
    const TEXTOS = {};
    Object.keys(HAB).forEach((cod) => { TEXTOS[cod] = HAB[cod].texto; });

    function descricao(base) {
        const h = base && HAB[base.codigo];
        if (!h) return { tipo: base && base.habilidade ? 'passiva' : 'nenhuma', texto: (base && base.habilidade) || '', detalhe: '', botao: '' };
        return { tipo: h.tipo, texto: h.texto, detalhe: h.detalhe || '', botao: h.botao || 'Executar habilidade', local: h.local || [], semEfeito: Boolean(h.semEfeito) };
    }

    // situação do botão "Executar habilidade" para a carta selecionada
    function estadoHabilidade(estado, uid) {
        const loc = localizar(estado, uid);
        if (!loc) return { tipo: 'nenhuma' };
        const { inst, zona, dono } = loc;
        const h = HAB[inst.base.codigo];
        if (!h) return { tipo: 'nenhuma' };
        if (h.tipo === 'passiva') {
            const motivo = silenciada(estado, inst);
            return { tipo: 'passiva', anulada: Boolean(motivo), motivo: motivo || '' };
        }
        const r = { tipo: 'ativa', rotulo: h.botao, disponivel: true, motivo: '' };
        const nao = (m) => { r.disponivel = false; r.motivo = m; return r; };
        if (estado.vencedor !== null) return nao('A partida terminou.');
        if (dono !== estado.turno) return nao('Só na vez do dono da carta.');
        if (!h.local.includes(zona)) {
            const onde = { mao: 'na sua mão', campo: 'em batalha', apoio: 'em apoio', equip: 'equipada em uma criatura' };
            return nao(`Esta habilidade só pode ser usada com a carta ${onde[h.local[0]]}.`);
        }
        if (estado.acoes <= 0) return nao('Você não tem mais ações neste turno.');
        const portador = zona === 'campo' ? inst : (zona === 'equip' ? loc.portador : null);
        if (portador && portador.st.paralisia > 0) return nao(`${portador.base.nome} está paralisada.`);
        const sil = zona !== 'mao' ? silenciada(estado, inst) : null;
        if (sil) return nao(sil);
        if (inst.rec > 0) return nao(`Recarregando: faltam ${inst.rec} turno(s) seus.`);
        if ((inst.base.codigo === 'n019' || inst.base.codigo === 'n040') && inst.usos[inst.base.codigo]) return nao('Já usada (uso único).');
        return r;
    }

    // executa a habilidade ativa de uma carta sua (na mão, se for de uso único, em batalha, em apoio ou equipada)
    function executarHabilidade(estado, uid, escolha) {
        const e = fim(estado) || semAcoes(estado); if (e) return e;
        const loc = localizar(estado, uid);
        if (!loc || loc.dono !== estado.turno) return erro('Escolha uma carta sua.');
        const { inst, zona } = loc;
        const h = HAB[inst.base.codigo];
        if (!h) return erro(`${inst.base.nome} não tem habilidade para executar.`);
        if (h.tipo === 'passiva') return erro(`${inst.base.nome} tem habilidade passiva: ela funciona sozinha, sem gastar ação.`);
        if (!h.local.includes(zona)) {
            const st = estadoHabilidade(estado, uid);
            return erro(st.motivo || 'A carta não está no lugar certo para usar a habilidade.');
        }
        if (inst.rec > 0) return erro(`A habilidade está recarregando: faltam ${inst.rec} turno(s) seus.`);

        const portador = zona === 'campo' ? inst : (zona === 'equip' ? loc.portador : null);
        if (portador && portador.st.paralisia > 0) return erro(`${portador.base.nome} está paralisada e não pode usar habilidades neste turno.`);
        const sil = zona !== 'mao' ? silenciada(estado, inst) : null;
        if (sil) return erro(sil);

        const j = atual(estado);
        const o = outro(estado);
        const c = {
            estado, dono: estado.turno, idxOp: 1 - estado.turno, j, o,
            inst, escolha, chave: inst.base.codigo, origem: inst.base
        };

        // feitiços com ataque machucam a criatura em batalha do adversário
        const ehFeitico = classeDe(inst) === 'feitico';
        const danoBase = ehFeitico ? (Number(inst.base.ataque) || 0) : 0;
        let alvoDano = null;
        if (danoBase > 0) {
            alvoDano = o.campo[0];
            if (!alvoDano) return erro('O adversário não tem criatura em batalha para receber o feitiço.');
            const f = ferivel(estado, 1 - estado.turno, alvoDano, inst.base);
            if (!f.ok) return erro(f.motivo);
        }

        const res = h.exec(c);
        if (res.erro || res.pergunta) return res;

        estado.acoes--;
        let texto = `${j.nome} usou ${inst.base.nome}${res.texto ? `: ${res.texto}` : '.'}`;

        if (zona === 'mao' && h.consumivel) {
            const i = j.mao.findIndex((x) => x.uid === uid);
            if (i >= 0) j.mao.splice(i, 1);
            if (alvoDano) {
                const d = ataqueFeitico(inst, alvoDano.base);
                alvoDano.defesa -= d;
                texto += ` ${alvoDano.base.nome} perdeu ${d} de defesa.`;
            }
            log(estado, texto);
            paraDescarte(j, inst);
            if (alvoDano && alvoDano.defesa <= 0 && o.campo.includes(alvoDano)) morrer(estado, 1 - estado.turno, alvoDano);
        } else {
            log(estado, texto);
        }
        verificarPresenca(estado);
        verificarFim(estado);
        return { ok: true };
    }

    function lancarFeitico(estado, uid, escolha) {
        const loc = localizar(estado, uid);
        if (!loc || loc.zona !== 'mao' || !consumivel(loc.inst)) return erro('Essa carta não é um feitiço.');
        return executarHabilidade(estado, uid, escolha);
    }

    // ---------- correções manuais (não gastam ações; só para consertar um engano) ----------
    function descartarDaMao(estado, uid) {
        const e = fim(estado); if (e) return e;
        const { j, i, inst } = cartaDaMao(estado, uid);
        if (!inst) return erro('Essa carta não está na sua mão.');
        j.mao.splice(i, 1);
        paraDescarte(j, inst);
        log(estado, `${j.nome} descartou ${inst.base.nome}.`);
        return { ok: true };
    }

    function ajustarCarta(estado, uid, campo, delta) {
        const e = fim(estado); if (e) return e;
        const loc = localizar(estado, uid);
        if (!loc || !['campo', 'apoio'].includes(loc.zona)) return erro('Carta não encontrada em batalha.');
        const c = loc.inst;
        const sinal = delta > 0 ? '+' : '';
        if (campo === 'defesa') {
            c.defesa += delta;
            if (c.defesa > c.defesaMax) c.defesaMax = c.defesa;
            log(estado, `Correção manual: ${c.base.nome} ${sinal}${delta} de defesa.`);
            if (c.defesa <= 0 && loc.zona === 'campo') { morrer(estado, loc.dono, c); verificarFim(estado); }
        } else if (campo === 'ataque') {
            c.ataqueAjuste += delta;
            log(estado, `Correção manual: ${c.base.nome} ${sinal}${delta} de ataque.`);
        }
        return { ok: true };
    }

    // envia ao descarte sem contar como campeão derrotado (use "ajustar derrotados" se contar)
    function descartarCampo(estado, uid) {
        const e = fim(estado); if (e) return e;
        const loc = localizar(estado, uid);
        if (!loc || !['campo', 'apoio'].includes(loc.zona)) return erro('Carta não encontrada em batalha.');
        const j = estado.jogadores[loc.dono];
        j[loc.zona].splice(j[loc.zona].indexOf(loc.inst), 1);
        paraDescarte(j, loc.inst);
        log(estado, `${loc.inst.base.nome} (${j.nome}) foi para o descarte.`);
        return { ok: true };
    }

    function ajustarDerrotados(estado, indice, delta) {
        const e = fim(estado); if (e) return e;
        const j = estado.jogadores[indice];
        j.derrotados = Math.max(0, j.derrotados + delta);
        log(estado, `Correção manual: campeões derrotados de ${j.nome}: ${j.derrotados}/${REGRAS.campeoesParaVencer}.`);
        verificarFim(estado);
        return { ok: true };
    }

    function comprarManual(estado, indice) {
        const e = fim(estado); if (e) return e;
        if (!comprar(estado, indice, 1)) return erro('Não há cartas para comprar.');
        log(estado, `${estado.jogadores[indice].nome} comprou uma carta (correção manual).`);
        return { ok: true };
    }

    const Motor = {
        REGRAS, EFEITOS, HAB, TEXTOS, norm, classeDe, ehCampeao, ehCriatura, temEfeito, consumivel,
        normalizarCarta, tituloNome, descricao, estadoHabilidade, silenciada,
        novoJogo, encerrarTurno, localizar, ataqueTotal, ataqueFeitico, ferivel,
        comprarAcao, invocar, colocarApoio, equipar, lancarFeitico, atacar,
        executarHabilidade, usarHabilidade: executarHabilidade,
        descartarDaMao, ajustarCarta, descartarCampo, ajustarDerrotados, comprarManual
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = Motor;
    else raiz.Motor = Motor;
})(typeof window !== 'undefined' ? window : globalThis);