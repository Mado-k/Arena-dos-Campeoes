// Motor de regras do modo offline (sem nada de tela: só lógica).
// Funciona no navegador (window.Motor) e no Node (para testes).
(function (raiz) {
    'use strict';

    // ---------- Regras: ajuste os números aqui ----------
    const REGRAS = {
        maxCampo: 4,        // criaturas em campo por jogador
        maxApoio: 3,        // auxiliares em campo por jogador
        maxMao: 7,          // cartas na mão
        maxEquip: 3,        // armas/itens por criatura
        jogadasPorTurno: 2, // cartas jogadas por turno
        maoInicial: 5,
        bonusRepresentante: 10 // vida extra para criaturas do universo do representante
    };

    // Efeitos que o motor aplica sozinho (chave = código da carta).
    // O resto das habilidades continua manual, pelos ajustes da tela.
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
    const ehCriatura = (inst) => ['campeao', 'besta'].includes(classeDe(inst));
    const temEfeito = (codigo) => Boolean(codigo && EFEITOS[codigo]);

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
            danoBase: Number(base.dano) || 0,
            danoAjuste: 0,
            vida: Number(base.vida) || 0,
            vidaMax: Number(base.vida) || 0,
            equip: [],
            atacou: false,
            invocadoEm: 0
        };
    }

    function reiniciar(inst) {
        inst.danoAjuste = 0;
        inst.vida = Number(inst.base.vida) || 0;
        inst.vidaMax = inst.vida;
        inst.atacou = false;
        inst.invocadoEm = 0;
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

    // ---------- dano ----------
    function danoTotal(atacante, alvoBase) {
        const ef = EFEITOS[atacante.base.codigo] || {};
        const proprio = atacante.danoBase + atacante.danoAjuste;
        let d = proprio;
        let temArma = false;

        for (const e of atacante.equip) {
            const efe = EFEITOS[e.base.codigo];
            const bonus = Number(e.base.dano) || 0;
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

    function danoFeitico(feitico, alvoBase) {
        const ef = EFEITOS[feitico.base.codigo] || {};
        let d = Number(feitico.base.dano) || 0;
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

    function morrer(estado, dono, inst) {
        const j = estado.jogadores[dono];
        const i = j.campo.indexOf(inst);
        if (i >= 0) j.campo.splice(i, 1);
        paraDescarte(j, inst);
        log(estado, `${inst.base.nome} (${j.nome}) foi derrotada.`);
    }

    function verificarFim(estado) {
        const [a, b] = estado.jogadores;
        if (a.vida <= 0 && b.vida <= 0) estado.vencedor = -1;
        else if (a.vida <= 0) estado.vencedor = 1;
        else if (b.vida <= 0) estado.vencedor = 0;
        if (estado.vencedor !== null) {
            log(estado, estado.vencedor === -1 ? 'A partida terminou empatada.' : `${estado.jogadores[estado.vencedor].nome} venceu a partida!`);
        }
    }

    // ---------- baralho e turnos ----------
    function comprar(estado, indice, n) {
        const j = estado.jogadores[indice];
        for (let k = 0; k < n; k++) {
            if (!j.baralho.length) {
                if (!j.descarte.length) break;
                j.baralho = embaralhar(j.descarte);
                j.descarte = [];
                log(estado, `${j.nome} reembaralhou o descarte no baralho.`);
            }
            const c = j.baralho.pop();
            if (j.mao.length >= REGRAS.maxMao) {
                paraDescarte(j, c);
                log(estado, `Mão cheia: ${j.nome} descartou ${c.base.nome}.`);
            } else {
                j.mao.push(c);
            }
        }
    }

    function iniciarTurno(estado) {
        const j = atual(estado);
        j.campo.forEach((c) => { c.atacou = false; });
        estado.jogadas = REGRAS.jogadasPorTurno;
        if (estado.numTurno > 1) comprar(estado, estado.turno, 1);
        log(estado, `Turno ${estado.numTurno}: vez de ${j.nome}.`);
    }

    function novoJogo(config, cartas) {
        const pool = cartas.filter((c) => norm(c.classe) !== 'representante');
        const estado = {
            jogadores: [0, 1].map((i) => {
                const rep = config.reps[i];
                const vidaMax = Math.max(1, Math.round((Number(rep.vida) || 100) * config.fatorVida));
                return { nome: config.nomes[i], rep, vida: vidaMax, vidaMax, baralho: [], mao: [], campo: [], apoio: [], descarte: [] };
            }),
            turno: config.comeca === 0 || config.comeca === 1 ? config.comeca : Math.floor(Math.random() * 2),
            numTurno: 1,
            jogadas: REGRAS.jogadasPorTurno,
            vencedor: null,
            log: [],
            proxUid: 1
        };
        estado.jogadores.forEach((j, i) => {
            j.baralho = embaralhar(pool).slice(0, config.tamanhoBaralho).map((c) => nova(estado, c));
            comprar(estado, i, REGRAS.maoInicial);
        });
        log(estado, `${estado.jogadores[estado.turno].nome} começa a partida.`);
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

    // ---------- jogar cartas ----------
    function cartaDaMao(estado, uid) {
        const j = atual(estado);
        const i = j.mao.findIndex((c) => c.uid === uid);
        return { j, i, inst: i >= 0 ? j.mao[i] : null };
    }

    function gastarJogada(estado) {
        if (estado.jogadas <= 0) return { erro: `Você já jogou ${REGRAS.jogadasPorTurno} cartas neste turno.` };
        return null;
    }

    function invocar(estado, uid) {
        const e = fim(estado); if (e) return e;
        const { j, i, inst } = cartaDaMao(estado, uid);
        if (!inst) return { erro: 'Essa carta não está na sua mão.' };
        if (!ehCriatura(inst)) return { erro: 'Só campeões e bestas podem ser invocados.' };
        const g = gastarJogada(estado); if (g) return g;
        if (j.campo.length >= REGRAS.maxCampo) return { erro: `Seu campo está cheio (máx. ${REGRAS.maxCampo} criaturas).` };

        j.mao.splice(i, 1);
        inst.invocadoEm = estado.numTurno;
        const rep = j.rep;
        if (rep.universo && norm(rep.universo) === norm(inst.base.universo)) {
            inst.vida += REGRAS.bonusRepresentante;
            inst.vidaMax += REGRAS.bonusRepresentante;
            log(estado, `${rep.nome} deu +${REGRAS.bonusRepresentante} de vida para ${inst.base.nome}.`);
        }
        j.campo.push(inst);
        estado.jogadas--;
        log(estado, `${j.nome} invocou ${inst.base.nome}.`);
        return { ok: true };
    }

    function colocarApoio(estado, uid) {
        const e = fim(estado); if (e) return e;
        const { j, i, inst } = cartaDaMao(estado, uid);
        if (!inst) return { erro: 'Essa carta não está na sua mão.' };
        if (classeDe(inst) !== 'auxiliar') return { erro: 'Só auxiliares vão para a zona de apoio.' };
        const g = gastarJogada(estado); if (g) return g;
        if (j.apoio.length >= REGRAS.maxApoio) return { erro: `A zona de apoio está cheia (máx. ${REGRAS.maxApoio}).` };

        j.mao.splice(i, 1);
        j.apoio.push(inst);
        estado.jogadas--;
        log(estado, `${j.nome} colocou ${inst.base.nome} em apoio. Aplique a habilidade manualmente se necessário.`);
        return { ok: true };
    }

    function equipar(estado, uid, alvoUid) {
        const e = fim(estado); if (e) return e;
        const { j, i, inst } = cartaDaMao(estado, uid);
        if (!inst) return { erro: 'Essa carta não está na sua mão.' };
        if (!['arma', 'item'].includes(classeDe(inst))) return { erro: 'Só armas e itens podem ser equipados.' };
        const alvo = j.campo.find((c) => c.uid === alvoUid);
        if (!alvo) return { erro: 'Escolha uma criatura do seu campo.' };
        const g = gastarJogada(estado); if (g) return g;
        if (alvo.equip.length >= REGRAS.maxEquip) return { erro: `${alvo.base.nome} já tem ${REGRAS.maxEquip} equipamentos.` };

        j.mao.splice(i, 1);
        const vida = Number(inst.base.vida) || 0;
        if (vida) { alvo.vida += vida; alvo.vidaMax += vida; }
        alvo.equip.push(inst);
        estado.jogadas--;
        log(estado, `${j.nome} equipou ${inst.base.nome} em ${alvo.base.nome}.`);
        return { ok: true };
    }

    // alvo: { tipo: 'criatura', uid } | { tipo: 'jogador' } | null (feitiço sem dano)
    function lancarFeitico(estado, uid, alvo) {
        const e = fim(estado); if (e) return e;
        const { j, i, inst } = cartaDaMao(estado, uid);
        if (!inst) return { erro: 'Essa carta não está na sua mão.' };
        if (classeDe(inst) !== 'feitico') return { erro: 'Essa carta não é um feitiço.' };
        const g = gastarJogada(estado); if (g) return g;

        const o = outro(estado);
        const temDano = (Number(inst.base.dano) || 0) > 0;
        let texto = `${j.nome} lançou ${inst.base.nome}.`;

        if (temDano) {
            if (!alvo) return { erro: 'Escolha um alvo para o feitiço.' };
            if (alvo.tipo === 'jogador') {
                const d = danoFeitico(inst, null);
                o.vida -= d;
                texto += ` ${o.nome} perdeu ${d} de vida.`;
            } else {
                const t = o.campo.find((c) => c.uid === alvo.uid);
                if (!t) return { erro: 'Escolha uma criatura do oponente.' };
                const f = ferivel(t, inst.base);
                if (!f.ok) return { erro: f.motivo };
                const d = danoFeitico(inst, t.base);
                t.vida -= d;
                texto += ` ${t.base.nome} sofreu ${d} de dano.`;
                j.mao.splice(i, 1);
                estado.jogadas--;
                paraDescarte(j, inst);
                log(estado, texto);
                if (t.vida <= 0) morrer(estado, 1 - estado.turno, t);
                verificarFim(estado);
                return { ok: true };
            }
        } else {
            texto += ' Aplique o efeito manualmente.';
        }

        j.mao.splice(i, 1);
        estado.jogadas--;
        paraDescarte(j, inst);
        log(estado, texto);
        verificarFim(estado);
        return { ok: true };
    }

    function descartarDaMao(estado, uid) {
        const e = fim(estado); if (e) return e;
        const { j, i, inst } = cartaDaMao(estado, uid);
        if (!inst) return { erro: 'Essa carta não está na sua mão.' };
        j.mao.splice(i, 1);
        paraDescarte(j, inst);
        log(estado, `${j.nome} descartou ${inst.base.nome}.`);
        return { ok: true };
    }

    // ---------- combate ----------
    // alvo: { tipo: 'criatura', uid } | { tipo: 'jogador' }
    function atacar(estado, atacanteUid, alvo) {
        const e = fim(estado); if (e) return e;
        const j = atual(estado);
        const o = outro(estado);
        const a = j.campo.find((c) => c.uid === atacanteUid);
        if (!a) return { erro: 'Essa criatura não está no seu campo.' };
        if (a.atacou) return { erro: `${a.base.nome} já atacou neste turno.` };
        if (a.invocadoEm >= estado.numTurno) return { erro: `${a.base.nome} acabou de ser invocada e só ataca no próximo turno.` };

        if (alvo.tipo === 'jogador') {
            if (o.campo.length) return { erro: 'Derrote as criaturas do oponente antes de atacar o jogador.' };
            const d = danoTotal(a, null);
            o.vida -= d;
            a.atacou = true;
            log(estado, `${a.base.nome} atacou ${o.nome} diretamente: ${d} de dano.`);
            verificarFim(estado);
            return { ok: true };
        }

        const t = o.campo.find((c) => c.uid === alvo.uid);
        if (!t) return { erro: 'Escolha uma criatura do oponente.' };
        const f = ferivel(t, a.base);
        if (!f.ok) return { erro: f.motivo };

        const d = danoTotal(a, t.base);
        t.vida -= d;
        a.atacou = true;
        let texto = `${a.base.nome} atacou ${t.base.nome}: ${d} de dano.`;

        if (t.vida <= 0) {
            log(estado, texto);
            morrer(estado, 1 - estado.turno, t);
        } else {
            const f2 = ferivel(a, t.base);
            if (f2.ok) {
                const d2 = danoTotal(t, a.base);
                a.vida -= d2;
                texto += ` Contra-ataque: ${d2} de dano.`;
            }
            log(estado, texto);
            if (a.vida <= 0) morrer(estado, estado.turno, a);
        }
        verificarFim(estado);
        return { ok: true };
    }

    // ---------- ajustes manuais (habilidades que o motor não automatiza) ----------
    function ajustarCarta(estado, uid, campo, delta) {
        const e = fim(estado); if (e) return e;
        const loc = localizar(estado, uid);
        if (!loc || !['campo', 'apoio'].includes(loc.zona)) return { erro: 'Carta não encontrada em campo.' };
        const c = loc.inst;
        if (campo === 'vida') {
            c.vida += delta;
            if (c.vida > c.vidaMax) c.vidaMax = c.vida;
            log(estado, `Ajuste manual: ${c.base.nome} ${delta > 0 ? '+' : ''}${delta} de vida.`);
            if (c.vida <= 0 && loc.zona === 'campo') morrer(estado, loc.dono, c);
        } else if (campo === 'dano') {
            c.danoAjuste += delta;
            log(estado, `Ajuste manual: ${c.base.nome} ${delta > 0 ? '+' : ''}${delta} de dano.`);
        }
        return { ok: true };
    }

    function descartarCampo(estado, uid) {
        const e = fim(estado); if (e) return e;
        const loc = localizar(estado, uid);
        if (!loc || !['campo', 'apoio'].includes(loc.zona)) return { erro: 'Carta não encontrada em campo.' };
        const j = estado.jogadores[loc.dono];
        j[loc.zona].splice(j[loc.zona].indexOf(loc.inst), 1);
        paraDescarte(j, loc.inst);
        log(estado, `${loc.inst.base.nome} (${j.nome}) foi para o descarte.`);
        return { ok: true };
    }

    function devolverMao(estado, uid) {
        const e = fim(estado); if (e) return e;
        const loc = localizar(estado, uid);
        if (!loc || !['campo', 'apoio'].includes(loc.zona)) return { erro: 'Carta não encontrada em campo.' };
        const j = estado.jogadores[loc.dono];
        if (j.mao.length >= REGRAS.maxMao) return { erro: `A mão de ${j.nome} está cheia.` };
        j[loc.zona].splice(j[loc.zona].indexOf(loc.inst), 1);
        const equipadas = loc.inst.equip;
        loc.inst.equip = [];
        reiniciar(loc.inst);
        j.mao.push(loc.inst);
        equipadas.forEach((q) => { q.equip = []; reiniciar(q); j.descarte.push(q); });
        log(estado, `${loc.inst.base.nome} voltou para a mão de ${j.nome}.`);
        return { ok: true };
    }

    function ajustarJogador(estado, indice, delta) {
        const e = fim(estado); if (e) return e;
        const j = estado.jogadores[indice];
        j.vida += delta;
        if (j.vida > j.vidaMax) j.vidaMax = j.vida;
        log(estado, `Ajuste manual: ${j.nome} ${delta > 0 ? '+' : ''}${delta} de vida.`);
        verificarFim(estado);
        return { ok: true };
    }

    function comprarManual(estado, indice) {
        const e = fim(estado); if (e) return e;
        comprar(estado, indice, 1);
        log(estado, `${estado.jogadores[indice].nome} comprou uma carta.`);
        return { ok: true };
    }

    const Motor = {
        REGRAS, EFEITOS, norm, classeDe, ehCriatura, temEfeito,
        novoJogo, encerrarTurno, localizar, danoTotal, danoFeitico, ferivel,
        invocar, colocarApoio, equipar, lancarFeitico, descartarDaMao, atacar,
        ajustarCarta, descartarCampo, devolverMao, ajustarJogador, comprarManual
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = Motor;
    else raiz.Motor = Motor;
})(typeof window !== 'undefined' ? window : globalThis);
