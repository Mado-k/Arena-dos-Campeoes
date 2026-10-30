// Motor de regras do Arena dos Campeões (sem nada de tela: só lógica).
// Funciona no navegador (window.Motor) e no Node (testes e seed.js).
(function (raiz) {
    'use strict';

    // ---------- Regras (documento de regras do Arena dos Campeões) ----------
    const REGRAS = {
        acoesPorTurno: 2,        // atacar, comprar, usar habilidade ou jogar uma carta
        maoInicial: 3,           // cartas na mão no início do jogo
        minimoCartasPorJogador: 5, // inclui a mão inicial
        maxCampo: 1,             // só 1 campeão ou besta em batalha por jogador
        maxApoio: 2,             // auxiliares na batalha
        maxArmasCampeao: 1,      // cada campeão carrega uma única arma (bestas não carregam armas)
        maxItensCampeao: 1,      // um item por campeão
        maxItensBesta: 3,        // até três itens por besta
        campeoesParaVencer: 3,   // vença três campeões do adversário
        redistribuicoesParaEmpate: 4, // após esse total, todas as cartas descartadas encerram o duelo
        bonusRepresentante: 10   // defesa extra para criaturas do universo do representante (opcional)
    };

    // ---------- Efeitos passivos (aplicados sozinhos, chave = código da carta) ----------
    const EFEITOS = {
        n003: { maisContra: { quando: { origem: ['humanidade'] }, bonus: 2 } },
        n004: { silenciaAux: true },
        n007: { bonusCondicional: { elemento: ['fantasma', 'sombrio'] } },
        n008: { capturaNormal: true },
        n009: { amplifica: true },
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
        n033: { dobraBaseComItem: true },
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

    function logAutomatico(estado,texto) {
        log(estado,texto);
        estado.serieEvento=(estado.serieEvento||0)+1;
        estado.eventosPublicos=[...(estado.eventosPublicos||[]),{seq:estado.serieEvento,texto}].slice(-100);
    }

    // Somente dados públicos e escalares: nunca incluir cartas de mãos ou baralhos.
    function efeitoVisual(estado, dados) {
        const evento = { seq: (estado.serieVisual || 0) + 1 };
        for (const chave of ['tipo','codigo','elemento','origem','dono','alvo','alvoDono','dano','defesa','valor','ultimo','zonaOrigem','zonaAlvo','copiada','atributo','rotulo']) {
            if (typeof dados[chave] === 'string' || Number.isFinite(dados[chave])) evento[chave] = dados[chave];
        }
        estado.serieVisual = evento.seq;
        estado.efeitosVisuais = [...(estado.efeitosVisuais || []), evento].slice(-64);
    }

    const atual = (estado) => estado.jogadores[estado.turno];
    function adversarios(estado, dono = estado.turno) {
        if (estado.torneio) {
            const duelo = estado.torneio.duelos.find(d => d.includes(dono));
            return duelo ? duelo.filter(i => i !== dono && !estado.jogadores[i].eliminado) : [];
        }
        const equipe = estado.equipes ? estado.equipes[dono] : dono;
        return estado.jogadores.map((j, i) => i).filter(i =>
            (estado.equipes ? estado.equipes[i] : i) !== equipe && !estado.jogadores[i].eliminado);
    }
    function indiceOponente(estado, dono = estado.turno) {
        const opcoes = adversarios(estado, dono);
        if (dono === estado.turno && opcoes.includes(estado.alvo)) return estado.alvo;
        const espelhado=estado.arenas2v2?.find(a=>a.includes(dono))?.find(i=>i!==dono);
        if(opcoes.includes(espelhado))return espelhado;
        return opcoes.find(i => estado.jogadores[i].campo.length) ?? opcoes[0] ?? -1;
    }
    const outro = (estado) => estado.jogadores[indiceOponente(estado)];
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
        delete inst.vinculo;
        delete inst.bonusDefesa;
    }

    const descartePermanente = inst => inst.base.codigo === 'n002' && (inst.usos.n002 || 0) >= 3;
    const reciclaveis = j => j.descarte.filter(c => !descartePermanente(c));

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
        for (let dono = 0; dono < estado.jogadores.length; dono++) {
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
        for (const indice of adversarios(estado, loc.dono)) {
            const oc = estado.jogadores[indice].campo[0];
            if (!oc) continue;
            const efo = efeitosBrutos(oc);
            if (efo.anulaUniverso && efo.anulaUniverso.some(v => norm(v) === norm(inst.base.universo))) {
                return `${oc.base.nome} anula as habilidades de cartas do universo ${inst.base.universo}.`;
            }
            if (loc.zona === 'apoio') {
                const arma = oc.equip.find(e => efeitosBrutos(e).silenciaAux && !silenciada(estado, e));
                if (arma) return arma.base.codigo==='n021'?`${arma.base.nome} distraiu os auxiliares com bolhas: eles não podem usar habilidades.`:`${arma.base.nome} transformou os auxiliares em peixes: eles não podem usar habilidades.`;
            }
        }
        return null;
    }

    function fatorHabilidade(estado, fonte) {
        if (!estado) return 1;
        const dono = typeof fonte === 'number' ? fonte : localizar(estado, fonte.uid)?.dono;
        if (dono == null) return 1;
        return estado.jogadores[dono].apoio.some(a => a !== fonte && efeitosBrutos(a).amplifica && !silenciada(estado, a)) ? 2 : 1;
    }

    function efeitosDe(estado, inst) {
        if (estado && silenciada(estado, inst)) return {};
        const ef = { ...efeitosBrutos(inst) }, fator = fatorHabilidade(estado, inst);
        if (ef.maisContra) ef.maisContra = { ...ef.maisContra, bonus: ef.maisContra.bonus * fator };
        for (const chave of ['dino', 'fenrir', 'queimaContato']) if (ef[chave]) ef[chave] *= fator;
        ef.fator = fator;
        return ef;
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
        let temItem = false;

        for (const e of atacante.equip) {
            const efe = efeitosDe(estado, e);
            const bonus = Number(e.base.ataque) || 0;
            if (classeDe(e) === 'item') temItem = true;
            if (efe.bonusCondicional) {
                if (alvoBase && casa(efe.bonusCondicional, alvoBase)) d += bonus * efe.fator;
            } else {
                d += bonus;
            }
        }

        if (ef.dobraBaseComItem && temItem) d += proprio * (2 * ef.fator - 1);

        if (alvoBase && ef.maisContra && casa(ef.maisContra.quando, alvoBase)) d += ef.maisContra.bonus;
        if (alvoBase && ef.dobraContra && casa(ef.dobraContra, alvoBase)) d *= 2 * ef.fator;
        return Math.max(0, d);
    }

    function ataqueFeitico(feitico, alvoBase, estado) {
        const ef = efeitosBrutos(feitico);
        const fator = fatorHabilidade(estado, feitico);
        let d = (Number(feitico.base.ataque) || 0) * fator;
        if (alvoBase && ef.dobraContra && casa(ef.dobraContra, alvoBase)) d *= 2 * fator;
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

    function impassePorDescarte(estado) {
        if (estado.cooperativo || (estado.redistribuicoes || 0) < REGRAS.redistribuicoesParaEmpate) return false;
        if (estado.jogadores.some(j => j.mao.length || j.baralho.length || j.campo.length || j.apoio.length)) return false;
        const descartadas = estado.jogadores.reduce((n,j) => n + j.descarte.length, (estado.reservaCentral || []).length);
        return descartadas === estado.tamanhoBaralho;
    }

    function montarRodada(indices) {
        const corte = Math.ceil(indices.length / 2), duelos = [];
        for (let i=0;i<Math.floor(indices.length/2);i++) duelos.push([indices[i],indices[i+corte]]);
        return {duelos, aguardando:indices.length%2 ? [indices[corte-1]] : []};
    }
    function atualizarTorneio(estado) {
        const t=estado.torneio;
        const vivos=estado.jogadores.map((_,i)=>i).filter(i=>!estado.jogadores[i].eliminado);
        t.aguardando=[...new Set([...t.aguardando,...t.duelos.filter(d=>d.filter(i=>!estado.jogadores[i].eliminado).length<2).flat().filter(i=>!estado.jogadores[i].eliminado)])];
        if(vivos.length<=1){estado.vencedor=vivos[0]??-1;return;}
        if(t.duelos.some(d=>d.every(i=>!estado.jogadores[i].eliminado)))return;
        const recolhidas=embaralhar(estado.jogadores.filter(j=>j.eliminado).flatMap(reciclaveis));
        estado.jogadores.filter(j=>j.eliminado).forEach(j=>{j.descarte=j.descarte.filter(descartePermanente);});
        const porPessoa=Math.floor(recolhidas.length/vivos.length);
        vivos.forEach((i,k)=>{
            const j=estado.jogadores[i];j.derrotados=0;
            j.baralho=embaralhar([...j.baralho,...recolhidas.slice(k*porPessoa,(k+1)*porPessoa)]);
        });
        estado.reservaCentral.push(...recolhidas.slice(porPessoa*vivos.length));
        t.rodada++;Object.assign(t,montarRodada(vivos));
        estado.alvo=undefined;estado.acoes=0;
        logAutomatico(estado,`${vivos.length===2?'A final começou':'Nova rodada do mata-mata'}! Contadores de derrotas zerados; mãos e campos mantidos. ${recolhidas.length} carta(s) dos eliminados recolhida(s), ${porPessoa} para o baralho de cada classificado${recolhidas.length%vivos.length?'; sobra na reserva central':''}.`);
    }

    function verificarFim(estado) {
        if (estado.vencedor !== null) return;
        if (estado.todosContraTodos) {
            for (const j of estado.jogadores) if (!j.eliminado && j.derrotados >= REGRAS.campeoesParaVencer) {
                j.eliminado = true;
                for (const zona of ['mao','baralho','campo','apoio']) {
                    for (const c of j[zona].splice(0)) paraDescarte(j,c);
                }
                logAutomatico(estado, `${j.nome} foi eliminado; suas cartas restantes foram para o descarte.`);
            }
            const vivos = estado.jogadores.map((_,i)=>i).filter(i=>!estado.jogadores[i].eliminado);
            if (estado.torneio) atualizarTorneio(estado);
            else if (vivos.length <= 1) estado.vencedor = vivos[0] ?? -1;
            if (estado.vencedor === null && impassePorDescarte(estado)) {
                estado.vencedor = -1;
                estado.motivoEmpate = `Empate por impasse: todas as cartas foram descartadas após ${estado.redistribuicoes} redistribuições.`;
            }
            if (estado.vencedor !== null) log(estado, estado.vencedor === -1 ? estado.motivoEmpate || 'A partida terminou empatada.' : `${estado.jogadores[estado.vencedor].nome} venceu: é o último jogador na arena!`);
            return;
        }
        if (estado.cooperativo) {
            estado.jogadores.forEach(j => { j.eliminado = j.derrotados >= REGRAS.campeoesParaVencer; });
            const perdeuEquipe = [0, 1].map(time => estado.jogadores.filter((j, i) => estado.equipes[i] === time).every(j => j.eliminado));
            if (perdeuEquipe[0] && perdeuEquipe[1]) estado.vencedor = -1;
            else if (perdeuEquipe[0]) estado.vencedor = 1;
            else if (perdeuEquipe[1]) estado.vencedor = 0;
            if (estado.vencedor !== null) log(estado, estado.vencedor === -1 ? 'A partida terminou empatada.' : estado.equipes2v2 ? `A equipe ${estado.vencedor+1} venceu!` : estado.vencedor === 0 ? 'A equipe venceu: todas as máquinas foram derrotadas!' : 'As máquinas venceram: todos os jogadores foram eliminados.');
            return;
        }
        const perdeu = estado.jogadores.map(j => j.derrotados >= REGRAS.campeoesParaVencer);
        if (perdeu[0] && perdeu[1]) estado.vencedor = -1;
        else if (perdeu[0]) estado.vencedor = 1;
        else if (perdeu[1]) estado.vencedor = 0;
        else if (impassePorDescarte(estado)) {
            estado.vencedor = -1;
            estado.motivoEmpate = `Empate por impasse: todas as cartas foram descartadas após ${estado.redistribuicoes} redistribuições. Não haverá novo embaralhamento.`;
        }
        if (estado.vencedor !== null) {
            log(estado, estado.vencedor === -1 ? estado.motivoEmpate || 'A partida terminou empatada.' : `${estado.jogadores[estado.vencedor].nome} venceu: derrotou ${REGRAS.campeoesParaVencer} campeões do adversário!`);
        }
    }

    // criatura sem defesa sai de batalha; campeão derrotado conta para a vitória do adversário
    function morrer(estado, dono, inst) {
        const j = estado.jogadores[dono];
        const ef = efeitosDe(estado, inst);
        if (estado.pandora) {
            estado.pandora = false;
            logAutomatico(estado, 'O efeito de Pandora terminou com a derrota de ' + inst.base.nome + '.');
        }
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
        const auxiliares = j.apoio.filter(a => a.vinculo == null || a.vinculo === inst.uid);
        j.apoio = j.apoio.filter(a => !auxiliares.includes(a));
        for (const auxiliar of auxiliares) paraDescarte(j, auxiliar);
        if (auxiliares.length) log(estado, `Os auxiliares de ${j.nome} também foram derrotados com ${nome}: ${auxiliares.map(c => c.base.nome).join(', ')}. Todos foram para o descarte.`);
        if (ef.fenrir) {
            j.bonusCampeao = (Number(j.bonusCampeao) || 0) + ef.fenrir;
            efeitoVisual(estado,{tipo:'heranca',codigo:'n023',origem:inst.uid,dono,alvo:inst.uid,alvoDono:dono,valor:ef.fenrir});
            logAutomatico(estado, `${nome} deixou uma herança: o próximo campeão de ${j.nome} entra com +${ef.fenrir} de defesa.`);
        }
    }

    // remove um item/arma equipado (perde o bônus de defesa que ele dava)
    function removerEquip(estado, donoIdx, portador, eq) {
        const j = estado.jogadores[donoIdx];
        portador.equip.splice(portador.equip.indexOf(eq), 1);
        const d = eq.bonusDefesa ?? (Number(eq.base.defesa) || 0);
        portador.defesaMax = Math.max(1, portador.defesaMax - d);
        portador.defesa = Math.min(portador.defesaMax, Math.max(1, portador.defesa - d));
        eq.equip = [];
        reiniciar(eq);
        j.descarte.push(eq);
    }

    // gatilhos que dependem de duas criaturas frente a frente (lobisomem)
    function verificarPresenca(estado) {
        capturarNormais(estado);
        const anuladas={};
        estado.jogadores.forEach((j,dono)=>{
            const cartas=[...j.campo,...j.apoio,...j.campo.flatMap(c=>c.equip)];
            for(const c of cartas){
                if(!silenciada(estado,c))continue;
                for(const rival of adversarios(estado,dono)){
                    const oc=estado.jogadores[rival].campo[0];if(!oc)continue;
                    const ef=efeitosBrutos(oc);
                    const fonte=ef.anulaUniverso?.some(u=>norm(u)===norm(c.base.universo))?oc:j.apoio.includes(c)?oc.equip.find(eq=>efeitosBrutos(eq).silenciaAux&&!silenciada(estado,eq)):null;
                    if(!fonte)continue;
                    anuladas[c.uid]=fonte.uid;
                    if(estado.anulacoesVisuais?.[c.uid]!==fonte.uid)efeitoVisual(estado,{tipo:'anulacao',codigo:fonte.base.codigo,copiada:fonte.st.copia,origem:fonte.uid,dono:rival,alvo:c.uid,alvoDono:dono});
                    break;
                }
            }
        });
        estado.anulacoesVisuais=anuladas;
        for (let i = 0; i < estado.jogadores.length; i++) {
            const c = estado.jogadores[i].campo[0];
            if (!c) continue;
            const ef = efeitosDe(estado, c);
            if (!ef.x10Se || c.st.x10) continue;
            const op = adversarios(estado, i).map(k => estado.jogadores[k].campo[0]).find(op => op && ef.x10Se.some(v => norm(v) === norm(op.base.elemento)));
            if (op && ef.x10Se.some((v) => norm(v) === norm(op.base.elemento))) {
                const multiplicador = 10 * ef.fator;
                c.defesa *= multiplicador;
                c.defesaMax *= multiplicador;
                c.st.x10 = true;
                efeitoVisual(estado,{tipo:'reforco',codigo:c.base.codigo,origem:c.uid,dono:i,alvo:c.uid,alvoDono:i,valor:c.defesa,atributo:'DEF',rotulo:'DEF'});
                log(estado, `${c.base.nome} enfrentou ${op.base.nome} (${op.base.elemento}): sua defesa foi multiplicada por ${multiplicador}!`);
            }
        }
    }

    // Heimdall captura somente cartas públicas em jogo. Anexos de outros universos
    // voltam à mão do dono anterior; os usos únicos da carta são preservados.
    function capturarNormais(estado) {
        const ordem = [estado.turno, ...estado.jogadores.map((_,i) => i).filter(i => i !== estado.turno)];
        const fontes = ordem.flatMap(dono => [...estado.jogadores[dono].campo, ...estado.jogadores[dono].apoio].flatMap(c => [c, ...c.equip]).filter(c => efeitosDe(estado,c).capturaNormal).map(inst => ({dono, inst})));
        for (const {dono,inst} of fontes) {
            const loc = localizar(estado, inst.uid);
            if (!loc || loc.dono !== dono || !['campo','apoio','equip'].includes(loc.zona) || !efeitosDe(estado,inst).capturaNormal) continue;
            const destino = estado.jogadores[dono];
            const tomadas = [];
            for (const rival of adversarios(estado,dono)) {
                const j = estado.jogadores[rival];
                function transferir(c, zona, portador) {
                    if (protecao(estado,rival,portador || c,inst.base,true)) return;
                    efeitoVisual(estado,{tipo:'captura',codigo:'n008',origem:inst.uid,dono,alvo:c.uid,alvoDono:rival});
                    if (zona === 'equip') {
                        portador.equip.splice(portador.equip.indexOf(c),1);
                        const bonus = c.bonusDefesa ?? (Number(c.base.defesa) || 0);
                        portador.defesaMax = Math.max(1,portador.defesaMax-bonus);
                        portador.defesa = Math.min(portador.defesaMax,Math.max(1,portador.defesa-bonus));
                    } else j[zona].splice(j[zona].indexOf(c),1);
                    const anexos = c.equip.splice(0);
                    if (zona === 'campo') {
                        const apoios = j.apoio.filter(a => a.vinculo == null || a.vinculo === c.uid);
                        j.apoio = j.apoio.filter(a => !apoios.includes(a));
                        anexos.push(...apoios);
                    }
                    for (const anexo of anexos) {
                        reiniciar(anexo);
                        if (norm(anexo.base.universo) === 'normal') { destino.mao.push(anexo); tomadas.push(anexo.base.nome); }
                        else j.mao.push(anexo);
                    }
                    reiniciar(c); destino.mao.push(c); tomadas.push(c.base.nome);
                }
                // Apoios primeiro: uma proteção que permanecer ativa ainda bloqueia a captura.
                for (const a of j.apoio.slice()) if (norm(a.base.universo) === 'normal') transferir(a,'apoio');
                for (const c of j.campo.slice()) {
                    if (norm(c.base.universo) === 'normal') transferir(c,'campo');
                    else for (const eq of c.equip.slice()) if (norm(eq.base.universo) === 'normal') transferir(eq,'equip',c);
                }
            }
            if (tomadas.length) log(estado, `${inst.base.nome} transferiu para a mão de ${destino.nome}: ${tomadas.join(', ')}. Anexos de outros universos voltaram à mão do dono anterior.`);
        }
    }

    // ---------- baralho e turnos ----------
    function redistribuirDescartes(estado) {
        if (estado.cooperativo) return false;
        verificarFim(estado);
        const grupo=estado.torneio ? [estado.turno,...adversarios(estado)].map(i=>estado.jogadores[i]) : estado.jogadores;
        if (estado.vencedor !== null || (estado.torneio && grupo.length<2) || grupo.some(j => j.baralho.length)) return false;
        const cartas = [...(estado.reservaCentral || []), ...grupo.flatMap(reciclaveis)];
        const participantes = grupo.filter(j=>!j.eliminado);
        if (cartas.length < participantes.length) return false;
        const mistura = embaralhar(cartas), metade = Math.floor(mistura.length / participantes.length);
        grupo.forEach(j=>{j.descarte=j.descarte.filter(descartePermanente);});
        participantes.forEach((j, i) => {
            j.baralho = mistura.slice(i * metade, (i + 1) * metade);
        });
        estado.reservaCentral = mistura.slice(participantes.length * metade);
        estado.redistribuicoes = (estado.redistribuicoes || 0) + 1;
        log(estado, `${estado.todosContraTodos ? 'Todos os baralhos acabaram.' : 'Os dois baralhos acabaram.'} Os descartes foram reunidos e redistribuídos: ${metade} carta(s) por jogador${estado.reservaCentral.length ? `; ${estado.reservaCentral.length} carta(s) ficou no centro para a próxima redistribuição` : ''}.`);
        return true;
    }

    function podeComprar(estado, dono = estado.turno) {
        if (estado.vencedor !== null || impassePorDescarte(estado)) return false;
        const j = estado.jogadores[dono];
        if (j.baralho.length) return true;
        if (estado.cooperativo) return reciclaveis(j).length > 0;
        const grupo=estado.torneio ? [dono,...adversarios(estado,dono)].map(i=>estado.jogadores[i]) : estado.jogadores;
        return (!estado.torneio || grupo.length===2) && !grupo.some(j => j.baralho.length) && grupo.reduce((n,j) => n + reciclaveis(j).length, (estado.reservaCentral || []).length) >= grupo.filter(j=>!j.eliminado).length;
    }

    // compra até n cartas; devolve quantas foram compradas
    function comprar(estado, indice, n) {
        const j = estado.jogadores[indice];
        let compradas = 0;
        for (let k = 0; k < n; k++) {
            redistribuirDescartes(estado);
            if (estado.vencedor !== null) break;
            if (!j.baralho.length) {
                if (!estado.cooperativo || !reciclaveis(j).length) break;
                j.baralho = embaralhar(reciclaveis(j));
                j.descarte = j.descarte.filter(descartePermanente);
                log(estado, `${j.nome} reembaralhou o descarte no baralho.`);
            }
            j.mao.push(j.baralho.pop());
            compradas++;
            redistribuirDescartes(estado);
        }
        return compradas;
    }

    // efeitos de início de turno: recargas, Hércules, dano por turno e confusão
    function iniciarTurno(estado) {
        const j = atual(estado);
        estado.acoes = j.acoesPorTurno || REGRAS.acoesPorTurno;
        log(estado, `Turno ${estado.numTurno}: vez de ${j.nome}.`);

        const todas = [...j.mao, ...j.campo, ...j.apoio];
        j.campo.forEach((c) => todas.push(...c.equip));
        todas.forEach((c) => { if (c.rec > 0) c.rec--; });

        let c = j.campo[0];
        if (c) {
            if (j.rep && norm(j.rep.codigo) === 'd007' && c.defesa < c.defesaMax) {
                const recuperada = Math.min(c.defesaMax - c.defesa, fatorHabilidade(estado, estado.turno));
                c.defesa += recuperada;
                efeitoVisual(estado,{tipo:'cura',codigo:'D007',origem:c.uid,dono:estado.turno,alvo:c.uid,alvoDono:estado.turno,valor:recuperada,defesa:c.defesa,atributo:'DEF'});
                log(estado, `${j.rep.nome} recuperou ${recuperada} ponto(s) de defesa de ${c.base.nome}: ${c.defesa}/${c.defesaMax}.`);
            }
            const ef = efeitosDe(estado, c);
            if (ef.dobraACada3) {
                c.st.turnos = (c.st.turnos || 0) + 1;
                if (c.st.turnos % 3 === 0) {
                    c.ataqueBase *= 2 * ef.fator;
                    efeitoVisual(estado,{tipo:'reforco',codigo:'n013',origem:c.uid,dono:estado.turno,alvo:c.uid,alvoDono:estado.turno,valor:c.ataqueBase,atributo:'ATQ base',rotulo:'ATQ'});
                    log(estado, `${c.base.nome} está há ${c.st.turnos} turnos em batalha: o ataque foi multiplicado para ${c.ataqueBase}!`);
                }
            }

            const danos = [];
            if (estado.pandora) danos.push(['A Caixa de Pandora', estado.danoPandora || 10]);
            if (c.st.veneno) danos.push(['O veneno', c.st.veneno]);
            if (c.st.queimadura) danos.push(['A queimadura', c.st.queimadura]);
            for (const [origem, valor] of danos) {
                c.defesa -= valor;
                efeitoVisual(estado,{tipo:origem==='O veneno'?'veneno':origem==='A queimadura'?'fogo':'pandora',origem:c.uid,dono:estado.turno,alvo:c.uid,alvoDono:estado.turno,dano:valor,defesa:Math.max(0,c.defesa)});
                logAutomatico(estado, `${origem} causou ${valor} de dano a ${c.base.nome}. DEF restante: ${Math.max(0,c.defesa)}.`);
                if (c.defesa <= 0) { morrer(estado, estado.turno, c); c = null; break; }
            }
        }

        if (c && c.st.confusao) {
            const d = ataqueTotal(c, c.base, estado);
            c.defesa -= d;
            efeitoVisual(estado,{tipo:'confusao',codigo:'n020',origem:c.uid,dono:estado.turno,alvo:c.uid,alvoDono:estado.turno,dano:d,defesa:Math.max(0,c.defesa)});
            logAutomatico(estado, `${c.base.nome} está confusa e atacou a si mesma: ${d} de dano. DEF restante: ${Math.max(0,c.defesa)}. Confusão por ${Number(c.st.confusao)} turno(s), incluindo este.`);
            if (c.defesa <= 0) morrer(estado, estado.turno, c);
        }
        verificarPresenca(estado);
        verificarFim(estado);
    }

    function tamanhoParaParticipantes(total, participantes) {
        if (![20,30,40].includes(total)) throw Object.assign(new Error('Escolha uma partida com 20, 30 ou 40 cartas no total.'), {code:'TAMANHO_BARALHO_INVALIDO'});
        if (!Number.isInteger(participantes) || participantes < 2 || participantes > 8) throw new Error('A partida precisa de dois a oito participantes.');
        return Math.ceil(Math.max(total, participantes * REGRAS.minimoCartasPorJogador) / participantes) * participantes;
    }

    function novoJogo(config, cartas) {
        const lista = cartas.map(normalizarCarta);
        const vistas = new Set();
        const pool = lista.filter((c) => {
            if (norm(c.classe) === 'representante') return false;
            const codigo = String(c.codigo || '').trim().toLowerCase();
            const chave = codigo ? `codigo:${codigo}` : c.numero != null ? `numero:${c.numero}` : `nome:${norm(c.nome)}`;
            if (vistas.has(chave)) return false;
            vistas.add(chave);
            return true;
        });
        // Arredondar para cima garante uma divisão inicial inteira e igual por participante.
        const total = tamanhoParaParticipantes(config.tamanhoBaralho === undefined ? 40 : config.tamanhoBaralho, config.nomes.length);
        if (pool.length < total) {
            throw Object.assign(new Error(`Esta partida precisa de ${total} cartas jogáveis distintas, mas o catálogo tem ${pool.length}. Escolha um total menor no lobby ou adicione cartas ao catálogo.`), { code: 'CARTAS_INSUFICIENTES' });
        }
        const distribuicao = embaralhar(pool).slice(0, total);
        const equipes = config.equipes || config.nomes.map((_,i)=>i);
        const cooperativo = Boolean(config.equipes) && !config.todosContraTodos;
        const participantes = config.nomes.map((_, i) => i);
        const arenas2v2=config.equipes2v2?[[0,1],[2,3]]:null;
        const primeiro=arenas2v2?(participantes.includes(config.comeca)?config.comeca:Math.floor(Math.random()*4)):null;
        const arenaInicial=arenas2v2?arenas2v2.findIndex(a=>a.includes(primeiro)):null;
        const ordemArenas=arenas2v2?[arenas2v2[arenaInicial],arenas2v2[1-arenaInicial]].flatMap(a=>a[0]%2===primeiro%2?a:[...a].reverse()):null;
        const baralhos = participantes.map(() => []);
        if (cooperativo || config.todosContraTodos) {
            // Cada participante começa com um campeão, evitando mãos sem como entrar em batalha.
            const campeoes = distribuicao.filter(c => norm(c.classe) === 'campeao');
            // Em conjuntos menores, procurar também entre as cartas que não entraram no sorteio.
            for (const c of embaralhar(pool)) if (norm(c.classe) === 'campeao' && !campeoes.includes(c)) campeoes.push(c);
            if (campeoes.length < participantes.length) throw Object.assign(new Error(`A partida precisa de pelo menos ${participantes.length} campeões distintos.`), { code: 'CARTAS_INSUFICIENTES' });
            const reservas = campeoes.slice(0, participantes.length);
            const restantes = embaralhar(pool.filter(c => !reservas.includes(c))).slice(0, total - participantes.length);
            let cursor = 0;
            participantes.forEach(i => baralhos[i].push(reservas[i]));
            if (config.todosContraTodos) restantes.forEach((c,i)=>baralhos[i % participantes.length].push(c));
            else for (const time of [0, 1]) {
                const membros = participantes.filter(i => equipes[i] === time);
                for (let i = 0; i < total / 2 - membros.length; i++) baralhos[membros[i % membros.length]].push(restantes[cursor++]);
            }
        } else for (const time of [0, 1]) {
            const membros = participantes.filter(i => equipes[i] === time);
            if (!membros.length) throw new Error('As duas equipes precisam de participantes.');
            distribuicao.slice(time * total / 2, (time + 1) * total / 2).forEach((c, i) => baralhos[membros[i % membros.length]].push(c));
        }
        if (baralhos.some(b => b.length < REGRAS.minimoCartasPorJogador)) throw Object.assign(new Error('Cada participante precisa de pelo menos cinco cartas no total, incluindo a mão inicial.'), { code: 'CARTAS_INSUFICIENTES' });
        const estado = {
            tamanhoBaralho: total,
            cooperativo, equipes2v2: Boolean(config.equipes2v2), arenas2v2, arenaInicial:arenaInicial===null?null:arenaInicial+1, torneio: config.torneio ? {rodada:1,...montarRodada(participantes)} : null, todosContraTodos: Boolean(config.todosContraTodos), equipes, ordemTurnos: config.ordemTurnos || ordemArenas || participantes,
            jogadores: participantes.map((i) => ({
                nome: config.nomes[i],
                equipe: equipes[i], maquina: Boolean(config.maquinas && config.maquinas[i]),
                eliminado: false, acoesPorTurno: REGRAS.acoesPorTurno,
                rep: (config.reps && config.reps[i]) || null,
                baralho: [], mao: [], campo: [], apoio: [], descarte: [],
                derrotados: 0,
                bonusCampeao: 0
            })),
            turno: participantes.includes(config.comeca) ? config.comeca : primeiro??Math.floor(Math.random() * participantes.length),
            numTurno: 1,
            serieVisual: 0, efeitosVisuais: [],
            acoes: REGRAS.acoesPorTurno,
            vencedor: null,
            pandora: false, pandoraUsos: 0, pandoraVersao: 2,
            reservaCentral: [],
            log: [],
            proxUid: 1
        };
        estado.jogadores.forEach((j, i) => {
            j.baralho = baralhos[i].map(c => nova(estado, c));
            if (cooperativo || config.todosContraTodos) j.mao.push(j.baralho.shift());
            comprar(estado, i, REGRAS.maoInicial - j.mao.length);
        });
        if (estado.torneio?.aguardando.includes(estado.turno)) estado.turno=estado.torneio.duelos[0][0];
        log(estado, `${estado.jogadores[estado.turno].nome} começa. Cada jogador recebeu ${REGRAS.maoInicial} cartas.`);
        iniciarTurno(estado);
        return estado;
    }

    function encerrarTurno(estado) {
        const e = fim(estado); if (e) return e;
        const j = atual(estado);
        const c = j.campo[0];
        if (c) {
            if (c.st.paralisia > 0) c.st.paralisia--;
            if (c.st.confusao > 0) {
                c.st.confusao = Number(c.st.confusao) - 1;
                if (!c.st.confusao) delete c.st.confusao;
            }
        }
        for (const aux of j.apoio.slice()) {
            if (!efeitosBrutos(aux).dino || !(aux.st.dino > 0)) continue;
            const ef = efeitosDe(estado, aux);
            const idx = indiceOponente(estado), inimigo = estado.jogadores[idx]?.campo[0];
            let acertou=false;
            if (j.campo[0] && ef.dino && inimigo) {
                const ferida = ferivel(estado,idx,inimigo,aux.base);
                const bloqueio = protecao(estado,idx,inimigo,aux.base,true) || (!ferida.ok && ferida.motivo);
                if (bloqueio) {
                    efeitoVisual(estado,{tipo:'bloqueio',codigo:aux.base.codigo,origem:aux.uid,dono:estado.turno,alvo:inimigo.uid,alvoDono:idx});
                    logAutomatico(estado, `${aux.base.nome}: habilidade bloqueada. ${bloqueio}`);
                }
                else {
                    const dano = aux.st.danoDino ?? ef.dino;
                    inimigo.defesa -= dano;
                    efeitoVisual(estado,{tipo:'dino',codigo:'n022',origem:aux.uid,dono:estado.turno,alvo:inimigo.uid,alvoDono:idx,dano,defesa:Math.max(0,inimigo.defesa),...(aux.st.dino===1?{ultimo:1}:{})});acertou=true;
                    logAutomatico(estado, `${aux.base.nome} causou ${dano} de dano a ${inimigo.base.nome} no fim do turno de ${j.nome}. DEF restante: ${Math.max(0,inimigo.defesa)}.`);
                    if (inimigo.defesa <= 0) morrer(estado,idx,inimigo);
                }
            } else logAutomatico(estado, `${aux.base.nome} não causou dano neste encerramento: ${!ef.dino?'habilidade anulada':!j.campo[0]?'sem criatura vinculada':'sem criatura inimiga em batalha'}.`);
            aux.st.dino--;
            if (aux.st.dino === 0) {
                if(!acertou)efeitoVisual(estado,{tipo:'dino-fim',codigo:'n022',origem:aux.uid,dono:estado.turno,alvo:aux.uid,alvoDono:estado.turno});
                j.apoio.splice(j.apoio.indexOf(aux), 1);
                paraDescarte(j, aux);
                logAutomatico(estado, `${aux.base.nome} bateu em um cacto após concluir sua habilidade, foi destruído e vai para o descarte de ${j.nome}.`);
            } else logAutomatico(estado, `${aux.base.nome}: restam ${aux.st.dino} encerramento(s) de turno do dono.`);
            verificarFim(estado);
            if (estado.vencedor !== null) break;
        }
        redistribuirDescartes(estado);
        if (estado.vencedor !== null) return { ok: true };
        // Pula eliminados, inclusive quando o dano do início do turno elimina alguém.
        do {
            const ordem = estado.ordemTurnos || [0, 1];
            let pos = ordem.indexOf(estado.turno);
            do { pos = (pos + 1) % ordem.length; } while (estado.jogadores[ordem[pos]].eliminado || estado.torneio?.aguardando.includes(ordem[pos]));
            estado.turno = ordem[pos];
            estado.alvo = undefined;
            estado.numTurno++;
            iniciarTurno(estado);
        } while (estado.vencedor === null && (atual(estado).eliminado || estado.torneio?.aguardando.includes(estado.turno)));
        return { ok: true };
    }

    // todas as ações do turno custam 1 das 2 ações
    function semAcoes(estado) {
        return estado.acoes <= 0 ? erro('Você não tem mais ações neste turno.') : null;
    }

    function eliminarCarta(estado, uid) {
        const e=fim(estado)||semAcoes(estado);if(e)return e;
        const j=atual(estado),inst=j.campo.find(c=>c.uid===uid);
        if(!inst||!ehCriatura(inst))return erro('Só é possível eliminar seu próprio campeão ou besta em batalha.');
        const nome=inst.base.nome,campeao=ehCampeao(inst);
        estado.acoes=Math.max(0,estado.acoes-1);
        morrer(estado,estado.turno,inst);
        const texto=`${j.nome} eliminou voluntariamente ${nome}. ${campeao?`Conta uma derrota de campeão para ${j.nome}: ${j.derrotados}/${REGRAS.campeoesParaVencer}.`:'A derrota de uma besta não altera a contagem de campeões.'}`;
        log(estado,texto);
        verificarPresenca(estado);verificarFim(estado);redistribuirDescartes(estado);
        return {ok:true,registroEliminacao:texto};
    }

    // ---------- ações do turno ----------
    function comprarAcao(estado) {
        const e = fim(estado) || semAcoes(estado); if (e) return e;
        const j = atual(estado);
        if (!podeComprar(estado)) return erro(!estado.cooperativo && estado.jogadores.some(j => j.baralho.length) ? 'Seu baralho acabou. A redistribuição ocorrerá quando os dois baralhos acabarem.' : 'Não há cartas para comprar.');
        comprar(estado, estado.turno, 1);
        estado.acoes = Math.max(0, estado.acoes - 1);
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
            const bonus = REGRAS.bonusRepresentante * fatorHabilidade(estado, estado.turno);
            inst.defesa += bonus;
            inst.defesaMax += bonus;
            log(estado, `${rep.nome} deu +${bonus} de defesa para ${inst.base.nome}.`);
            efeitoVisual(estado,{tipo:'representante',codigo:rep.codigo,origem:inst.uid,dono:estado.turno,alvo:inst.uid,alvoDono:estado.turno,valor:bonus,atributo:'DEF'});
        }
        if (ehCampeao(inst) && j.bonusCampeao > 0) {
            inst.defesa += j.bonusCampeao;
            inst.defesaMax += j.bonusCampeao;
            logAutomatico(estado, `${inst.base.nome} recebeu +${j.bonusCampeao} de defesa (herança de Zord Fenrir).`);
            efeitoVisual(estado,{tipo:'escudo',codigo:'n023',origem:inst.uid,dono:estado.turno,alvo:inst.uid,alvoDono:estado.turno,valor:j.bonusCampeao,defesa:inst.defesa,atributo:'DEF'});
            j.bonusCampeao = 0;
        }
        j.campo.push(inst);
        efeitoVisual(estado,{tipo:'entrada',codigo:inst.base.codigo,origem:inst.uid,dono:estado.turno,alvo:inst.uid,alvoDono:estado.turno,defesa:inst.defesa,zonaOrigem:'mao',zonaAlvo:'campo'});
        for (const aux of j.apoio) if (aux.vinculo == null) aux.vinculo = inst.uid;
        estado.acoes = Math.max(0, estado.acoes - 1);
        log(estado, `${j.nome} colocou ${inst.base.nome} em batalha.`);
        verificarPresenca(estado);
        return { ok: true };
    }

    function colocarApoio(estado, uid) {
        const e = fim(estado) || semAcoes(estado); if (e) return e;
        const { j, i, inst } = cartaDaMao(estado, uid);
        if (!inst) return erro('Essa carta não está na sua mão.');
        if (classeDe(inst) !== 'auxiliar') return erro('Só auxiliares vão para a zona de apoio.');
        if (!j.campo.some(ehCriatura)) return erro('Coloque um campeão ou uma besta em batalha antes de jogar um auxiliar.');
        if (j.apoio.length >= REGRAS.maxApoio) return erro(`Só pode haver ${REGRAS.maxApoio} auxiliares na batalha.`);

        j.mao.splice(i, 1);
        inst.vinculo = j.campo[0]?.uid ?? null;
        j.apoio.push(inst);
        if (efeitosBrutos(inst).dino) {
            const fator=fatorHabilidade(estado,inst);inst.st.dino=3*fator;inst.st.danoDino=4*fator;
        }
        estado.acoes = Math.max(0, estado.acoes - 1);
        log(estado, `${j.nome} colocou ${inst.base.nome} em apoio.`);
        if(inst.base.codigo!=='n001')efeitoVisual(estado,{tipo:silenciada(estado,inst)?'entrada':'presenca',codigo:inst.base.codigo,origem:inst.uid,dono:estado.turno,alvo:j.campo[0].uid,alvoDono:estado.turno});
        const habilidade = HAB[inst.base.codigo];
        if (habilidade?.aoLancar) {
            const motivo = silenciada(estado, inst);
            if (motivo) logAutomatico(estado, `${inst.base.nome}: habilidade ao lançar anulada. ${motivo}`);
            else {
                const resultado = habilidade.aoLancar({ estado, j, inst, potencia: fatorHabilidade(estado, inst) });
                efeitoVisual(estado,{tipo:'habilidade',codigo:inst.base.codigo,origem:inst.uid,dono:estado.turno,alvo:j.campo[0]?.uid,alvoDono:estado.turno});
                logAutomatico(estado, `${inst.base.nome}: ${resultado.texto}`);
            }
        }
        verificarPresenca(estado);
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

        const defesa = (Number(inst.base.defesa) || 0) * fatorHabilidade(estado, inst);
        j.mao.splice(i, 1);
        inst.bonusDefesa = defesa;
        alvo.defesa += defesa;
        alvo.defesaMax += defesa;
        alvo.equip.push(inst);
        efeitoVisual(estado,{tipo:'equipar',codigo:inst.base.codigo,origem:inst.uid,dono:estado.turno,alvo:alvo.uid,alvoDono:estado.turno,valor:defesa,defesa:alvo.defesa,atributo:'DEF'});
        estado.acoes = Math.max(0, estado.acoes - 1);
        log(estado, `${j.nome} equipou ${inst.base.nome} em ${alvo.base.nome}.`);
        verificarPresenca(estado);
        if(efeitosDe(estado,alvo).dobraBaseComItem&&cl==='item')efeitoVisual(estado,{tipo:'reforco',codigo:alvo.base.codigo,origem:alvo.uid,dono:estado.turno,alvo:alvo.uid,alvoDono:estado.turno,valor:ataqueTotal(alvo,outro(estado)?.campo[0]?.base,estado),atributo:'ATQ',rotulo:'ATQ'});
        return { ok: true };
    }

    // a criatura em batalha ataca a criatura em batalha do adversário (dano e contra-ataque)
    function contato(estado, atacante, alvo) {
        for (const eq of alvo.equip) {
            const ef = efeitosDe(estado, eq);
            if (ef.queimaContato && atacante.defesa > 0 && !atacante.st.queimadura) {
                atacante.st.queimadura = ef.queimaContato;
                const donoAlvo=estado.jogadores.findIndex(j=>j.campo.includes(atacante));
                efeitoVisual(estado,{tipo:'fogo-aplicado',codigo:eq.base.codigo,origem:eq.uid,dono:estado.jogadores.findIndex(j=>j.campo.includes(alvo)),alvo:atacante.uid,alvoDono:donoAlvo});
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

        const f = ferivel(estado, indiceOponente(estado), t, a.base);
        if (!f.ok) return erro(f.motivo);

        const d = ataqueTotal(a, t.base, estado);
        t.defesa -= d;
        efeitoVisual(estado,{tipo:'ataque',codigo:a.base.codigo,elemento:a.base.elemento,origem:a.uid,dono:estado.turno,alvo:t.uid,alvoDono:indiceOponente(estado),dano:d,defesa:Math.max(0,t.defesa)});
        estado.acoes = Math.max(0, estado.acoes - 1);
        let texto = `${a.base.nome} atacou ${t.base.nome}: ${d} de dano.`;
        contato(estado, a, t);
        const registrar = () => {
            // Registrar antes de morrer(): o descarte restaura os atributos da carta.
            texto += ` Defesa restante: ${a.base.nome} (${j.nome}) ${Math.max(0, a.defesa)}; ${t.base.nome} (${o.nome}) ${Math.max(0, t.defesa)}.`;
            log(estado, texto);
        };

        if (t.defesa <= 0) {
            texto += ` Contra-ataque: 0 de dano (${t.base.nome} foi derrotado antes de revidar).`;
            registrar();
            morrer(estado, indiceOponente(estado), t);
        } else {
            const f2 = ferivel(estado, estado.turno, a, t.base);
            if (f2.ok && !(t.st.paralisia > 0)) {
                const d2 = ataqueTotal(t, a.base, estado);
                a.defesa -= d2;
                efeitoVisual(estado,{tipo:'ataque',codigo:t.base.codigo,elemento:t.base.elemento,origem:t.uid,dono:indiceOponente(estado),alvo:a.uid,alvoDono:estado.turno,dano:d2,defesa:Math.max(0,a.defesa)});
                texto += ` Contra-ataque: ${d2} de dano.`;
                contato(estado, t, a);
            } else {
                if(t.st.paralisia>0)efeitoVisual(estado,{tipo:'paralisia',codigo:t.base.codigo,origem:t.uid,dono:indiceOponente(estado),alvo:t.uid,alvoDono:indiceOponente(estado)});
                else {
                    const fonte=j.apoio.find(aux=>efeitosDe(estado,aux).anulaElemento?.some(el=>norm(el)===norm(t.base.elemento)))||a;
                    efeitoVisual(estado,{tipo:'bloqueio',codigo:fonte.base.codigo,origem:fonte.uid,dono:estado.turno,alvo:a.uid,alvoDono:estado.turno});
                }
                texto += ` Contra-ataque: 0 de dano (${t.st.paralisia > 0 ? `${t.base.nome} está paralisada` : f2.motivo}).`;
            }
            registrar();
            if (a.defesa <= 0) morrer(estado, estado.turno, a);
        }
        verificarPresenca(estado);
        verificarFim(estado);
        redistribuirDescartes(estado);
        return { ok: true, registroCombate: texto };
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

    function escolherCartas(c, lista, titulo) {
        const limite = Math.min(c.potencia, lista.length);
        const escolhidos = c.escolha == null ? [] : String(c.escolha).split(',').map(Number);
        if (escolhidos.some((uid,i) => !lista.some(x => x.uid === uid) || escolhidos.indexOf(uid) !== i) || escolhidos.length > limite) return erro('Escolha cartas válidas e diferentes.');
        if (lista.length === 1 && !escolhidos.length) escolhidos.push(lista[0].uid);
        if (escolhidos.length < limite) return pedir(`${titulo} (${escolhidos.length + 1}/${limite})`, lista.filter(x => !escolhidos.includes(x.uid)).map(x => ({ valor: [...escolhidos, x.uid].join(','), rotulo: `${x.base.nome} (${x.base.classe} · ATQ ${x.base.ataque} · DEF ${x.base.defesa})` })));
        return { alvos: lista.filter(x => escolhidos.includes(x.uid)) };
    }

    const HAB = {
        n001: {
            tipo: 'passiva',
            texto: 'Ao ser lançada, retire a primeira carta do tipo metálico encontrada no baralho e coloque-a em sua mão. Se não houver carta metálica, descarte a Grávida dos Robôs.',
            detalhe: 'Executa automaticamente ao entrar em apoio, sem gastar outra ação. Busca a partir do topo do baralho de compra, sem descartar as demais cartas nem mudar sua ordem. Se encontrar uma metálica, permanece vinculada à sua criatura. Pode ser anulada por outras cartas.',
            aoLancar(c) {
                let n = 0;
                for (let k = 0; k < c.potencia; k++) {
                    const i = c.j.baralho.findLastIndex(x => norm(x.base.elemento) === 'metalico');
                    if (i < 0) break;
                    c.j.mao.push(c.j.baralho.splice(i, 1)[0]);
                    n++;
                }
                if (n) return { texto: `buscou ${n} carta(s) metálica(s) a partir do topo do baralho e colocou na mão.` };
                c.j.apoio.splice(c.j.apoio.indexOf(c.inst), 1);
                paraDescarte(c.j, c.inst);
                return { texto: 'não encontrou cartas metálicas no baralho de compra e foi para a pilha de descarte.' };
            }
        },
        n002: {
            tipo: 'ativa', consumivel: true, publica: true, local: ['mao'], botao: 'Lançar feitiço',
            texto: 'Todos os campeões e bestas em batalha sofrem 10 de dano no início do turno do dono, inclusive os do invocador, até uma criatura em batalha morrer.',
            detalhe: 'Até 3 usos por partida, recuperando a carta do descarte entre os usos. Após o terceiro, fica permanentemente no descarte. Auxiliares não recebem dano. Não acumula enquanto o efeito estiver ativo. Campeões derrotados contam para a vitória; bestas não.',
            exec(c) {
                const usos = Math.max(c.inst.usos.n002 || 0,c.estado.pandoraUsos || 0);
                if (usos >= 3) return erro('A Caixa de Pandora atingiu o limite de 3 usos e fica permanentemente no descarte.');
                if (c.estado.pandora) return erro('O efeito de Pandora já está ativo. Aguarde a derrota de uma criatura.');
                c.inst.usos.n002 = c.estado.pandoraUsos = usos + 1;
                c.estado.pandora = true;
                c.estado.pandoraVersao = 2;
                c.estado.danoPandora = 10 * c.potencia;
                return { ok:true, texto: `ativou a Caixa de Pandora (${usos + 1}/3 usos): ${c.estado.danoPandora} de dano no início do turno de cada criatura, até uma delas morrer.` };
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
                const lista = c.j.descarte.filter((x) => norm(x.base.universo) === 'zumbi' && !descartePermanente(x));
                if (!lista.length) return erro('Você não tem cartas do universo zumbi no seu descarte.');
                const r = escolherCartas(c,lista,'Qual carta zumbi volta para a sua mão?');
                if (!r.alvos) return r;
                c.j.descarte = c.j.descarte.filter(x => !r.alvos.includes(x));
                c.j.mao.push(...r.alvos);
                return { ok: true, texto: `trouxe ${r.alvos.map(x => x.base.nome).join(', ')} do descarte para a mão.` };
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
                const b = bloqueio(c, t); if (b) return erro(b);
                const escolhidos = escolherCartas(c,t.equip,'Qual equipamento será arremessado?');
                if (!escolhidos.alvos) return escolhidos;
                for (const alvo of escolhidos.alvos) removerEquip(c.estado, c.idxOp, t, alvo);
                return { ok: true, alvosVisuais:escolhidos.alvos.map(x=>x.uid), texto: `arremessou ${escolhidos.alvos.map(x => x.base.nome).join(', ')} para longe: o equipamento foi para o descarte do adversário.` };
            }
        },
        n007: passiva('Causa dano apenas em cartas dos tipos fantasma e sombrio.',
            'O ataque desta arma só é somado quando o alvo é fantasma ou sombrio.'),
        n008: passiva('Todas as cartas do universo Normal que o oponente já colocou ou vier a colocar em campo são transferidas para a sua mão.',
            'Funciona enquanto Heimdall estiver em apoio. Captura criaturas, auxiliares, itens e armas do universo Normal em jogo. Anexos de outros universos voltam à mão do dono anterior. Não acessa a mão, o baralho nem o descarte adversário.'),
        n009: passiva('Enquanto estiver em apoio, duplica os valores numéricos dos efeitos das habilidades das suas outras cartas.',
            'Duplica danos de habilidades, bônus, multiplicadores, cartas obtidas e duração dos efeitos. Não dobra o ataque básico, os custos de ações, as recargas, os intervalos de ativação nem os limites de uso único. Efeitos já aplicados conservam seus valores e sua duração.'),
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
                r.t.st.veneno = 2 * c.potencia;
                return { ok: true, texto: `envenenou ${r.t.base.nome}: ${r.t.st.veneno} de dano por turno.` };
            }
        },
        n017: {
            tipo: 'ativa', consumivel: true, publica: true, local: ['mao'], botao: 'Lançar feitiço',
            texto: 'Causa 3 de dano e paralisa por 1 turno os seres do universo game.',
            detalhe: 'A paralisia afeta criaturas do universo Game: impede atacar, contra-atacar e usar habilidades até terminar o próximo turno do dono. Contra outros universos, causa somente os 3 de dano.',
            exec(c) {
                const t = c.o.campo[0];
                if (t && norm(t.base.universo) === 'game') {
                    const b = bloqueio(c, t); if (b) return erro(b);
                    t.st.paralisia = Math.max(Number(t.st.paralisia) || 0, c.potencia);
                    return { ok: true, texto: `${t.base.nome} foi paralisada por ${t.st.paralisia} turno(s).` };
                }
                return { ok: true, texto: `${t?.base.nome || 'O alvo'} não é do universo Game: recebe o dano, mas não fica paralisada.` };
            }
        },
        n018: passiva('Causa o dobro de dano em criaturas do tipo metálico.'),
        n019: {
            tipo: 'ativa', local: ['campo'], botao: 'Voltar para a mão',
            texto: 'Consegue voltar para a sua mão uma única vez, para recuperar seus atributos.',
            detalhe: 'Kitsune volta com defesa e ataque originais. Itens, armas e auxiliares vinculados também voltam para a mão. Esta habilidade só pode ser usada uma vez por partida.',
            exec(c) {
                if (c.estado.kitsuneUsada || c.inst.usos[c.chave]) return erro('Essa habilidade só pode ser usada uma vez por partida e já foi usada.');
                const aux = c.j.apoio.filter(a => a.vinculo == null || a.vinculo === c.inst.uid);
                c.j.apoio = c.j.apoio.filter(a => !aux.includes(a));
                const eq = [...c.inst.equip, ...aux];
                c.inst.equip = [];
                c.j.campo.splice(c.j.campo.indexOf(c.inst), 1);
                reiniciar(c.inst);
                c.inst.usos[c.chave] = true;
                c.estado.kitsuneUsada = true;
                c.j.mao.push(c.inst);
                eq.forEach((x) => { reiniciar(x); delete x.vinculo; c.j.mao.push(x); });
                return { ok: true, texto: `voltou para a mão e recuperou seus atributos${eq.length ? ' (itens, armas e auxiliares vinculados também voltaram)' : ''}.` };
            }
        },
        n020: {
            tipo: 'ativa', publica: true, local: ['campo'], botao: 'Confundir o oponente',
            texto: 'Deixa o oponente confuso e faz com que ele ataque a si mesmo por 1 turno. Recarga de 3 turnos para usar de novo.',
            detalhe: 'No início do próximo turno do adversário, a criatura dele se ataca e sofre o próprio dano.',
            exec(c) {
                if (c.inst.rec > 0) return erro(`A habilidade está recarregando: faltam ${c.inst.rec} turno(s) seus.`);
                const r = alvoCriatura(c); if (r.erro) return r;
                const b = bloqueio(c, r.t); if (b) return erro(b);
                if (r.t.st.confusao) return erro(`${r.t.base.nome} já está confusa.`);
                r.t.st.confusao = c.potencia;
                c.inst.rec = 3;
                return { ok: true, texto: `confundiu ${r.t.base.nome}: ela vai atacar a si mesma no início dos próximos ${c.potencia} turno(s) do adversário.` };
            }
        },
        n021: passiva('Sopra bolhas no oponente, distraindo os auxiliares dele e impedindo que usem habilidades.',
            'Funciona enquanto a arma estiver equipada na criatura em batalha.'),
        n022: passiva('No fim de cada um dos três turnos do dono, causa 4 de dano à criatura inimiga em batalha. Após o terceiro, bate em um cacto e vai para o descarte.',
            'O turno em que entra em apoio já conta. Funciona automaticamente, sem ação extra ou contra-ataque; não aumenta o ataque da sua criatura. No co-op e no Local entre várias pessoas, atinge o adversário selecionado. Sem alvo, ou se anulada, o turno também conta. Sai antes se sua criatura vinculada morrer.'),
        n023: passiva('Ao ser derrotada, a próxima carta de campeão que você colocar em batalha recebe +100 de defesa.'),
        n024: {
            tipo: 'ativa', consumivel: true, local: ['mao'], botao: 'Lançar feitiço',
            texto: 'Joga todas as cartas da pilha de descarte de volta ao baralho e embaralha as cartas.',
            detalhe: 'Vale para o seu descarte e o seu baralho.',
            exec(c) {
                const cartas = reciclaveis(c.j);
                if (!cartas.length) return erro('Não há cartas recuperáveis no seu descarte.');
                const n = cartas.length;
                c.j.baralho = embaralhar(c.j.baralho.concat(cartas.map((x) => { reiniciar(x); return x; })));
                c.j.descarte = c.j.descarte.filter(descartePermanente);
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
                const restante = Math.max(0, 1 - .5 * c.potencia), minimo = restante ? 1 : 0;
                t.defesaMax = Math.max(minimo, Math.floor(t.defesaMax * restante));
                t.defesa = Math.min(t.defesaMax, Math.max(minimo, Math.floor(t.defesa * restante)));
                t.st.zumbi = true;
                const depois = t.defesa;
                if (depois <= 0) morrer(c.estado, c.idxOp, t);
                return { ok: true, defesaVisual:depois, texto: `zumbificou ${t.base.nome}: a defesa caiu de ${antes} para ${depois}.` };
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
                if (!podeComprar(c.estado, c.dono)) return erro('Não há cartas para comprar.');
                const n = comprar(c.estado, c.dono, 3 * c.potencia);
                return { ok: true, texto: `comprou ${n} carta(s).` };
            }
        },
        n032: passiva('Como foi a primeira infectada, tem muito mais defesa que o normal.',
            'Já está refletido na defesa da carta.', { semEfeito: true }),
        n033: passiva('Dobra o ataque base se estiver com um item equipado.'),
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
                    return { ok: true, copiada:src, texto: `copiou a habilidade passiva de ${t.base.nome}: "${h.texto}"` };
                }
                if (!h.local.includes('campo')) return erro(`A habilidade de ${t.base.nome} não pode ser copiada.`);
                const copia = Object.assign({}, c, { chave: src, origem: t.base });
                const res = h.exec(copia);
                if (res.ok) {res.copiada=src;res.texto = `copiou a habilidade de ${t.base.nome} e ${res.texto}`;}
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
                const escolhidos = escolherCartas(c,lista,'Qual campeão do baralho vai para a sua mão?');
                if (!escolhidos.alvos) return escolhidos;
                const alvos = escolhidos.alvos;
                c.j.baralho = c.j.baralho.filter(x => !alvos.includes(x));
                c.j.baralho = embaralhar(c.j.baralho);
                c.j.mao.push(...alvos);
                return { ok: true, texto: `procurou ${alvos.length} campeão(ões) no baralho e colocou na mão.` };
            }
        },
        n036: {
            tipo: 'ativa', local: ['campo'], botao: 'Afogar o adversário',
            texto: 'Auxiliares, itens e armas do tipo água do adversário são mandados para a pilha de descarte.',
            detalhe: 'Afeta só as cartas do adversário.',
            exec(c) {
                const o = c.o;
                const nomes = [],alvosVisuais=[];
                for (const a of o.apoio.slice()) {
                    if (norm(a.base.elemento) === 'agua') {
                        o.apoio.splice(o.apoio.indexOf(a), 1);
                        paraDescarte(o, a);
                        nomes.push(a.base.nome);alvosVisuais.push(a.uid);
                    }
                }
                const t = o.campo[0];
                if (t) {
                    for (const e of t.equip.slice()) {
                        if (norm(e.base.elemento) === 'agua') { removerEquip(c.estado, c.idxOp, t, e); nomes.push(e.base.nome);alvosVisuais.push(e.uid); }
                    }
                }
                if (!nomes.length) return erro('O adversário não tem auxiliares, itens nem armas do tipo água.');
                return { ok: true, alvosVisuais, texto: `mandou para o descarte: ${nomes.join(', ')}.` };
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
                t.defesa = c.inst.defesa * c.potencia;
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
    HAB.D007 = passiva('A cada turno, recupera 1 ponto de defesa do seu campeão ou da sua besta.',
        'Recupera no início do turno do dono, até o limite de defesa da criatura. Não recupera criaturas já derrotadas.');

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
        if (inst.base.codigo === 'n002') {
            if (Math.max(inst.usos.n002 || 0,estado.pandoraUsos || 0) >= 3) return nao('Limite de 3 usos; permanece no descarte.');
            if (estado.pandora) return nao('O efeito de Pandora já está ativo.');
        }
        if (inst.base.codigo === 'n019' && estado.kitsuneUsada) return nao('Já usada nesta partida (uso único).');
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
            estado, dono: estado.turno, idxOp: indiceOponente(estado), j, o,
            inst, escolha, chave: inst.base.codigo, origem: inst.base, potencia: fatorHabilidade(estado, inst)
        };

        // feitiços com ataque machucam a criatura em batalha do adversário
        const ehFeitico = classeDe(inst) === 'feitico';
        const danoBase = ehFeitico ? (Number(inst.base.ataque) || 0) : 0;
        let alvoDano = null;
        if (danoBase > 0) {
            alvoDano = o.campo[0];
            if (!alvoDano) return erro('O adversário não tem criatura em batalha para receber o feitiço.');
            const f = ferivel(estado, indiceOponente(estado), alvoDano, inst.base);
            if (!f.ok) return erro(f.motivo);
        }

        const alvoAntes = o?.campo[0];
        const maoAntes=j.mao.length;
        const res = h.exec(c);
        if (res.erro || res.pergunta) return res;

        const codigoVisual=res.copiada||inst.base.codigo;
        const propria=['n005','n019','n024','n031','n035'].includes(codigoVisual);
        const alvoVisual=propria?(j.campo[0]||inst):alvoAntes;
        const zonasVisuais={n005:['descarte','mao'],n019:['campo','mao'],n024:['descarte','baralho'],n031:['baralho','mao'],n035:['baralho','mao']};
        const extras=zonasVisuais[codigoVisual]?{zonaOrigem:zonasVisuais[codigoVisual][0],zonaAlvo:zonasVisuais[codigoVisual][1]}:{};
        if(['n031','n035'].includes(codigoVisual))extras.valor=j.mao.length-maoAntes;
        if(codigoVisual==='n028')extras.defesa=res.defesaVisual;
        if(codigoVisual==='n039')extras.defesa=alvoAntes?.defesa;
        if(res.copiada)extras.copiada=res.copiada;
        if(inst.base.codigo==='n002'){
            estado.jogadores.forEach((j,i)=>j.campo.forEach(t=>efeitoVisual(estado,{tipo:'pandora-aplicada',codigo:'n002',origem:inst.uid,dono:estado.turno,alvo:t.uid,alvoDono:i})));
        }else if(res.alvosVisuais?.length){
            for(const alvo of res.alvosVisuais)efeitoVisual(estado,{tipo:'habilidade',codigo:inst.base.codigo,copiada:res.copiada,origem:inst.uid,dono:estado.turno,alvo,alvoDono:c.idxOp});
        }else efeitoVisual(estado,{tipo:'habilidade',codigo:inst.base.codigo,elemento:inst.base.elemento,origem:inst.uid,dono:estado.turno,alvo:alvoVisual?.uid,alvoDono:propria?estado.turno:c.idxOp,...extras});

        estado.acoes = Math.max(0, estado.acoes - 1);
        let texto = `${j.nome} usou ${inst.base.nome}${res.texto ? `: ${res.texto}` : '.'}`;

        if (zona === 'mao' && h.consumivel) {
            const dano = alvoDano ? ataqueFeitico(inst, alvoDano.base, estado) : 0;
            const i = j.mao.findIndex((x) => x.uid === uid);
            if (i >= 0) j.mao.splice(i, 1);
            if (alvoDano) {
                const d = dano;
                alvoDano.defesa -= d;
                efeitoVisual(estado,{tipo:'dano-feitico',codigo:inst.base.codigo,origem:inst.uid,dono:estado.turno,alvo:alvoDano.uid,alvoDono:c.idxOp,dano:d,defesa:Math.max(0,alvoDano.defesa)});
                texto += ` ${alvoDano.base.nome} perdeu ${d} de defesa.`;
            }
            log(estado, texto);
            paraDescarte(j, inst);
            if (alvoDano && alvoDano.defesa <= 0 && o.campo.includes(alvoDano)) morrer(estado, indiceOponente(estado), alvoDano);
        } else {
            log(estado, texto);
        }
        verificarPresenca(estado);
        verificarFim(estado);
        redistribuirDescartes(estado);
        return { ok: true, ...(h.publica ? {registroHabilidade:texto} : {}) };
    }

    function lancarFeitico(estado, uid, escolha) {
        const loc = localizar(estado, uid);
        if (!loc || loc.zona !== 'mao' || !consumivel(loc.inst)) return erro('Essa carta não é um feitiço.');
        return executarHabilidade(estado, uid, escolha);
    }

    const Motor = {
        REGRAS, EFEITOS, HAB, TEXTOS, adversarios, indiceOponente, norm, classeDe, ehCampeao, ehCriatura, temEfeito, consumivel, descartePermanente, podeComprar, fatorHabilidade, tamanhoParaParticipantes,
        normalizarCarta, tituloNome, descricao, estadoHabilidade, silenciada,
        novoJogo, encerrarTurno, localizar, ataqueTotal, ataqueFeitico, ferivel,
        comprarAcao, eliminarCarta, invocar, colocarApoio, equipar, lancarFeitico, atacar,
        executarHabilidade, usarHabilidade: executarHabilidade
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = Motor;
    else raiz.Motor = Motor;
})(typeof window !== 'undefined' ? window : globalThis);
