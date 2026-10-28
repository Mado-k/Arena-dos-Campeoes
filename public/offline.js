// Tela do modo offline. As regras e as habilidades ficam no motor.js.
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
    let aviso = { texto: '', tipo: '' };   // tipo: '', 'erro' ou 'ok'
    const turnos = criarAvisosTurno(encerrarTurno);

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

    function setAviso(texto, tipo) {
        aviso = { texto: texto || '', tipo: tipo || '' };
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
            `As cartas são divididas sem repetição: 40 no total = 20 por jogador; 30 = 15; 20 = 10. Cada jogador começa com ${R.maoInicial} dessas cartas na mão.`,
            `Em cada turno você tem ${R.acoesPorTurno} ações. Cada uma pode ser: atacar, comprar uma carta, usar a habilidade de uma carta ou jogar uma carta.`,
            `Em batalha só pode haver ${R.maxCampo} campeão ou besta por jogador, e ele não volta para a mão depois de jogado. Só pode haver ${R.maxApoio} auxiliares na batalha.`,
            `Armas: só em campeões, e cada campeão carrega uma única arma. Itens: um por campeão, e até ${R.maxItensBesta} por besta.`,
            'Quando um campeão ou uma besta é derrotado, os auxiliares vinculados a ele também vão para o descarte. Auxiliares não recebem ataques diretos.',
            'Toda carta tem ataque (ATQ) e defesa (DEF). Atacar tira defesa da criatura do adversário; se ela sobreviver, contra-ataca. Sem defesa, a criatura é derrotada.',
            'Habilidades são automáticas. Selecione a carta e clique em "Executar habilidade" (gasta 1 ação). Habilidades passivas funcionam sozinhas, sem gastar ação.',
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
        $(`rep-info-${i}`).textContent = [partes.join(' · '), Motor.descricao(rep).texto].filter(Boolean).join(' — ');
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
        turnos.limpar();
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

        $('config-erro').textContent = '';
        try {
            estado = Motor.novoJogo({ nomes, reps, tamanhoBaralho: Number($('baralho').value), comeca }, cartas);
        } catch (err) {
            $('config-erro').textContent = err.message;
            return;
        }

        selecao = null;
        fimMostrado = false;
        setAviso('');
        $('config').hidden = true;
        $('jogo').hidden = false;
        window.scrollTo(0, 0);
        abrirCortina();
    });

    // ---------- troca de jogador ----------
    function abrirCortina(encerramento = '') {
        cortina = true;
        const j = estado.jogadores[estado.turno];
        $('cortina-nome').textContent = j.nome;
        $('cortina-info').textContent = `${encerramento ? encerramento + ' ' : ''}Turno ${estado.numTurno}. Passe o computador para ${j.nome} e confirme quando só ele(a) estiver olhando.`;
        $('cortina').hidden = false;
        render();
        $('cortina-ok').focus();
    }

    $('cortina-ok').addEventListener('click', () => {
        cortina = false;
        $('cortina').hidden = true;
        render();
    });

    function encerrarTurno() {
        if (!estado || cortina || estado.vencedor !== null) return;
        const nome = estado.jogadores[estado.turno].nome;
        const antes = estado.log.length;
        Motor.encerrarTurno(estado);
        selecao = null;
        const novos = estado.log.slice(antes).filter((t) => !/^Turno \d+: vez de/.test(t));
        setAviso(novos.join(' '), novos.length ? 'ok' : '');
        const encerramento = `${nome} encerrou o turno. Agora é a vez de ${estado.jogadores[estado.turno].nome}.`;
        abrirCortina(encerramento);
        turnos.notificar(encerramento);
        // o que aconteceu no início do turno (dano por turno, confusão...) aparece depois da cortina
    }
    $('encerrar').addEventListener('click', encerrarTurno);

    $('comprar').addEventListener('click', () => {
        if (!estado || cortina) return;
        rodar(() => Motor.comprarAcao(estado));
    });

    $('abandonar').addEventListener('click', () => {
        if (window.confirm('Abandonar a partida atual?')) voltarParaConfig();
    });

    // ---------- interação ----------
    // executa uma ação do motor e mostra o que aconteceu (ou o motivo do erro)
    function rodar(acao) {
        const antes = estado.log.length;
        const res = acao();
        if (res && res.pergunta) return res;
        if (res && res.erro) {
            setAviso(res.erro, 'erro');
        } else {
            const novos = estado.log.slice(antes);
            setAviso(novos.join(' '), 'ok');
        }
        render();
        return res;
    }

    function executar(uid, escolha) {
        const res = rodar(() => Motor.executarHabilidade(estado, uid, escolha));
        if (res && res.pergunta) abrirEscolha(uid, res.pergunta);
    }

    function abrirEscolha(uid, pergunta) {
        $('escolha-titulo').textContent = pergunta.titulo;
        const caixa = $('escolha-opcoes');
        caixa.replaceChildren();
        pergunta.opcoes.forEach((o) => {
            caixa.append(botao(o.rotulo, () => {
                $('escolha').close();
                executar(uid, o.valor);
            }, { classe: 'btn' }));
        });
        $('escolha').showModal();
    }
    $('escolha-fechar').addEventListener('click', () => $('escolha').close());
    $('escolha').addEventListener('click', (e) => { if (e.target === $('escolha')) $('escolha').close(); });

    function aoClicarCarta(inst) {
        if (cortina) return;
        selecao = inst.uid;
        setAviso('');
        render();
    }

    // ---------- desenho das cartas ----------
    function etiquetas(inst, zona) {
        const lista = [];
        const st = inst.st || {};
        if (st.veneno) lista.push(['Envenenada', 'ruim', `Sofre ${st.veneno} de dano no início do turno do dono.`]);
        if (st.queimadura) lista.push(['Pegando fogo', 'ruim', `Sofre ${st.queimadura} de dano no início do turno do dono.`]);
        if (st.paralisia > 0) lista.push(['Paralisada', 'ruim', 'Não ataca nem usa habilidades no próximo turno do dono.']);
        if (st.confusao) lista.push(['Confusa', 'ruim', 'Vai atacar a si mesma no início do próximo turno do dono.']);
        if (st.zumbi) lista.push(['Zumbi', 'ruim', 'Defesa reduzida pela metade.']);
        if (Motor.fatorHabilidade(estado,inst) === 2) lista.push(['Efeitos ×2', 'bom', 'Fuleco duplica os valores dos efeitos desta carta.']);
        if (st.copia) lista.push(['Copiou habilidade', 'bom', Motor.TEXTOS[st.copia] || '']);
        if (st.dino > 0) lista.push([`Corre: ${st.dino} turno(s)`, 'bom', 'Dá +4 de ataque à sua criatura e some quando acabar.']);
        if (inst.rec > 0) lista.push([`Recarga: ${inst.rec}`, '', 'Turnos seus até poder usar a habilidade de novo.']);
        if (zona === 'apoio' || zona === 'campo' || zona === 'equip') {
            const sil = Motor.silenciada(estado, inst);
            if (sil) lista.push([zona === 'apoio' && /peixes/.test(sil) ? '🐟 Peixe' : 'Habilidade anulada', 'ruim', sil]);
        }
        const h = Motor.HAB[inst.base.codigo];
        if (h && ((inst.base.codigo === 'n019' || inst.base.codigo === 'n040') && inst.usos[inst.base.codigo])) lista.push(['Já usada', '', 'Habilidade de uso único.']);
        return lista;
    }

    function elementoStats(inst, emJogo) {
        const b = inst.base;
        const caixa = el('div', 'c-stats');
        const cl = Motor.classeDe(inst);
        const mais = cl === 'arma' || cl === 'item' ? '+' : '';
        const atq = emJogo && Motor.ehCriatura(inst) ? Motor.ataqueTotal(inst, null, estado) : b.ataque;
        const def = emJogo ? inst.defesa : b.defesa;
        caixa.append(el('span', 'd', `ATQ ${mais}${atq}`), el('span', 'v', `DEF ${mais}${def}`));
        return caixa;
    }

    function selarTipo(base) {
        const d = Motor.descricao(base);
        if (d.tipo === 'ativa') return el('span', 'tipo-hab ativa', '⚡ Ativa');
        if (d.tipo === 'passiva') return el('span', 'tipo-hab passiva', '● Passiva');
        return null;
    }

    function miniCarta(inst, zona) {
        const b = inst.base;
        const bt = el('button', 'c');
        bt.type = 'button';
        bt.dataset.elemento = idElemento(b.elemento);
        if (selecao === inst.uid) bt.classList.add('selecionada');

        const topo = el('div', 'c-topo');
        topo.append(el('span', 'classe', b.classe), el('span', null, b.elemento || ''));
        bt.append(topo, criarArte(b), el('p', 'c-nome', b.nome), elementoStats(inst, zona === 'campo'));

        const d = Motor.descricao(b);
        if (d.texto) {
            const desc = el('p', 'c-desc', d.texto);
            bt.append(desc);
        }
        const selo = selarTipo(b);
        if (selo) bt.append(selo);

        const etqs = etiquetas(inst, zona);
        if (etqs.length) {
            const linha = el('div', 'etqs');
            etqs.forEach(([t, tom, dica]) => { const e = el('span', `etq ${tom}`, t); if (dica) e.title = dica; linha.append(e); });
            bt.append(linha);
        }

        bt.addEventListener('click', () => aoClicarCarta(inst));
        return bt;
    }

    // carta com os equipamentos logo abaixo (clicáveis)
    function cartaComEquip(inst, zona) {
        const wrap = el('div', 'c-wrap');
        wrap.append(miniCarta(inst, zona));
        if (inst.equip.length) {
            const eq = el('div', 'equips');
            inst.equip.forEach((e) => {
                const b = el('button', 'equip' + (selecao === e.uid ? ' selecionada' : ''), `+ ${e.base.nome}`);
                b.type = 'button';
                b.dataset.elemento = idElemento(e.base.elemento);
                b.title = `${e.base.classe}: ${Motor.descricao(e.base).texto}`;
                b.addEventListener('click', () => aoClicarCarta(e));
                eq.append(b);
            });
            wrap.append(eq);
        }
        return wrap;
    }

    function fileira(titulo, dica, lista, zona, max, classe) {
        const caixa = el('div', `fileira-wrap ${classe || ''}`);
        caixa.dataset.zona = zona;
        const h = el('h4', null, `${titulo} (${lista.length}/${max})`);
        if (dica) h.append(el('span', 'dica-fileira', ` · ${dica}`));
        caixa.append(h);
        const linha = el('div', 'fileira');
        lista.forEach((inst) => linha.append(cartaComEquip(inst, zona)));
        if (!lista.length) {
            for (let i = 0; i < max; i++) linha.append(el('div', 'slot-vazio', 'vazio'));
        }
        caixa.append(linha);
        return caixa;
    }

    function renderLado(raiz, indice) {
        const j = estado.jogadores[indice];
        const ativo = indice === estado.turno;
        raiz.classList.toggle('lado-adversario', !ativo);
        raiz.replaceChildren();

        const cab = el('div', 'cab');
        const quem = el('div', 'quem');
        quem.append(el('strong', null, j.nome));
        if (j.rep) {
            const rep = el('span', 'rep', `· ${j.rep.nome}`);
            rep.title = Motor.descricao(j.rep).texto;
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

        const campo = el('div', 'campo-mesa');
        campo.append(
            fileira('Em batalha', 'campeão ou besta', j.campo, 'campo', R.maxCampo),
            fileira('Apoio', 'auxiliares', j.apoio, 'apoio', R.maxApoio, 'apoio')
        );
        raiz.append(campo);

        if (ativo) {
            const mao = el('div', 'fileira-wrap');
            mao.append(el('h4', null, `Sua mão (${j.mao.length})`));
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
    function acaoPrincipal(inst) {
        const sem = estado.acoes <= 0;
        const opt = { classe: 'btn primario', desativado: sem, dica: sem ? 'Você não tem mais ações neste turno.' : '' };
        const cl = Motor.classeDe(inst);
        if (Motor.consumivel(inst)) return null;   // usa "Executar habilidade"
        if (Motor.ehCriatura(inst)) return botao('Colocar em batalha', () => rodar(() => Motor.invocar(estado, inst.uid)), opt);
        if (cl === 'auxiliar') return botao('Colocar em apoio', () => rodar(() => Motor.colocarApoio(estado, inst.uid)), opt);
        if (cl === 'arma' || cl === 'item') return botao('Equipar na criatura em batalha', () => rodar(() => Motor.equipar(estado, inst.uid)), opt);
        return null;
    }

    function caixaHabilidade(inst, zona, dono) {
        const d = Motor.descricao(inst.base);
        const caixa = el('div', 'hab-box ' + d.tipo);
        const cab = el('div', 'hab-cab');
        cab.append(el('span', 'titulo-hab', 'Habilidade'));
        if (d.tipo === 'ativa') cab.append(el('span', 'tipo-hab ativa', '⚡ Ativa · gasta 1 ação'));
        else if (d.tipo === 'passiva') cab.append(el('span', 'tipo-hab passiva', '● Passiva · automática'));
        caixa.append(cab);

        if (!d.texto) { caixa.append(el('p', 'habilidade', 'Esta carta não tem habilidade.')); return caixa; }
        caixa.append(el('p', 'habilidade', d.texto));
        if (d.detalhe) {
            const det = el('p', 'hab-detalhe');
            det.append(el('strong', null, 'Como funciona: '), d.detalhe);
            caixa.append(det);
        }

        if (d.tipo === 'passiva') {
            const sit = Motor.estadoHabilidade(estado, inst.uid);
            if (sit.anulada) caixa.append(el('p', 'nota erro', `Anulada agora: ${sit.motivo}`));
            else if (d.semEfeito) caixa.append(el('p', 'nota', 'Já está refletida nos atributos da carta.'));
            else caixa.append(el('p', 'nota', 'Funciona sozinha: o jogo aplica quando for preciso.'));
        } else if (estado.vencedor === null && dono === estado.turno) {
            const sit = Motor.estadoHabilidade(estado, inst.uid);
            const b = botao(`⚡ ${d.botao || 'Executar habilidade'}`, () => executar(inst.uid), {
                classe: 'btn habilidade-btn', desativado: !sit.disponivel, dica: sit.motivo
            });
            caixa.append(b);
            if (!sit.disponivel && sit.motivo) caixa.append(el('p', 'nota', sit.motivo));
        }
        return caixa;
    }

    function renderPainel() {
        const raiz = $('painel-carta');
        raiz.replaceChildren();
        raiz.removeAttribute('data-elemento');

        let loc = selecao ? Motor.localizar(estado, selecao) : null;
        if (loc && (loc.zona === 'descarte' || (loc.zona === 'mao' && loc.dono !== estado.turno))) loc = null;
        if (!loc || cortina) {
            raiz.append(el('p', 'painel-vazio', 'Clique em uma carta para ler a descrição completa e ver o que você pode fazer com ela.'));
            if (aviso.texto) raiz.append(el('p', 'aviso ' + aviso.tipo, aviso.texto));
            return;
        }

        const { inst, zona, dono } = loc;
        const b = inst.base;
        raiz.dataset.elemento = idElemento(b.elemento);

        if (aviso.texto) raiz.append(el('p', 'aviso ' + aviso.tipo, aviso.texto));

        raiz.append(el('p', 'codigo', `${b.codigo || `Carta #${b.numero}`} · ${zona === 'mao' ? 'na mão' : zona === 'campo' ? 'em batalha' : zona === 'apoio' ? 'em apoio' : 'equipada'}${dono !== estado.turno ? ' · do adversário' : ''}`));
        raiz.append(el('h3', null, b.nome));

        const chips = el('div', 'chips');
        [b.classe, b.elemento, b.universo, b.origem].filter(Boolean).forEach((v) => chips.append(el('span', 'chip', v)));
        raiz.append(chips);

        const emJogo = zona === 'campo' || zona === 'apoio';
        const stats = elementoStats(inst, emJogo);
        stats.classList.add('grande');
        raiz.append(stats);
        if (zona === 'campo') raiz.append(el('p', 'suave', `Defesa máxima: ${inst.defesaMax}`));
        if (zona === 'equip') raiz.append(el('p', 'suave', 'Bônus de defesa e ataque já somados à criatura que a carrega.'));
        if (inst.equip.length) raiz.append(el('p', 'suave', `Equipado: ${inst.equip.map((e) => e.base.nome).join(', ')}`));

        const etqs = etiquetas(inst, zona);
        if (etqs.length) {
            const linha = el('div', 'etqs');
            etqs.forEach(([t, tom, dica]) => { const e = el('span', `etq ${tom}`, t); if (dica) e.title = dica; linha.append(e); });
            raiz.append(linha);
            etqs.filter((e) => e[2]).forEach((e) => raiz.append(el('p', 'nota', `${e[0]}: ${e[2]}`)));
        }

        raiz.append(caixaHabilidade(inst, zona, dono));

        if (estado.vencedor === null && dono === estado.turno) {
            const acoes = el('div', 'acoes-painel');
            if (zona === 'mao') {
                const p = acaoPrincipal(inst);
                if (p) acoes.append(p);
            }
            if (zona === 'campo') {
                const alvo = estado.jogadores[1 - estado.turno].campo[0];
                const sem = estado.acoes <= 0;
                let rotulo = 'Atacar';
                if (alvo) rotulo += ` · ${Motor.ataqueTotal(inst, alvo.base, estado)} de dano`;
                acoes.append(botao(rotulo, () => rodar(() => Motor.atacar(estado)), {
                    classe: 'btn primario', desativado: sem || !alvo,
                    dica: sem ? 'Você não tem mais ações neste turno.' : (!alvo ? 'O adversário não tem criatura em batalha.' : '')
                }));
                if (!alvo) acoes.append(el('p', 'nota', 'O adversário não tem criatura em batalha para atacar.'));
            }
            if (acoes.childNodes.length) raiz.append(acoes);
            if (estado.acoes <= 0) raiz.append(el('p', 'nota', 'Você não tem mais ações neste turno. Clique em "Encerrar turno".'));
        }
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
            ? 'Empate! Desejam reiniciar a partida ou encerrá-la?'
            : `${estado.jogadores[estado.vencedor].nome} venceu!`;
        $('fim-novo').textContent = estado.vencedor === -1 ? 'Reiniciar partida' : 'Nova partida';
        $('fim-ver').textContent = estado.vencedor === -1 ? 'Encerrar e ver o tabuleiro' : 'Ver tabuleiro';
        $('fim').hidden = false;
    }
    $('fim-novo').addEventListener('click', voltarParaConfig);
    $('fim-ver').addEventListener('click', () => { $('fim').hidden = true; });

    // texto do "próximo passo", conforme o que está selecionado
    function dica() {
        if (estado.vencedor !== null) return 'Partida encerrada.';
        if (estado.acoes <= 0) return 'Suas ações acabaram. Clique em "Encerrar turno" para passar a vez.';
        const loc = selecao ? Motor.localizar(estado, selecao) : null;
        const j = estado.jogadores[estado.turno];
        if (loc && loc.dono === estado.turno && loc.zona !== 'descarte') {
            const h = Motor.descricao(loc.inst.base);
            if (loc.zona === 'mao') {
                if (Motor.consumivel(loc.inst)) return `Clique em "${h.botao || 'Executar habilidade'}" no painel para usar esta carta.`;
                return 'Clique no botão do painel para jogar esta carta.';
            }
            if (h.tipo === 'ativa') return loc.zona === 'campo'
                ? `Você pode atacar ou usar "${h.botao}" (cada um gasta 1 ação).`
                : `Clique em "${h.botao}" no painel para usar a habilidade (gasta 1 ação).`;
            return 'Esta carta funciona sozinha. Selecione outra ou encerre o turno.';
        }
        if (!j.campo.length) return 'Comece colocando um campeão ou uma besta em batalha. Clique em uma carta da sua mão.';
        return `Você tem ${estado.acoes} ação(ões). Clique em uma carta sua para ver o que ela faz.`;
    }

    function render() {
        if (!estado) return;
        turnos.atualizar({ acoes: estado.acoes, suaVez: !cortina, numTurno: estado.numTurno, vencedor: estado.vencedor });
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
        if (aviso.texto && aviso.tipo) {
            instrucao.textContent = aviso.texto;
            instrucao.className = 'instrucao ' + aviso.tipo;
        } else {
            instrucao.textContent = dica();
            instrucao.className = 'instrucao';
        }

        const efeitos = $('efeitos');
        efeitos.replaceChildren();
        if (estado.pandora) efeitos.append(el('span', 'etq ruim', `☠ Caixa de Pandora aberta: toda criatura em batalha sofre ${estado.danoPandora || 10} de dano por turno`));
        if (estado.reservaCentral?.length) efeitos.append(el('span', 'etq', '1 carta reservada no centro para a próxima redistribuição'));
        efeitos.hidden = !efeitos.childNodes.length;

        const bloqueado = cortina || estado.vencedor !== null;
        $('comprar').disabled = bloqueado || estado.acoes <= 0;
        $('encerrar').disabled = bloqueado;
        $('encerrar').classList.toggle('primario', !bloqueado && estado.acoes <= 0);
        $('encerrar').classList.toggle('destaque', !bloqueado && estado.acoes <= 0);

        renderPainel();
        renderLog();
        verFim();
    }

    // ---------- início ----------
    carregarCartas().then(montarConfig);
})();
