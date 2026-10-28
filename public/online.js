// Mesa online com a mesma organização visual do offline.
// O servidor continua sendo a única autoridade sobre as ações e as cartas privadas.
(function () {
    'use strict';
    const el = (tag, texto, classe) => {
        const n = document.createElement(tag);
        if (texto !== undefined) n.textContent = texto;
        if (classe) n.className = classe;
        return n;
    };
    window.criarMesaOnline = function (socket, { aoMostrar = () => {}, aoSair = () => {} } = {}) {
        const mesa = el('section', undefined, 'jogo mesa-online');
        mesa.hidden = true;
        mesa.setAttribute('aria-label', 'Mesa da partida online');
        document.querySelector('main').append(mesa);
        const escolha = document.createElement('dialog');
        escolha.className = 'escolha-online';
        escolha.setAttribute('aria-label', 'Escolha da habilidade');
        const descarte = document.createElement('dialog');
        descarte.className = 'descarte-online';
        descarte.setAttribute('aria-label', 'Descarte');
        document.body.append(escolha, descarte);
        let estado = null, ocupado = false, selecionada = null, sessao = 0, alvoSelecionado = null;
        const aviso = el('p', '', 'instrucao');
        aviso.setAttribute('role', 'status');
        const turnos = criarAvisosTurno(() => agir('encerrar'));

        function ativo() {
            return estado && estado.turno === estado.voce && estado.vencedor === null && !ocupado;
        }
        function botao(texto, acao, habilitado = true, classe = 'btn pequeno') {
            const b = el('button', texto, classe);
            b.type = 'button'; b.disabled = !habilitado;
            b.addEventListener('click', acao);
            return b;
        }
        function agir(tipo, uid, valor) {
            if (!ativo()) return;
            const pedidoSessao = sessao;
            ocupado = true;
            escolha.close();
            render();
            socket.timeout(10000).emit('partida:acao', { tipo, uid, escolha: valor, revisao: estado.revisao, ...(estado.cooperativo ? { alvo: alvoSelecionado } : {}) }, (err, res) => {
                if (!estado || pedidoSessao !== sessao) return;
                ocupado = false;
                aviso.textContent = err ? 'Não foi possível confirmar a ação. Sincronizando a mesa…' : res.erro || '';
                if (err) socket.emit('partida:sincronizar');
                render();
                if (res && res.pergunta) {
                    escolha.replaceChildren(el('h2', res.pergunta.titulo));
                    const opcoes = el('div', undefined, 'escolha-opcoes');
                    for (const o of res.pergunta.opcoes) opcoes.append(botao(o.rotulo, () => agir(tipo, uid, o.valor)));
                    escolha.append(opcoes, botao('Cancelar', () => escolha.close()));
                    escolha.showModal();
                }
            });
        }
        function selecionar(uid) {
            selecionada = uid;
            descarte.close();
            render();
            if (window.matchMedia('(max-width: 1000px)').matches) {
                mesa.querySelector('.detalhe-online').scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
            }
        }
        function arte(base) {
            const caixa = el('div', undefined, 'c-arte');
            const inicial = () => caixa.append(el('span', (base.nome || '?').charAt(0).toUpperCase(), 'inicial'));
            if (!base.imagem) { inicial(); return caixa; }
            const img = document.createElement('img');
            const origem = typeof API === 'string' && API ? API + '/' : location.origin + '/';
            try { img.src = new URL(base.imagem, origem).href; }
            catch { inicial(); return caixa; }
            img.alt = ''; img.loading = 'lazy';
            img.addEventListener('error', () => { img.remove(); inicial(); }, { once: true });
            caixa.append(img);
            return caixa;
        }
        function stats(c, grande = false) {
            const dono = estado.jogadores.findIndex(j => j.campo.some(x => x.uid === c.uid));
            const alvo = dono >= 0 ? (dono === estado.voce && Motor.adversarios(estado, dono).includes(alvoSelecionado) ? alvoSelecionado : Motor.indiceOponente(estado, dono)) : -1;
            const ataque = dono >= 0 ? Motor.ataqueTotal(c, estado.jogadores[alvo]?.campo[0]?.base, estado) : c.base.ataque;
            const n = el('div', undefined, 'c-stats' + (grande ? ' grande' : ''));
            n.append(el('span', `ATQ ${ataque}`, 'd'), el('span', `DEF ${c.defesa}`, 'v'));
            return n;
        }
        function selo(d) {
            return el('span', d.tipo === 'ativa' ? '⚡ Ativa' : d.tipo === 'passiva' ? '● Passiva' : 'Sem habilidade', 'tipo-hab ' + d.tipo);
        }
        function etiquetas(c) {
            const linha = el('div', undefined, 'etqs');
            const efeitos = { veneno: 'Envenenada', queimadura: 'Pegando fogo', paralisia: 'Paralisada', confusao: 'Confusa', zumbi: 'Zumbi', torcida: 'Torcida ×2', dino: 'Bônus do Dino', copia: 'Habilidade copiada' };
            for (const k of Object.keys(efeitos)) if (c.st[k]) linha.append(el('span', efeitos[k], 'etq ' + (['torcida', 'dino', 'copia'].includes(k) ? 'bom' : 'ruim')));
            if (c.rec) linha.append(el('span', 'Recarga: ' + c.rec, 'etq'));
            if (c.habilidade?.anulada || /peixes/.test(c.habilidade?.motivo || '')) linha.append(el('span', /peixes/.test(c.habilidade.motivo) ? 'Peixe' : 'Habilidade anulada', 'etq ruim'));
            return linha;
        }
        function localizar() {
            for (let dono = 0; dono < estado.jogadores.length; dono++) for (const zona of ['mao', 'campo', 'apoio', 'descarte']) {
                for (const c of estado.jogadores[dono][zona]) {
                    if (c.uid === selecionada) return { c, dono, zona };
                    for (const eq of c.equip) if (eq.uid === selecionada) return { c: eq, dono, zona: 'equip' };
                }
            }
            return null;
        }
        function detalhe() {
            const painel = el('div', undefined, 'painel detalhe-online');
            const encontrada = localizar();
            if (!encontrada) {
                painel.append(el('p', 'Clique em uma carta para ler a descrição completa e ver o que você pode fazer com ela.', 'painel-vazio'));
                return painel;
            }
            const { c, dono, zona } = encontrada, d = Motor.descricao(c.base);
            const lugares = { mao: 'na mão', campo: 'em batalha', apoio: 'em apoio', equip: 'equipada', descarte: 'no descarte' };
            painel.dataset.elemento = Motor.norm(c.base.elemento) || 'neutro';
            painel.append(el('p', `${c.base.codigo || 'Carta #' + c.base.numero} · ${lugares[zona]}${dono !== estado.voce ? ' · de ' + estado.jogadores[dono].nome : ''}`, 'codigo'), el('h3', c.base.nome));
            const chips = el('div', undefined, 'chips');
            for (const v of [c.base.classe, c.base.elemento, c.base.universo, c.base.origem].filter(Boolean)) chips.append(el('span', v, 'chip'));
            painel.append(chips, stats(c, true), etiquetas(c));
            if (zona === 'campo') painel.append(el('p', `Defesa máxima: ${c.defesaMax}`, 'suave'));
            if (c.equip.length) painel.append(el('p', 'Equipado: ' + c.equip.map(e => e.base.nome).join(', '), 'nota'));
            const habilidade = el('div', undefined, 'hab-box ' + d.tipo);
            const cab = el('div', undefined, 'hab-cab');
            cab.append(el('span', 'Habilidade', 'titulo-hab'), selo(d));
            habilidade.append(cab, el('p', d.texto || 'Esta carta não tem habilidade adicional.', 'habilidade'));
            if (d.detalhe) habilidade.append(el('p', 'Como funciona: ' + d.detalhe, 'hab-detalhe'));
            const sua = dono === estado.voce;
            const pode = ativo() && sua && estado.acoes > 0;
            if (sua && d.tipo === 'ativa' && zona !== 'descarte') {
                const h = c.habilidade || {};
                habilidade.append(botao('⚡ ' + (d.botao || 'Executar habilidade'), () => agir('habilidade', c.uid), pode && h.disponivel, 'btn habilidade-btn'));
                if (h.motivo) habilidade.append(el('p', h.motivo, 'nota'));
            } else if (d.tipo === 'passiva') habilidade.append(el('p', c.habilidade?.anulada ? c.habilidade.motivo : d.semEfeito ? 'Já está refletida nos atributos da carta.' : 'Funciona sozinha: o jogo aplica quando for preciso.', 'nota'));
            painel.append(habilidade);
            const acoes = el('div', undefined, 'acoes-painel');
            if (sua && zona === 'mao') {
                const cl = Motor.classeDe(c);
                if (Motor.ehCriatura(c)) acoes.append(botao('Colocar em batalha', () => agir('invocar', c.uid), pode, 'btn primario'));
                if (cl === 'auxiliar') acoes.append(botao('Colocar em apoio', () => agir('apoio', c.uid), pode, 'btn primario'));
                if (['arma', 'item'].includes(cl) && !Motor.consumivel(c)) acoes.append(botao('Equipar', () => agir('equipar', c.uid), pode, 'btn primario'));
            }
            if (sua && zona === 'campo') {
                const alvo = estado.jogadores[alvoSelecionado ?? Motor.indiceOponente(estado, estado.voce)]?.campo[0];
                const dano = alvo ? Motor.ataqueTotal(c, alvo.base, estado) : null;
                const nomeAlvo = estado.cooperativo && alvo ? ` · ${estado.jogadores[alvoSelecionado].nome}` : '';
                acoes.append(botao('Atacar criatura inimiga' + nomeAlvo + (alvo ? ` · ${dano} de dano` : ''), () => agir('atacar'), pode && Boolean(alvo), 'btn primario'));
                if (!alvo) painel.append(el('p', 'O alvo selecionado não tem criatura em batalha para atacar.', 'nota'));
            }
            if (acoes.childNodes.length) painel.append(acoes);
            if (!ativo() && estado.vencedor === null) painel.append(el('p', 'Aguarde seu turno para jogar. Você pode continuar consultando as cartas.', 'nota'));
            return painel;
        }
        function carta(c) {
            const b = botao('', () => selecionar(c.uid), true, 'c carta-online' + (c.uid === selecionada ? ' selecionada' : ''));
            b.dataset.elemento = Motor.norm(c.base.elemento) || 'neutro';
            b.setAttribute('aria-label', c.base.nome);
            b.setAttribute('aria-pressed', String(c.uid === selecionada));
            const topo = el('div', undefined, 'c-topo');
            topo.append(el('span', c.base.classe, 'classe'), el('span', c.base.elemento || ''));
            const d = Motor.descricao(c.base);
            b.append(topo, arte(c.base), el('p', c.base.nome, 'c-nome'), stats(c), el('p', d.texto, 'c-desc'), selo(d), etiquetas(c));
            return b;
        }
        function zona(titulo, cartas, { limite, dica = '', apoio = false } = {}) {
            const s = el('section', undefined, 'fileira-wrap' + (apoio ? ' apoio' : ''));
            const h = el('h4', titulo + (limite === undefined ? ` (${cartas.length})` : ` (${cartas.length}/${limite})`));
            if (dica) h.append(el('span', ' · ' + dica, 'dica-fileira'));
            s.append(h);
            const lista = el('div', undefined, 'fileira cartas-online');
            for (const c of cartas) {
                const grupo = el('div', undefined, 'c-wrap');
                grupo.append(carta(c));
                if (c.equip.length) {
                    const equips = el('div', undefined, 'equips');
                    for (const eq of c.equip) {
                        const b = botao('+ ' + eq.base.nome, () => selecionar(eq.uid), true, 'equip' + (eq.uid === selecionada ? ' selecionada' : ''));
                        b.dataset.elemento = Motor.norm(eq.base.elemento) || 'neutro';
                        equips.append(b);
                    }
                    grupo.append(equips);
                }
                lista.append(grupo);
            }
            for (let i = cartas.length; i < (limite || 0); i++) lista.append(el('div', 'vazio', 'slot-vazio'));
            if (!cartas.length && limite === undefined) lista.append(el('p', 'Nenhuma carta.', 'mao-escondida'));
            s.append(lista);
            return s;
        }
        function abrirDescarte(i) {
            const j = estado.jogadores[i];
            descarte.replaceChildren(el('h2', `Descarte de ${j.nome}`), zona('Cartas descartadas', j.descarte), botao('Fechar', () => descarte.close()));
            descarte.showModal();
        }
        function lado(i) {
            const j = estado.jogadores[i], sua = i === estado.voce;
            const aliada = estado.equipes[i] === estado.equipes[estado.voce];
            const n = el('section', undefined, 'lado lado-online' + (sua ? ' lado-ativo' : '') + (j.eliminado ? ' lado-eliminado' : ''));
            if (estado.cooperativo && !sua) n.classList.add('lado-publico');
            if (estado.cooperativo && !aliada && i === alvoSelecionado) n.classList.add('lado-alvo');
            n.setAttribute('aria-label', sua ? 'Seu lado da mesa' : (aliada ? 'Campo aliado: ' : 'Campo adversário: ') + j.nome);
            const cab = el('div', undefined, 'cab'), quem = el('div', undefined, 'quem');
            quem.append(el('strong', j.nome));
            if (j.eliminado) quem.append(el('span', 'Eliminado', 'etq ruim'));
            else if (j.maquina) quem.append(el('span', '4 ações', 'etq'));
            if (estado.cooperativo && !aliada && i === alvoSelecionado && !j.eliminado) quem.append(el('span', 'Alvo selecionado', 'etq alvo-selecionado'));
            if (i === estado.turno && estado.vencedor === null) quem.append(el('span', sua ? 'Sua vez' : aliada ? 'Vez do aliado' : j.maquina ? 'Vez da máquina' : 'Vez do adversário', 'selo-vez'));
            const derrotados = el('div', undefined, 'derrotados');
            const pips = el('div', undefined, 'pips');
            pips.setAttribute('aria-hidden', 'true');
            for (let k = 0; k < Motor.REGRAS.campeoesParaVencer; k++) pips.append(el('span', undefined, 'pip' + (k < j.derrotados ? ' cheio' : '')));
            derrotados.append(el('span', 'Campeões derrotados'), pips, el('strong', `${j.derrotados}/${Motor.REGRAS.campeoesParaVencer}`));
            const pilhas = el('div', undefined, 'pilhas');
            pilhas.append(el('span', `Mão: ${j.maoTotal}`), el('span', `Baralho: ${j.baralhoTotal}`), botao(`Descarte: ${j.descarte.length}`, () => abrirDescarte(i), true, ''));
            cab.append(quem, derrotados, pilhas);
            n.append(cab, zona('Em batalha', j.campo, { limite: Motor.REGRAS.maxCampo, dica: 'campeão ou besta' }), zona('Apoio', j.apoio, { limite: Motor.REGRAS.maxApoio, dica: 'auxiliares', apoio: true }));
            if (sua) n.append(zona('Sua mão', j.mao));
            else n.append(el('p', `Mão ${aliada ? 'do aliado' : 'do adversário'} escondida (${j.maoTotal} cartas).`, 'mao-escondida'));
            return n;
        }
        function render() {
            if (!estado) return;
            mesa.hidden = false;
            const terminou = estado.vencedor !== null;
            const tabuleiro = el('div', undefined, 'mesa');
            const barra = el('div', undefined, 'barra');
            const info = el('div', undefined, 'turno-info');
            const vencedor = estado.vencedor === -1 ? 'Empate!' : terminou ? (estado.cooperativo ? estado.vencedor === 0 ? 'A equipe venceu!' : 'As máquinas venceram!' : estado.jogadores[estado.vencedor].nome + ' venceu!') : '';
            info.append(el('strong', terminou ? vencedor : `Turno ${estado.numTurno} · vez de ${estado.jogadores[estado.turno].nome}`));
            const acoes = el('span', undefined, 'acoes-texto');
            acoes.append(el('span', 'Ações:'));
            for (let i = 0; i < estado.acoesPorTurno; i++) acoes.append(el('span', undefined, 'acao-pip' + (i >= estado.acoes ? ' gasta' : '')));
            acoes.append(el('span', `${estado.acoes}/${estado.acoesPorTurno}`));
            info.append(acoes, el('small', `${estado.tamanhoBaralho} cartas únicas · ${estado.tamanhoBaralho / 2} por ${estado.cooperativo ? 'equipe, divididas entre os integrantes' : 'lado'}`, 'suave'));
            const controles = el('div', undefined, 'barra-botoes');
            controles.append(botao('Comprar carta', () => agir('comprar'), ativo() && estado.acoes > 0, 'btn primario acao-compra'), botao('Encerrar turno', () => agir('encerrar'), ativo(), 'btn' + (ativo() && estado.acoes === 0 ? ' primario destaque' : '')));
            const instrucao = aviso.textContent || (terminou ? 'Partida encerrada. Você pode consultar o tabuleiro ou sair para preparar outra partida.' : ativo() ? estado.acoes === 0 ? 'Suas ações acabaram. Encerre o turno para passar a vez.' : 'Selecione uma carta para ver sua habilidade e as ações disponíveis.' : 'Aguarde o adversário. Sua mão continua visível somente para você.');
            aviso.className = 'instrucao' + (aviso.textContent ? ' erro' : '');
            const dica = el('p', instrucao, aviso.className);
            dica.setAttribute('role', 'status');
            barra.append(info, controles, dica);
            if (estado.pandora) barra.append(el('p', 'Caixa de Pandora: criaturas em batalha sofrem dano por turno.', 'etq ruim'));
            if (estado.cooperativo) {
                const rivais = estado.jogadores.map((j, i) => i).filter(i => estado.equipes[i] !== estado.equipes[estado.voce]);
                const maquinas = el('section', undefined, 'equipe-online maquinas-online');
                maquinas.setAttribute('aria-label', 'Máquinas adversárias');
                for (const i of rivais) maquinas.append(lado(i));
                const alvos = el('div', undefined, 'alvo-coop');
                const label = el('label', 'Máquina alvo');
                const select = document.createElement('select');
                select.setAttribute('aria-label', 'Máquina alvo');
                for (const i of rivais) {
                    const option = new Option(estado.jogadores[i].nome + (estado.jogadores[i].eliminado ? ' · derrotada' : ''), String(i));
                    option.disabled = estado.jogadores[i].eliminado;
                    select.add(option);
                }
                select.value = String(alvoSelecionado);
                select.disabled = !ativo();
                select.addEventListener('change', () => { alvoSelecionado = Number(select.value); render(); });
                label.append(select); alvos.append(label); barra.append(alvos);
                barra.append(el('p', estado.jogadores[estado.voce].eliminado ? 'Você foi eliminado. Acompanhe e torça pelos aliados que continuam em jogo.' : 'Mão e campo individuais. Combine os ataques com os aliados; apenas você pode jogar suas cartas.', 'nota-equipe'));
                const aliados = el('section', undefined, 'aliados-online');
                aliados.setAttribute('aria-label', 'Seus aliados');
                for (let i = 0; i < estado.jogadores.length; i++) if (i !== estado.voce && estado.equipes[i] === estado.equipes[estado.voce]) {
                    const detalhe = document.createElement('details');
                    detalhe.open = i === estado.turno;
                    const j = estado.jogadores[i];
                    detalhe.append(el('summary', `${j.nome} · ${j.eliminado ? 'eliminado' : i === estado.turno ? 'jogando agora' : 'aliado'} · ${j.derrotados}/3 campeões derrotados`), lado(i));
                    aliados.append(detalhe);
                }
                tabuleiro.append(maquinas, barra, aliados, lado(estado.voce));
            } else tabuleiro.append(lado(1 - estado.voce), barra, lado(estado.voce));
            const lateral = el('aside', undefined, 'lateral');
            lateral.append(detalhe());
            if (estado.cooperativo) {
                const ordem = el('div', undefined, 'painel ordem-turnos');
                ordem.append(el('h3', 'Ordem dos turnos'));
                const lista = el('ol');
                for (const i of estado.ordemTurnos) {
                    const j = estado.jogadores[i];
                    const item = el('li', j.nome + (i === estado.voce ? ' (você)' : '') + (j.eliminado ? ' · eliminado' : i === estado.turno ? ' · jogando' : '') );
                    if (i === estado.turno) item.className = 'turno-atual';
                    lista.append(item);
                }
                ordem.append(lista); lateral.append(ordem);
            }
            const registro = el('ol', undefined, 'log registro-online');
            for (const linha of estado.log.slice(-40).reverse()) registro.append(el('li', linha));
            const painelRegistro = el('div', undefined, 'painel');
            painelRegistro.append(el('h3', 'Registro da partida'), registro);
            lateral.append(painelRegistro, botao('Sair da partida', () => {
                if (estado.vencedor !== null || window.confirm('Sair encerra a partida para todos. Deseja continuar?')) aoSair();
            }, true, 'btn pequeno'));
            mesa.replaceChildren(tabuleiro, lateral);
            turnos.atualizar({ acoes: estado.acoes, suaVez: estado.turno === estado.voce, numTurno: estado.numTurno, vencedor: estado.vencedor, ocupado });
        }
        socket.on('partida:estado', proximo => {
            if (estado && proximo.numTurno > estado.numTurno) {
                const nome = estado.jogadores[estado.turno].nome;
                turnos.notificar(`${nome} encerrou o turno. Agora é a vez de ${proximo.jogadores[proximo.turno].nome}.`);
            }
            if (estado && proximo.revisao !== estado.revisao) { escolha.close(); descarte.close(); }
            if (!estado || estado.numTurno !== proximo.numTurno) alvoSelecionado = null;
            estado = proximo;
            const alvos = Motor.adversarios(estado, estado.voce);
            if (!alvos.includes(alvoSelecionado)) alvoSelecionado = alvos.includes(estado.alvo) ? estado.alvo : alvos[0] ?? null;
            aoMostrar();
            render();
        });
        return { limpar() { sessao++; alvoSelecionado = null; estado = null; ocupado = false; selecionada = null; mesa.hidden = true; escolha.close(); descarte.close(); turnos.limpar(); aviso.textContent = ''; } };
    };
})();
