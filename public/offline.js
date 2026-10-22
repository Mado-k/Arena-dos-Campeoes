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
    let alvo = null;        // modo "escolha um alvo": { texto, cartaValida, jogadorValido, resolver }
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
        const b = el('button', opcoes.classe || 'btn pequeno', texto);
        b.type = 'button';
        if (opcoes.desativado) b.disabled = true;
        if (opcoes.dica) b.title = opcoes.dica;
        b.addEventListener('click', aoClicar);
        return b;
    }

    const idElemento = (s) => Motor.norm(s) || 'neutro';
    const ehRepresentante = (c) => Motor.norm(c.classe) === 'representante';

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
            cartas = lista;
            fonte = 'servidor';
        } catch {
            cartas = embutidas;
            fonte = 'embutidas';
        }

        representantes = cartas.filter(ehRepresentante);
        if (!representantes.length) {
            representantes = embutidas.filter(ehRepresentante);
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
            'Objetivo: zerar a vida do oponente. A vida de cada jogador vem do representante escolhido, vezes a duração da partida.',
            `Representante: cada criatura do universo dele ganha +${R.bonusRepresentante} de vida ao entrar em campo.`,
            `Início: ${R.maoInicial} cartas na mão. Quem começa não compra no primeiro turno; depois, compra 1 carta por turno (máx. ${R.maxMao} na mão). Se o baralho acabar, o descarte é reembaralhado.`,
            `Cada turno você pode jogar até ${R.jogadasPorTurno} cartas (invocar, apoiar, equipar ou lançar). Atacar e ajustes manuais não gastam jogadas.`,
            `Campeões e bestas vão para o campo (máx. ${R.maxCampo}). Atacam uma vez por turno, a partir do turno seguinte ao da invocação.`,
            'Ataque: causa dano na criatura alvo; se ela sobreviver, contra-ataca. Se o oponente não tiver criaturas, o ataque vai direto na vida dele.',
            `Armas somam dano e itens com vida somam vida à criatura em que são equipados (máx. ${R.maxEquip} por criatura). Quando a criatura cai, eles vão para o descarte.`,
            `Auxiliares ficam na zona de apoio (máx. ${R.maxApoio}). Feitiços são usados uma vez; se tiverem dano, atingem uma criatura ou o jogador.`,
            'Cartas com ⚙ aplicam parte da habilidade sozinhas (dobro de dano, imunidades...). As demais habilidades são aplicadas por vocês, com os "Ajustes manuais".'
        ];
        $('regras-lista').replaceChildren(...itens.map((t) => el('li', null, t)));
    }

    function infoRepresentante(i) {
        const rep = representantes[Number($(`rep-${i}`).value)];
        if (!rep) return;
        const partes = [];
        if (rep.universo) partes.push(`Universo: ${rep.universo}`);
        if (rep.vida) partes.push(`Vida base: ${rep.vida}`);
        const habilidade = rep.habilidade ? rep.habilidade.charAt(0).toUpperCase() + rep.habilidade.slice(1) : '';
        $(`rep-info-${i}`).textContent = [partes.join(' · '), habilidade].filter(Boolean).join(' — ');
    }

    function montarConfig() {
        for (const i of [0, 1]) {
            const sel = $(`rep-${i}`);
            sel.replaceChildren();
            representantes.forEach((r, k) => sel.add(new Option(`${r.nome}${r.universo ? ` (${r.universo})` : ''}`, String(k))));
            sel.value = String(Math.min(i, representantes.length - 1));
            sel.onchange = () => infoRepresentante(i);
            infoRepresentante(i);
        }
        montarRegras();
    }

    function voltarParaConfig() {
        estado = null;
        selecao = null;
        alvo = null;
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
        const reps = [0, 1].map((i) => representantes[Number($(`rep-${i}`).value)]);
        const comeca = $('comeca').value === 'sorteio' ? undefined : Number($('comeca').value);

        estado = Motor.novoJogo({
            nomes,
            reps,
            fatorVida: Number($('duracao').value),
            tamanhoBaralho: Number($('baralho').value),
            comeca
        }, cartas);

        selecao = null;
        alvo = null;
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
        alvo = null;
        setAviso('');
        abrirCortina();
    });

    $('cancelar').addEventListener('click', () => {
        alvo = null;
        setAviso('');
        render();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && alvo) { alvo = null; render(); }
    });

    $('abandonar').addEventListener('click', () => {
        if (window.confirm('Abandonar a partida atual?')) voltarParaConfig();
    });

    // ---------- interação ----------
    function rodar(res) {
        if (res.erro) {
            setAviso(res.erro, true);
        } else {
            setAviso('');
            alvo = null;
        }
        render();
        return res;
    }

    function iniciarAlvo(cfg) {
        alvo = cfg;
        setAviso('');
        render();
    }

    function aoClicarCarta(inst, zona, dono) {
        if (cortina) return;
        if (alvo && alvo.cartaValida({ zona, dono, inst })) {
            rodar(alvo.resolver({ tipo: 'criatura', uid: inst.uid }));
            return;
        }
        selecao = inst.uid;
        render();
    }

    function aoClicarJogador(indice) {
        if (cortina || !alvo || !alvo.jogadorValido(indice)) return;
        rodar(alvo.resolver({ tipo: 'jogador' }));
    }

    // ---------- desenho ----------
    function elementoStats(inst) {
        const b = inst.base;
        const caixa = el('div', 'c-stats');
        const cl = Motor.classeDe(inst);
        if (Motor.ehCriatura(inst)) {
            caixa.append(el('span', 'd', `⚔ ${Motor.danoTotal(inst, null)}`), el('span', 'v', `♥ ${inst.vida}`));
        } else {
            const mais = cl === 'arma' || cl === 'item' ? '+' : '';
            if (Number(b.dano)) caixa.append(el('span', 'd', `⚔ ${mais}${b.dano}`));
            if (Number(b.vida)) caixa.append(el('span', 'v', `♥ ${mais}${b.vida}`));
        }
        return caixa;
    }

    function miniCarta(inst, zona, dono) {
        const b = inst.base;
        const bt = el('button', 'c');
        bt.type = 'button';
        bt.dataset.elemento = idElemento(b.elemento);
        bt.title = b.habilidade ? `${b.nome}: ${b.habilidade}` : b.nome;
        if (selecao === inst.uid) bt.classList.add('selecionada');
        if (alvo && alvo.cartaValida({ zona, dono, inst })) bt.classList.add('alvo-valido');

        const topo = el('div', 'c-topo');
        topo.append(el('span', 'classe', b.classe), el('span', null, b.codigo || `#${b.numero}`));
        bt.append(topo, criarArte(b), el('p', 'c-nome', b.nome), elementoStats(inst));

        if (inst.equip.length) bt.append(el('p', 'c-equip', `+ ${inst.equip.map((e) => e.base.nome).join(', ')}`));

        if (zona === 'campo' && dono === estado.turno && !cortina) {
            const dorme = inst.invocadoEm >= estado.numTurno;
            const texto = dorme ? 'Recém-invocada' : inst.atacou ? 'Já atacou' : 'Pronta';
            bt.append(el('p', 'c-estado' + (texto === 'Pronta' ? ' pronta' : ''), texto));
            if (dorme || inst.atacou) bt.classList.add('cansada');
        }
        if (Motor.temEfeito(b.codigo)) {
            const auto = el('span', 'c-auto', '⚙');
            auto.title = 'Parte da habilidade é aplicada automaticamente';
            bt.append(auto);
        }

        bt.addEventListener('click', () => aoClicarCarta(inst, zona, dono));
        return bt;
    }

    function fileira(titulo, lista, zona, dono, max, classe) {
        const caixa = el('div', `fileira-wrap ${classe || ''}`);
        caixa.append(el('h4', null, `${titulo} (${lista.length}/${max})`));
        const linha = el('div', 'fileira');
        lista.forEach((inst) => linha.append(miniCarta(inst, zona, dono)));
        for (let i = lista.length; i < max; i++) linha.append(el('div', 'slot-vazio', 'vazio'));
        caixa.append(linha);
        return caixa;
    }

    function renderLado(raiz, indice) {
        const j = estado.jogadores[indice];
        const ativo = indice === estado.turno;
        raiz.replaceChildren();

        const cab = el('div', 'cab');
        if (alvo && alvo.jogadorValido(indice)) {
            cab.classList.add('alvo-valido');
            cab.tabIndex = 0;
            cab.title = 'Clique para escolher este jogador como alvo';
            cab.addEventListener('click', () => aoClicarJogador(indice));
            cab.addEventListener('keydown', (e) => { if (e.key === 'Enter') aoClicarJogador(indice); });
        }

        const quem = el('div', 'quem');
        quem.append(el('strong', null, j.nome));
        const rep = el('span', 'rep', `· ${j.rep.nome}`);
        if (j.rep.habilidade) rep.title = j.rep.habilidade;
        quem.append(rep);
        if (ativo) quem.append(el('span', 'selo-vez', 'sua vez'));

        const vida = el('div', 'vida');
        const barra = el('div', 'barra-vida');
        const preenchida = document.createElement('i');
        preenchida.style.width = `${Math.max(0, Math.min(100, (j.vida / j.vidaMax) * 100))}%`;
        barra.append(preenchida);
        vida.append(barra, el('span', null, `${Math.max(0, j.vida)}/${j.vidaMax}`));

        const pilhas = el('div', 'pilhas');
        pilhas.append(
            el('span', null, `Mão ${j.mao.length}`),
            el('span', null, `Baralho ${j.baralho.length}`),
            botao(`Descarte ${j.descarte.length}`, () => abrirPilha(indice), { classe: '' })
        );
        cab.append(quem, vida, pilhas);
        raiz.append(cab);

        raiz.append(fileira('Campo', j.campo, 'campo', indice, R.maxCampo));
        raiz.append(fileira('Apoio', j.apoio, 'apoio', indice, R.maxApoio, 'apoio'));

        if (ativo) {
            const mao = el('div', 'fileira-wrap');
            mao.append(el('h4', null, `Mão (${j.mao.length}/${R.maxMao})`));
            if (cortina) {
                mao.append(el('p', 'mao-escondida', 'Mão escondida.'));
            } else if (!j.mao.length) {
                mao.append(el('p', 'mao-escondida', 'Sua mão está vazia.'));
            } else {
                const linha = el('div', 'fileira');
                j.mao.forEach((inst) => linha.append(miniCarta(inst, 'mao', indice)));
                mao.append(linha);
            }
            raiz.append(mao);
        }
    }

    // ---------- painel da carta selecionada ----------
    function acoesDaMao(inst) {
        const acoes = el('div', 'acoes-painel');
        const cl = Motor.classeDe(inst);
        const semJogada = estado.jogadas <= 0;
        const dica = semJogada ? 'Você não tem mais jogadas neste turno.' : '';
        const opt = { desativado: semJogada, dica };
        const turno = estado.turno;

        if (Motor.ehCriatura(inst)) {
            acoes.append(botao('Invocar', () => rodar(Motor.invocar(estado, inst.uid)), opt));
        } else if (cl === 'auxiliar') {
            acoes.append(botao('Colocar em apoio', () => rodar(Motor.colocarApoio(estado, inst.uid)), opt));
        } else if (cl === 'arma' || cl === 'item') {
            acoes.append(botao('Equipar em…', () => iniciarAlvo({
                texto: `Escolha uma criatura sua para equipar ${inst.base.nome}.`,
                cartaValida: (l) => l.dono === turno && l.zona === 'campo',
                jogadorValido: () => false,
                resolver: (a) => Motor.equipar(estado, inst.uid, a.uid)
            }), opt));
        } else if (cl === 'feitico') {
            if (Number(inst.base.dano) > 0) {
                acoes.append(botao('Lançar em…', () => iniciarAlvo({
                    texto: `Escolha o alvo de ${inst.base.nome}: uma criatura do oponente ou o próprio jogador.`,
                    cartaValida: (l) => l.dono !== turno && l.zona === 'campo',
                    jogadorValido: (i) => i !== turno,
                    resolver: (a) => Motor.lancarFeitico(estado, inst.uid, a)
                }), opt));
            } else {
                acoes.append(botao('Lançar', () => rodar(Motor.lancarFeitico(estado, inst.uid, null)), opt));
            }
        }
        acoes.append(botao('Descartar', () => rodar(Motor.descartarDaMao(estado, inst.uid))));
        return acoes;
    }

    function acoesDoCampo(inst) {
        const acoes = el('div', 'acoes-painel');
        const turno = estado.turno;
        const oponente = estado.jogadores[1 - turno];
        const dorme = inst.invocadoEm >= estado.numTurno;

        let motivo = '';
        if (inst.atacou) motivo = 'Já atacou neste turno.';
        else if (dorme) motivo = 'Acabou de ser invocada: ataca no próximo turno.';
        const opt = { desativado: Boolean(motivo), dica: motivo };

        if (!oponente.campo.length) {
            acoes.append(botao('Atacar o jogador', () => rodar(Motor.atacar(estado, inst.uid, { tipo: 'jogador' })), opt));
        } else {
            acoes.append(botao('Atacar…', () => iniciarAlvo({
                texto: `Escolha uma criatura do oponente para ${inst.base.nome} atacar.`,
                cartaValida: (l) => l.dono !== turno && l.zona === 'campo',
                jogadorValido: () => false,
                resolver: (a) => Motor.atacar(estado, inst.uid, a)
            }), opt));
        }
        if (motivo) acoes.append(el('p', 'nota', motivo));
        return acoes;
    }

    function ajustesDaCarta(inst) {
        const det = el('details', 'manual-carta');
        det.open = manualCartaAberto;
        det.addEventListener('toggle', () => { manualCartaAberto = det.open; });
        det.append(el('summary', null, 'Ajustes manuais desta carta'));

        const acoes = el('div', 'acoes-painel');
        acoes.append(
            botao('Vida −1', () => rodar(Motor.ajustarCarta(estado, inst.uid, 'vida', -1))),
            botao('Vida +1', () => rodar(Motor.ajustarCarta(estado, inst.uid, 'vida', 1))),
            botao('Dano −1', () => rodar(Motor.ajustarCarta(estado, inst.uid, 'dano', -1))),
            botao('Dano +1', () => rodar(Motor.ajustarCarta(estado, inst.uid, 'dano', 1))),
            botao('Enviar ao descarte', () => rodar(Motor.descartarCampo(estado, inst.uid))),
            botao('Voltar à mão', () => rodar(Motor.devolverMao(estado, inst.uid)))
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
        raiz.append(chips, elementoStats(inst));

        if (Motor.ehCriatura(inst)) raiz.append(el('p', 'suave', `Vida máxima: ${inst.vidaMax}`));
        if (inst.equip.length) raiz.append(el('p', 'suave', `Equipado: ${inst.equip.map((e) => e.base.nome).join(', ')}`));
        if (b.habilidade) {
            raiz.append(el('p', 'titulo-hab', 'Habilidade'), el('p', 'habilidade', b.habilidade));
            raiz.append(el('p', 'nota', Motor.temEfeito(b.codigo)
                ? '⚙ Parte desta habilidade é aplicada automaticamente. O resto, aplique pelos ajustes.'
                : 'Habilidade manual: aplique usando os ajustes.'));
        }

        if (estado.vencedor === null && dono === estado.turno) {
            if (zona === 'mao') raiz.append(acoesDaMao(inst));
            if (zona === 'campo') raiz.append(acoesDoCampo(inst));
        }
        if (estado.vencedor === null && (zona === 'campo' || zona === 'apoio')) raiz.append(ajustesDaCarta(inst));
    }

    function renderManual() {
        const raiz = $('manual');
        raiz.replaceChildren();
        estado.jogadores.forEach((j, i) => {
            const linha = el('div', 'manual-linha');
            linha.append(el('span', null, `Vida de ${j.nome}: ${Math.max(0, j.vida)}`));
            [-5, -1, 1, 5].forEach((d) => linha.append(
                botao(d > 0 ? `+${d}` : `−${Math.abs(d)}`, () => rodar(Motor.ajustarJogador(estado, i, d)))
            ));
            linha.append(botao('Comprar carta', () => rodar(Motor.comprarManual(estado, i))));
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
        $('fim-texto').textContent = estado.vencedor === -1 ? 'Empate!' : `${estado.jogadores[estado.vencedor].nome} venceu!`;
        $('fim').hidden = false;
    }
    $('fim-novo').addEventListener('click', voltarParaConfig);
    $('fim-ver').addEventListener('click', () => { $('fim').hidden = true; });

    function render() {
        if (!estado) return;
        renderLado($('lado-op'), 1 - estado.turno);
        renderLado($('lado-ativo'), estado.turno);

        $('turno-texto').textContent = `Turno ${estado.numTurno} · vez de ${estado.jogadores[estado.turno].nome}`;
        $('jogadas-texto').textContent = `Jogadas restantes: ${estado.jogadas}`;

        const instrucao = $('instrucao');
        if (aviso.texto) {
            instrucao.textContent = aviso.texto;
            instrucao.className = 'instrucao' + (aviso.erro ? ' erro' : '');
        } else if (alvo) {
            instrucao.textContent = alvo.texto;
            instrucao.className = 'instrucao alvo';
        } else {
            instrucao.textContent = estado.vencedor !== null
                ? 'Partida encerrada.'
                : 'Clique em uma carta da sua mão ou do seu campo.';
            instrucao.className = 'instrucao';
        }
        $('cancelar').hidden = !alvo;
        $('encerrar').disabled = cortina || estado.vencedor !== null;

        renderPainel();
        renderManual();
        renderLog();
        verFim();
    }

    // ---------- início ----------
    carregarCartas().then(montarConfig);
})();
