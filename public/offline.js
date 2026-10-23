// Tela do modo offline. As regras ficam no motor.js.
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const R = Motor.REGRAS;
    const API_BASE = typeof API === 'string' ? API : '';

    let cartas = [];
    let representantes = [];
    let fonte = 'embutidas';
    let estado = null;
    let selecao = null;     // uid da carta selecionada
    let cortina = false;    // tela de troca de jogador
    let fimMostrado = false;
    let aviso = { texto: '', erro: false };
    let manualCartaAberto = false;

    // ---------- utilidades ----------
    function el(tag, classe, texto) {
        const e = document.createElement(tag);
        if (classe) e.className = classe;
        if (texto !== undefined && texto !== null) e.textContent = texto;
        return e;
    }

    function botao(texto, aoClicar, opcoes = {}) {
        const b = el('button', opcoes.classe === undefined ? 'btn pequeno' : opcoes.classe, texto);
        b.type = 'button';
        if (opcoes.desativado) b.disabled = true;
        if (opcoes.dica) b.title = opcoes.dica;
        b.addEventListener('click', aoClicar);
        return b;
    }

    const idElemento = (s) => Motor.norm(s) || 'neutro';
    const ehRepresentante = (c) => Motor.norm(c.classe) === 'representante';
    const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

    function imagemSrc(c) {
        if (!c.imagem) return null;
        return fonte === 'servidor' ? API_BASE + c.imagem : '..' + c.imagem;
    }

    function criarArte(c) {
        const caixa = el('div', 'c-arte');
        const inicial = () => caixa.append(el('span', 'inicial', (c.nome || '?').charAt(0).toUpperCase()));
        const src = imagemSrc(c);
        if (src) {
            const img = document.createElement('img');
            img.src = src;
            img.alt = '';
            img.loading = 'lazy';
            img.addEventListener('error', () => { img.remove(); inicial(); });
            caixa.append(img);
        } else {
            inicial();
        }
        return caixa;
    }

    function setAviso(texto, erro) {
        aviso = { texto: texto || '', erro: Boolean(erro) };
    }

    // ---------- carregar cartas (servidor se houver, senão a cópia embutida) ----------
    async function carregarCartas() {
        const embutidas = window.CARTAS_OFFLINE || [];
        try {
            const ctl = new AbortController();
            const t = setTimeout(() => ctl.abort(), 2500);
            const r = await fetch(`${API_BASE}/cartas`, { signal: ctl.signal });
            clearTimeout(t);
            if (!r.ok) throw new Error(`status ${r.status}`);
            const lista = await r.json();
            if (!Array.isArray(lista) || !lista.some((c) => !ehRepresentante(c))) throw new Error('banco vazio');
            cartas = lista.map(Motor.normalizarCarta);
            fonte = 'servidor';
        } catch {
            cartas = embutidas.map(Motor.normalizarCarta);
            fonte = 'embutidas';
        }

        representantes = cartas.filter(ehRepresentante);
        if (!representantes.length) {
            representantes = embutidas.map(Motor.normalizarCarta).filter(ehRepresentante);
            cartas = cartas.concat(representantes);
        }

        const jogaveis = cartas.filter((c) => !ehRepresentante(c)).length;
        $('fonte').textContent = fonte === 'servidor'
            ? `Cartas carregadas do banco do jogo (${jogaveis} jogáveis).`
            : `Sem servidor: usando a cópia offline das cartas (${jogaveis} jogáveis).`;
    }

    // ---------- configuração ----------
    function montarRegras() {
        const itens = [
            `Objetivo: vença ${R.campeoesParaVencer} campeões do adversário, usando suas cartas. Bestas derrotadas não contam.`,
            `Início: cada jogador recebe ${R.maoInicial} cartas.`,
            `Em cada turno você tem ${R.acoesPorTurno} ações. Cada uma pode ser: atacar, comprar uma carta, usar a habilidade de uma carta ou jogar uma carta.`,
            `Em batalha só pode haver ${R.maxCampo} campeão ou besta por jogador, e ele não volta para a mão depois de jogado. Só pode haver ${R.maxApoio} auxiliares na batalha.`,
            `Armas: só em campeões, e cada campeão carrega uma única arma. Itens: um por campeão, e até ${R.maxItensBesta} por besta.`,
            'Toda carta tem ataque e defesa. Atacar causa dano na defesa da criatura do adversário; se ela sobreviver, contra-ataca. Sem defesa, a criatura é derrotada.',
            'Feitiços com ataque atingem a criatura em batalha do adversário. "Usar habilidade" gasta uma ação, e o efeito é aplicado pelos jogadores com os "Ajustes manuais".',
            'Cartas com ⚙ aplicam parte da habilidade sozinhas (dobro de dano, imunidades...).',
            `Representante (opcional): dá +${R.bonusRepresentante} de defesa às criaturas do universo dele.`
        ];
        $('regras-lista').replaceChildren(...itens.map((t) => el('li', null, t)));
    }

    function infoRepresentante(i) {
        const valor = $(`rep-${i}`).value;
        const rep = valor === '' ? null : representantes[Number(valor)];
        if (!rep) {
            $(`rep-info-${i}`).textContent = 'Sem representante: nenhuma criatura recebe bônus.';
            return;
        }
        const partes = [];
        if (rep.universo) partes.push(`Universo: ${rep.universo}`);
        const habilidade = rep.habilidade ? rep.habilidade.charAt(0).toUpperCase() + rep.habilidade.slice(1) : '';
        $(`rep-info-${i}`).textContent = [partes.join(' · '), habilidade].filter(Boolean).join(' — ');
    }

    function montarConfig() {
        for (const i of [0, 1]) {
            const sel = $(`rep-${i}`);
            sel.replaceChildren();
            sel.add(new Option('Nenhum', ''));
            representantes.forEach((r, k) => sel.add(new Option(`${r.nome}${r.universo ? ` (${r.universo})` : ''}`, String(k))));
            sel.value = '';
            sel.onchange = () => infoRepresentante(i);
            infoRepresentante(i);
        }
        montarRegras();
    }

    function voltarParaConfig() {
        estado = null;
        selecao = null;
        cortina = false;
        $('cortina').hidden = true;
        $('fim').hidden = true;
        $('jogo').hidden = true;
        $('config').hidden = false;
        window.scrollTo(0, 0);
    }

    $('comecar').addEventListener('click', () => {
        const nomes = [0, 1].map((i) => ($(`nome-${i}`).value.trim() || `Jogador ${i + 1}`).slice(0, 20));
        if (nomes[0].toLowerCase() === nomes[1].toLowerCase()) nomes[1] += ' (2)';
        const reps = [0, 1].map((i) => {
            const v = $(`rep-${i}`).value;
            return v === '' ? null : representantes[Number(v)];
        });
        const comeca = $('comeca').value === 'sorteio' ? undefined : Number($('comeca').value);

        estado = Motor.novoJogo({ nomes, reps, tamanhoBaralho: Number($('baralho').value), comeca }, cartas);

        selecao = null;
        fimMostrado = false;
        setAviso('');
        $('config').hidden = true;
        $('jogo').hidden = false;
        window.scrollTo(0, 0);
        abrirCortina();
    });

    // ---------- troca de jogador ----------
    function abrirCortina() {
        cortina = true;
        const j = estado.jogadores[estado.turno];
        $('cortina-nome').textContent = j.nome;
        $('cortina-info').textContent = `Turno ${estado.numTurno}. Passe o computador para ${j.nome} e confirme quando só ele(a) estiver olhando.`;
        $('cortina').hidden = false;
        render();
        $('cortina-ok').focus();
    }

    $('cortina-ok').addEventListener('click', () => {
        cortina = false;
        $('cortina').hidden = true;
        setAviso('');
        render();
    });

    $('encerrar').addEventListener('click', () => {
        if (!estado || cortina || estado.vencedor !== null) return;
        Motor.encerrarTurno(estado);
        selecao = null;
        setAviso('');
        abrirCortina();
    });

    $('comprar').addEventListener('click', () => {
        if (!estado || cortina) return;
        rodar(Motor.comprarAcao(estado));
    });

    $('abandonar').addEventListener('click', () => {
        if (window.confirm('Abandonar a partida atual?')) voltarParaConfig();
    });

    // ---------- interação ----------
    function rodar(res) {
        if (res.erro) setAviso(res.erro, true);
        else setAviso('');
        render();
        return res;
    }

    function aoClicarCarta(inst) {
        if (cortina) return;
        selecao = inst.uid;
        render();
    }

    // ---------- desenho ----------
    function elementoStats(inst, emJogo) {
        const b = inst.base;
        const caixa = el('div', 'c-stats');
        const cl = Motor.classeDe(inst);
        const mais = cl === 'arma' || cl === 'item' ? '+' : '';
        const atq = emJogo && Motor.ehCriatura(inst) ? Motor.ataqueTotal(inst, null) : b.ataque;
        const def = emJogo ? inst.defesa : b.defesa;
        caixa.append(el('span', 'd', `ATQ ${mais}${atq}`), el('span', 'v', `DEF ${mais}${def}`));
        return caixa;
    }

    function miniCarta(inst, zona) {
        const b = inst.base;
        const bt = el('button', 'c');
        bt.type = 'button';
        bt.dataset.elemento = idElemento(b.elemento);
        bt.title = b.habilidade ? `${b.nome}: ${b.habilidade}` : b.nome;
        if (selecao === inst.uid) bt.classList.add('selecionada');

        const topo = el('div', 'c-topo');
        topo.append(el('span', 'classe', b.classe), el('span', null, b.codigo || `#${b.numero}`));
        bt.append(topo, criarArte(b), el('p', 'c-nome', b.nome), elementoStats(inst, zona === 'campo'));

        if (inst.equip.length) bt.append(el('p', 'c-equip', `+ ${inst.equip.map((e) => e.base.nome).join(', ')}`));

        if (Motor.temEfeito(b.codigo)) {
            const auto = el('span', 'c-auto', '⚙');
            auto.title = 'Parte da habilidade é aplicada automaticamente';
            bt.append(auto);
        }

        bt.addEventListener('click', () => aoClicarCarta(inst));
        return bt;
    }

    function fileira(titulo, lista, zona, max, classe) {
        const caixa = el('div', `fileira-wrap ${classe || ''}`);
        caixa.append(el('h4', null, `${titulo} (${lista.length}/${max})`));
        const linha = el('div', 'fileira');
        lista.forEach((inst) => linha.append(miniCarta(inst, zona)));
        for (let i = lista.length; i < max; i++) linha.append(el('div', 'slot-vazio', 'vazio'));
        caixa.append(linha);
        return caixa;
    }

    function renderLado(raiz, indice) {
        const j = estado.jogadores[indice];
        const ativo = indice === estado.turno;
        raiz.replaceChildren();

        const cab = el('div', 'cab');
        const quem = el('div', 'quem');
        quem.append(el('strong', null, j.nome));
        if (j.rep) {
            const rep = el('span', 'rep', `· ${j.rep.nome}`);
            if (j.rep.habilidade) rep.title = j.rep.habilidade;
            quem.append(rep);
        }
        if (ativo) quem.append(el('span', 'selo-vez', 'sua vez'));

        const derrotados = el('div', 'derrotados');
        derrotados.title = `Campeões de ${j.nome} já derrotados. Com ${R.campeoesParaVencer}, ${j.nome} perde.`;
        const pips = el('div', 'pips');
        for (let i = 0; i < R.campeoesParaVencer; i++) pips.append(el('span', 'pip' + (i < j.derrotados ? ' cheio' : '')));
        derrotados.append(el('span', null, 'Campeões derrotados'), pips, el('strong', null, `${j.derrotados}/${R.campeoesParaVencer}`));

        const pilhas = el('div', 'pilhas');
        pilhas.append(
            el('span', null, `Mão ${j.mao.length}`),
            el('span', null, `Baralho ${j.baralho.length}`),
            botao(`Descarte ${j.descarte.length}`, () => abrirPilha(indice), { classe: '' })
        );
        cab.append(quem, derrotados, pilhas);
        raiz.append(cab);

        raiz.append(fileira('Em batalha', j.campo, 'campo', R.maxCampo));
        raiz.append(fileira('Apoio', j.apoio, 'apoio', R.maxApoio, 'apoio'));

        if (ativo) {
            const mao = el('div', 'fileira-wrap');
            mao.append(el('h4', null, `Mão (${j.mao.length})`));
            if (cortina) {
                mao.append(el('p', 'mao-escondida', 'Mão escondida.'));
            } else if (!j.mao.length) {
                mao.append(el('p', 'mao-escondida', 'Sua mão está vazia. Use uma ação para comprar.'));
            } else {
                const linha = el('div', 'fileira');
                j.mao.forEach((inst) => linha.append(miniCarta(inst, 'mao')));
                mao.append(linha);
            }
            raiz.append(mao);
        }
    }

    // ---------- painel da carta selecionada ----------
    function acoesDaMao(inst) {
        const acoes = el('div', 'acoes-painel');
        const cl = Motor.classeDe(inst);
        const sem = estado.acoes <= 0;
        const opt = { desativado: sem, dica: sem ? 'Você não tem mais ações neste turno.' : '' };

        if (Motor.ehCriatura(inst)) {
            acoes.append(botao('Colocar em batalha', () => rodar(Motor.invocar(estado, inst.uid)), opt));
        } else if (cl === 'auxiliar') {
            acoes.append(botao('Colocar em apoio', () => rodar(Motor.colocarApoio(estado, inst.uid)), opt));
        } else if (cl === 'arma' || cl === 'item') {
            acoes.append(botao('Equipar na criatura em batalha', () => rodar(Motor.equipar(estado, inst.uid)), opt));
        } else if (cl === 'feitico') {
            acoes.append(botao('Lançar', () => rodar(Motor.lancarFeitico(estado, inst.uid)), opt));
        }
        acoes.append(botao('Descartar', () => rodar(Motor.descartarDaMao(estado, inst.uid)), { dica: 'Ajuste manual: não gasta ação.' }));
        if (sem) acoes.append(el('p', 'nota', 'Você não tem mais ações neste turno.'));
        return acoes;
    }

    function acoesEmJogo(inst, zona) {
        const acoes = el('div', 'acoes-painel');
        const sem = estado.acoes <= 0;
        const opt = { desativado: sem, dica: sem ? 'Você não tem mais ações neste turno.' : '' };
        if (zona === 'campo') acoes.append(botao('Atacar', () => rodar(Motor.atacar(estado)), opt));
        if (inst.base.habilidade) acoes.append(botao('Usar habilidade', () => rodar(Motor.usarHabilidade(estado, inst.uid)), opt));
        if (sem) acoes.append(el('p', 'nota', 'Você não tem mais ações neste turno.'));
        return acoes;
    }

    function ajustesDaCarta(inst) {
        const det = el('details', 'manual-carta');
        det.open = manualCartaAberto;
        det.addEventListener('toggle', () => { manualCartaAberto = det.open; });
        det.append(el('summary', null, 'Ajustes manuais desta carta'));

        const acoes = el('div', 'acoes-painel');
        acoes.append(
            botao('Ataque −1', () => rodar(Motor.ajustarCarta(estado, inst.uid, 'ataque', -1))),
            botao('Ataque +1', () => rodar(Motor.ajustarCarta(estado, inst.uid, 'ataque', 1))),
            botao('Defesa −1', () => rodar(Motor.ajustarCarta(estado, inst.uid, 'defesa', -1))),
            botao('Defesa +1', () => rodar(Motor.ajustarCarta(estado, inst.uid, 'defesa', 1))),
            botao('Enviar ao descarte', () => rodar(Motor.descartarCampo(estado, inst.uid)))
        );
        det.append(acoes);
        return det;
    }

    function renderPainel() {
        const raiz = $('painel-carta');
        raiz.replaceChildren();
        raiz.removeAttribute('data-elemento');

        let loc = selecao ? Motor.localizar(estado, selecao) : null;
        if (loc && (loc.zona === 'descarte' || (loc.zona === 'mao' && loc.dono !== estado.turno))) loc = null;
        if (!loc || cortina) {
            raiz.append(el('p', 'suave', 'Clique em uma carta para ver os detalhes e as ações.'));
            return;
        }

        const { inst, zona, dono } = loc;
        const b = inst.base;
        raiz.dataset.elemento = idElemento(b.elemento);
        raiz.append(el('p', 'codigo', b.codigo || `Carta #${b.numero}`), el('h3', null, b.nome));

        const chips = el('div', 'chips');
        [b.classe, b.elemento, b.universo, b.origem].filter(Boolean).forEach((v) => chips.append(el('span', 'chip', v)));
        raiz.append(chips, elementoStats(inst, zona === 'campo' || zona === 'apoio'));

        if (zona === 'campo') raiz.append(el('p', 'suave', `Defesa máxima: ${inst.defesaMax}`));
        if (inst.equip.length) raiz.append(el('p', 'suave', `Equipado: ${inst.equip.map((e) => e.base.nome).join(', ')}`));
        if (b.habilidade) {
            raiz.append(el('p', 'titulo-hab', 'Habilidade'), el('p', 'habilidade', b.habilidade));
            raiz.append(el('p', 'nota', Motor.temEfeito(b.codigo)
                ? '⚙ Parte desta habilidade é aplicada automaticamente. O resto, aplique pelos ajustes.'
                : 'Habilidade manual: use "Usar habilidade" e aplique o efeito pelos ajustes.'));
        }

        if (estado.vencedor === null && dono === estado.turno) {
            if (zona === 'mao') raiz.append(acoesDaMao(inst));
            if (zona === 'campo' || zona === 'apoio') raiz.append(acoesEmJogo(inst, zona));
        }
        if (estado.vencedor === null && (zona === 'campo' || zona === 'apoio')) raiz.append(ajustesDaCarta(inst));
    }

    function renderManual() {
        const raiz = $('manual');
        raiz.replaceChildren();
        estado.jogadores.forEach((j, i) => {
            const linha = el('div', 'manual-linha');
            linha.append(el('span', null, `Campeões derrotados de ${j.nome}: ${j.derrotados}/${R.campeoesParaVencer}`));
            linha.append(
                botao('−1', () => rodar(Motor.ajustarDerrotados(estado, i, -1))),
                botao('+1', () => rodar(Motor.ajustarDerrotados(estado, i, 1))),
                botao('Comprar carta', () => rodar(Motor.comprarManual(estado, i)))
            );
            raiz.append(linha);
        });
    }

    function renderLog() {
        const lista = $('log');
        lista.replaceChildren();
        estado.log.slice(-40).reverse().forEach((t) => lista.append(el('li', null, t)));
    }

    function abrirPilha(indice) {
        const j = estado.jogadores[indice];
        $('pilha-titulo').textContent = `Descarte de ${j.nome} (${j.descarte.length})`;
        const lista = $('pilha-lista');
        lista.replaceChildren();
        if (!j.descarte.length) lista.append(el('li', null, 'Vazio.'));
        j.descarte.slice().reverse().forEach((c) => {
            const li = el('li', null, c.base.nome);
            li.append(' ', el('small', null, `· ${c.base.classe}`));
            lista.append(li);
        });
        $('pilha').showModal();
    }
    $('pilha-fechar').addEventListener('click', () => $('pilha').close());
    $('pilha').addEventListener('click', (e) => { if (e.target === $('pilha')) $('pilha').close(); });

    function verFim() {
        if (!estado || estado.vencedor === null || fimMostrado) return;
        fimMostrado = true;
        $('fim-texto').textContent = estado.vencedor === -1
            ? 'Empate!'
            : `${estado.jogadores[estado.vencedor].nome} venceu!`;
        $('fim').hidden = false;
    }
    $('fim-novo').addEventListener('click', voltarParaConfig);
    $('fim-ver').addEventListener('click', () => { $('fim').hidden = true; });

    function render() {
        if (!estado) return;
        renderLado($('lado-op'), 1 - estado.turno);
        renderLado($('lado-ativo'), estado.turno);

        $('turno-texto').textContent = `Turno ${estado.numTurno} · vez de ${estado.jogadores[estado.turno].nome}`;
        const acoes = $('acoes-texto');
        acoes.replaceChildren(el('span', null, 'Ações:'));
        for (let i = 0; i < R.acoesPorTurno; i++) {
            acoes.append(el('span', 'acao-pip' + (i >= estado.acoes ? ' gasta' : '')));
        }
        acoes.append(el('span', null, `${estado.acoes}/${R.acoesPorTurno}`));

        const instrucao = $('instrucao');
        if (aviso.texto) {
            instrucao.textContent = aviso.texto;
            instrucao.className = 'instrucao' + (aviso.erro ? ' erro' : '');
        } else {
            instrucao.textContent = estado.vencedor !== null
                ? 'Partida encerrada.'
                : 'Clique em uma carta da sua mão ou do seu campo e escolha a ação.';
            instrucao.className = 'instrucao';
        }
        const bloqueado = cortina || estado.vencedor !== null;
        $('comprar').disabled = bloqueado || estado.acoes <= 0;
        $('encerrar').disabled = bloqueado;

        renderPainel();
        renderManual();
        renderLog();
        verFim();
    }

    // ---------- início ----------
    carregarCartas().then(montarConfig);
})();