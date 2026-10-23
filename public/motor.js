// Motor de regras do modo offline (sem nada de tela: só lógica).
// Funciona no navegador (window.Motor) e no Node (para testes).
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

    // Efeitos que o motor aplica sozinho (chave = código da carta).
    // O resto das habilidades é aplicado pelos jogadores, com "Usar habilidade" e os ajustes.
    const EFEITOS = {
        n003: { maisContra: { quando: { origem: ['humanidade'] }, bonus: 2 } },
        n011: { dobraContra: { elemento: ['metálico'] } },
        n014: { dobraContra: { elemento: ['sombrio', 'fantasma', 'divino'] } },
        n018: { dobraContra: { elemento: ['metálico'] } },
        n030: { dobraContra: { universo: ['normal'] } },
        n033: { dobraBaseComArma: true },
        n007: { bonusCondicional: { elemento: ['fantasma', 'sombrio'] } },
        n010: { imuneA: { classe: ['campeão'] } },
        n015: { imuneA: { classe: ['besta'] } },
        n037: { soFeridoPorElemento: ['fantasma'] }
    };

    // ---------- utilidades ----------
    const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const classeDe = (inst) => norm(inst.base.classe);
    const ehCampeao = (inst) => classeDe(inst) === 'campeao';
    const ehCriatura = (inst) => ['campeao', 'besta'].includes(classeDe(inst));
    const temEfeito = (codigo) => Boolean(codigo && EFEITOS[codigo]);

    // toda carta tem ataque e defesa (aceita também o formato antigo dano/vida)
    function normalizarCarta(c) {
        const ataque = c.ataque != null ? c.ataque : c.dano;
        const defesa = c.defesa != null ? c.defesa : c.vida;
        return Object.assign({}, c, { ataque: Number(ataque) || 0, defesa: Number(defesa) || 0 });
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

    function nova(estado, base) {
        return {
            uid: estado.proxUid++,
            base,
            ataqueBase: base.ataque,
            ataqueAjuste: 0,
            defesa: base.defesa,
            defesaMax: base.defesa,
            equip: []
        };
    }

    function reiniciar(inst) {
        inst.ataqueAjuste = 0;
        inst.defesa = inst.base.defesa;
        inst.defesaMax = inst.base.defesa;
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
        }
        return null;
    }

    // ---------- ataque e defesa ----------
    function ataqueTotal(atacante, alvoBase) {
        const ef = EFEITOS[atacante.base.codigo] || {};
        const proprio = atacante.ataqueBase + atacante.ataqueAjuste;
        let d = proprio;
        let temArma = false;

        for (const e of atacante.equip) {
            const efe = EFEITOS[e.base.codigo];
            const bonus = Number(e.base.ataque) || 0;
            if (classeDe(e) === 'arma') temArma = true;
            if (efe && efe.bonusCondicional) {
                if (alvoBase && casa(efe.bonusCondicional, alvoBase)) d += bonus;
            } else {
                d += bonus;
            }
        }

        if (ef.dobraBaseComArma && temArma) d += proprio;
        if (alvoBase && ef.maisContra && casa(ef.maisContra.quando, alvoBase)) d += ef.maisContra.bonus;
        if (alvoBase && ef.dobraContra && casa(ef.dobraContra, alvoBase)) d *= 2;
        return Math.max(0, d);
    }

    function ataqueFeitico(feitico, alvoBase) {
        const ef = EFEITOS[feitico.base.codigo] || {};
        let d = Number(feitico.base.ataque) || 0;
        if (alvoBase && ef.dobraContra && casa(ef.dobraContra, alvoBase)) d *= 2;
        return d;
    }

    // o alvo pode ser ferido por essa origem (carta atacante ou feitiço)?
    function ferivel(alvo, origemBase) {
        const ef = EFEITOS[alvo.base.codigo];
        if (!ef) return { ok: true };
        if (ef.imuneA && casa(ef.imuneA, origemBase)) {
            return { ok: false, motivo: `${alvo.base.nome} é imune a cartas da classe ${origemBase.classe}.` };
        }
        if (ef.soFeridoPorElemento && !ef.soFeridoPorElemento.some((v) => norm(v) === norm(origemBase.elemento))) {
            return { ok: false, motivo: `${alvo.base.nome} só pode ser ferido por cartas do elemento ${ef.soFeridoPorElemento.join(', ')}.` };
        }
        return { ok: true };
    }

    function verificarFim(estado) {
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

    function iniciarTurno(estado) {
        estado.acoes = REGRAS.acoesPorTurno;
        log(estado, `Turno ${estado.numTurno}: vez de ${atual(estado).nome}.`);
    }

    function novoJogo(config, cartas) {
        const lista = cartas.map(normalizarCarta);
        const pool = lista.filter((c) => norm(c.classe) !== 'representante');
        const estado = {
            jogadores: [0, 1].map((i) => ({
                nome: config.nomes[i],
                rep: (config.reps && config.reps[i]) || null,
                baralho: [], mao: [], campo: [], apoio: [], descarte: [],
                derrotados: 0
            })),
            turno: config.comeca === 0 || config.comeca === 1 ? config.comeca : Math.floor(Math.random() * 2),
            numTurno: 1,
            acoes: REGRAS.acoesPorTurno,
            vencedor: null,
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
        estado.turno = 1 - estado.turno;
        estado.numTurno++;
        iniciarTurno(estado);
        return { ok: true };
    }

    // todas as ações do turno custam 1 das 2 ações
    function semAcoes(estado) {
        return estado.acoes <= 0 ? { erro: 'Você não tem mais ações neste turno.' } : null;
    }

    // ---------- ações do turno ----------
    function comprarAcao(estado) {
        const e = fim(estado) || semAcoes(estado); if (e) return e;
        const j = atual(estado);
        if (!j.baralho.length && !j.descarte.length) return { erro: 'Não há cartas para comprar.' };
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

    function invocar(estado, uid) {
        const e = fim(estado) || semAcoes(estado); if (e) return e;
        const { j, i, inst } = cartaDaMao(estado, uid);
        if (!inst) return { erro: 'Essa carta não está na sua mão.' };
        if (!ehCriatura(inst)) return { erro: 'Só campeões e bestas podem ser colocados em batalha.' };
        if (j.campo.length >= REGRAS.maxCampo) return { erro: 'Já há um campeão ou uma besta em batalha. Só pode haver um por vez.' };

        j.mao.splice(i, 1);
        const rep = j.rep;
        if (rep && rep.universo && norm(rep.universo) === norm(inst.base.universo)) {
            inst.defesa += REGRAS.bonusRepresentante;
            inst.defesaMax += REGRAS.bonusRepresentante;
            log(estado, `${rep.nome} deu +${REGRAS.bonusRepresentante} de defesa para ${inst.base.nome}.`);
        }
        j.campo.push(inst);
        estado.acoes--;
        log(estado, `${j.nome} colocou ${inst.base.nome} em batalha.`);
        return { ok: true };
    }

    function colocarApoio(estado, uid) {
        const e = fim(estado) || semAcoes(estado); if (e) return e;
        const { j, i, inst } = cartaDaMao(estado, uid);
        if (!inst) return { erro: 'Essa carta não está na sua mão.' };
        if (classeDe(inst) !== 'auxiliar') return { erro: 'Só auxiliares vão para a zona de apoio.' };
        if (j.apoio.length >= REGRAS.maxApoio) return { erro: `Só pode haver ${REGRAS.maxApoio} auxiliares na batalha.` };

        j.mao.splice(i, 1);
        j.apoio.push(inst);
        estado.acoes--;
        log(estado, `${j.nome} colocou ${inst.base.nome} em apoio.`);
        return { ok: true };
    }

    // equipa na criatura que está em batalha
    function equipar(estado, uid) {
        const e = fim(estado) || semAcoes(estado); if (e) return e;
        const { j, i, inst } = cartaDaMao(estado, uid);
        if (!inst) return { erro: 'Essa carta não está na sua mão.' };
        const cl = classeDe(inst);
        if (cl !== 'arma' && cl !== 'item') return { erro: 'Só armas e itens podem ser equipados.' };
        const alvo = j.campo[0];
        if (!alvo) return { erro: 'Você precisa de um campeão ou uma besta em batalha para equipar.' };

        const campeao = ehCampeao(alvo);
        const armas = alvo.equip.filter((x) => classeDe(x) === 'arma').length;
        const itens = alvo.equip.filter((x) => classeDe(x) === 'item').length;
        if (cl === 'arma') {
            if (!campeao) return { erro: 'Armas não podem ser equipadas em bestas.' };
            if (armas >= REGRAS.maxArmasCampeao) return { erro: 'Cada campeão carrega uma única arma.' };
        } else if (campeao) {
            if (itens >= REGRAS.maxItensCampeao) return { erro: 'Só pode ser equipado um item por campeão.' };
        } else if (itens >= REGRAS.maxItensBesta) {
            return { erro: `Uma besta aceita no máximo ${REGRAS.maxItensBesta} itens.` };
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

    // feitiço com ataque atinge a criatura em batalha do adversário
    function lancarFeitico(estado, uid) {
        const e = fim(estado) || semAcoes(estado); if (e) return e;
        const { j, i, inst } = cartaDaMao(estado, uid);
        if (!inst) return { erro: 'Essa carta não está na sua mão.' };
        if (classeDe(inst) !== 'feitico') return { erro: 'Essa carta não é um feitiço.' };

        const o = outro(estado);
        const temAtaque = (Number(inst.base.ataque) || 0) > 0;
        let texto = `${j.nome} lançou ${inst.base.nome}.`;
        let atingida = null;

        if (temAtaque) {
            const t = o.campo[0];
            if (!t) return { erro: 'O adversário não tem criatura em batalha para receber o feitiço.' };
            const f = ferivel(t, inst.base);
            if (!f.ok) return { erro: f.motivo };
            const d = ataqueFeitico(inst, t.base);
            t.defesa -= d;
            texto += ` ${t.base.nome} perdeu ${d} de defesa.`;
            atingida = t;
        } else {
            texto += ' Aplique o efeito manualmente.';
        }

        j.mao.splice(i, 1);
        estado.acoes--;
        paraDescarte(j, inst);
        log(estado, texto);
        if (atingida && atingida.defesa <= 0) morrer(estado, 1 - estado.turno, atingida);
        verificarFim(estado);
        return { ok: true };
    }

    // a criatura em batalha ataca a criatura em batalha do adversário (dano e contra-ataque)
    function atacar(estado) {
        const e = fim(estado) || semAcoes(estado); if (e) return e;
        const j = atual(estado);
        const o = outro(estado);
        const a = j.campo[0];
        const t = o.campo[0];
        if (!a) return { erro: 'Você não tem campeão nem besta em batalha para atacar.' };
        if (!t) return { erro: 'O adversário não tem criatura em batalha para ser atacada.' };

        const f = ferivel(t, a.base);
        if (!f.ok) return { erro: f.motivo };

        const d = ataqueTotal(a, t.base);
        t.defesa -= d;
        estado.acoes--;
        let texto = `${a.base.nome} atacou ${t.base.nome}: ${d} de dano.`;

        if (t.defesa <= 0) {
            log(estado, texto);
            morrer(estado, 1 - estado.turno, t);
        } else {
            const f2 = ferivel(a, t.base);
            if (f2.ok) {
                const d2 = ataqueTotal(t, a.base);
                a.defesa -= d2;
                texto += ` Contra-ataque: ${d2} de dano.`;
            }
            log(estado, texto);
            if (a.defesa <= 0) morrer(estado, estado.turno, a);
        }
        verificarFim(estado);
        return { ok: true };
    }

    // "usar habilidade" gasta a ação; o efeito é aplicado pelos jogadores (ajustes manuais)
    function usarHabilidade(estado, uid) {
        const e = fim(estado) || semAcoes(estado); if (e) return e;
        const j = atual(estado);
        const inst = [...j.campo, ...j.apoio].find((c) => c.uid === uid);
        if (!inst) return { erro: 'Escolha uma carta sua que esteja em batalha ou em apoio.' };
        if (!inst.base.habilidade) return { erro: `${inst.base.nome} não tem habilidade.` };
        estado.acoes--;
        log(estado, `${j.nome} usou a habilidade de ${inst.base.nome}: ${inst.base.habilidade}`);
        return { ok: true };
    }

    // ---------- ajustes manuais (não gastam ações) ----------
    function descartarDaMao(estado, uid) {
        const e = fim(estado); if (e) return e;
        const { j, i, inst } = cartaDaMao(estado, uid);
        if (!inst) return { erro: 'Essa carta não está na sua mão.' };
        j.mao.splice(i, 1);
        paraDescarte(j, inst);
        log(estado, `${j.nome} descartou ${inst.base.nome}.`);
        return { ok: true };
    }

    function ajustarCarta(estado, uid, campo, delta) {
        const e = fim(estado); if (e) return e;
        const loc = localizar(estado, uid);
        if (!loc || !['campo', 'apoio'].includes(loc.zona)) return { erro: 'Carta não encontrada em batalha.' };
        const c = loc.inst;
        const sinal = delta > 0 ? '+' : '';
        if (campo === 'defesa') {
            c.defesa += delta;
            if (c.defesa > c.defesaMax) c.defesaMax = c.defesa;
            log(estado, `Ajuste manual: ${c.base.nome} ${sinal}${delta} de defesa.`);
            if (c.defesa <= 0 && loc.zona === 'campo') { morrer(estado, loc.dono, c); verificarFim(estado); }
        } else if (campo === 'ataque') {
            c.ataqueAjuste += delta;
            log(estado, `Ajuste manual: ${c.base.nome} ${sinal}${delta} de ataque.`);
        }
        return { ok: true };
    }

    // envia ao descarte sem contar como campeão derrotado (use "ajustar derrotados" se contar)
    function descartarCampo(estado, uid) {
        const e = fim(estado); if (e) return e;
        const loc = localizar(estado, uid);
        if (!loc || !['campo', 'apoio'].includes(loc.zona)) return { erro: 'Carta não encontrada em batalha.' };
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
        log(estado, `Ajuste manual: campeões derrotados de ${j.nome}: ${j.derrotados}/${REGRAS.campeoesParaVencer}.`);
        verificarFim(estado);
        return { ok: true };
    }

    function comprarManual(estado, indice) {
        const e = fim(estado); if (e) return e;
        if (!comprar(estado, indice, 1)) return { erro: 'Não há cartas para comprar.' };
        log(estado, `${estado.jogadores[indice].nome} comprou uma carta (ajuste manual).`);
        return { ok: true };
    }

    const Motor = {
        REGRAS, EFEITOS, norm, classeDe, ehCampeao, ehCriatura, temEfeito, normalizarCarta,
        novoJogo, encerrarTurno, localizar, ataqueTotal, ataqueFeitico, ferivel,
        comprarAcao, invocar, colocarApoio, equipar, lancarFeitico, atacar, usarHabilidade,
        descartarDaMao, ajustarCarta, descartarCampo, ajustarDerrotados, comprarManual
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = Motor;
    else raiz.Motor = Motor;
})(typeof window !== 'undefined' ? window : globalThis);