// Tela online: renderiza somente a visão privada enviada pelo servidor.
(function () {
    'use strict';
    const el = (tag, texto, classe) => {
        const n = document.createElement(tag);
        if (texto !== undefined) n.textContent = texto;
        if (classe) n.className = classe;
        return n;
    };
    window.criarMesaOnline = function (socket) {
        const mesa = el('section', undefined, 'mesa-online');
        mesa.hidden = true;
        document.querySelector('main').append(mesa);
        const escolha = document.createElement('dialog');
        escolha.className = 'escolha-online';
        document.body.append(escolha);
        let estado = null, ocupado = false, selecionada = null;
        const aviso = el('p');
        aviso.setAttribute('role', 'status');

        function ativo() {
            return estado && estado.turno === estado.voce && estado.vencedor === null && !ocupado;
        }
        function botao(texto, acao, habilitado = true) {
            const b = el('button', texto, 'btn pequeno');
            b.type = 'button'; b.disabled = !habilitado;
            b.addEventListener('click', acao);
            return b;
        }
        function agir(tipo, uid, valor) {
            if (!ativo()) return;
            ocupado = true;
            escolha.close();
            render();
            socket.timeout(10000).emit('partida:acao', { tipo, uid, escolha: valor, revisao: estado.revisao }, (err, res) => {
                ocupado = false;
                aviso.textContent = err ? 'Não foi possível confirmar a ação. Sincronizando a mesa…' : res.erro || '';
                if (err) socket.emit('partida:sincronizar');
                render();
                if (res && res.pergunta) {
                    escolha.replaceChildren(el('h2', res.pergunta.titulo));
                    for (const o of res.pergunta.opcoes) escolha.append(botao(o.rotulo, () => agir(tipo, uid, o.valor)));
                    escolha.append(botao('Cancelar', () => escolha.close()));
                    escolha.showModal();
                }
            });
        }
        function detalhe() {
            if (!selecionada) return null;
            let encontrada;
            for (let dono = 0; dono < 2; dono++) for (const zona of ['mao', 'campo', 'apoio', 'descarte']) {
                for (const c of estado.jogadores[dono][zona]) {
                    if (c.uid === selecionada) encontrada = { c, dono, zona };
                    for (const eq of c.equip) if (eq.uid === selecionada) encontrada = { c: eq, dono, zona: 'equip' };
                }
            }
            if (!encontrada) return null;
            const { c, dono, zona } = encontrada, d = Motor.descricao(c.base);
            const painel = el('aside', undefined, 'detalhe-online');
            painel.append(el('h2', c.base.nome), el('p', d.texto || 'Sem habilidade adicional.'), el('p', d.detalhe));
            const sua = dono === estado.voce;
            const pode = ativo() && sua && estado.acoes > 0;
            if (sua && zona === 'mao') {
                const cl = Motor.classeDe(c);
                if (Motor.ehCriatura(c)) painel.append(botao('Colocar em batalha', () => agir('invocar', c.uid), pode));
                if (cl === 'auxiliar') painel.append(botao('Colocar em apoio', () => agir('apoio', c.uid), pode));
                if (['arma', 'item'].includes(cl) && !Motor.consumivel(c)) painel.append(botao('Equipar', () => agir('equipar', c.uid), pode));
            }
            if (sua && zona === 'campo') painel.append(botao('Atacar criatura inimiga', () => agir('atacar'), pode));
            if (sua && d.tipo === 'ativa') {
                const h = c.habilidade || {};
                painel.append(botao('⚡ ' + (d.botao || 'Executar habilidade'), () => agir('habilidade', c.uid), pode && h.disponivel));
                if (h.motivo) painel.append(el('p', h.motivo));
            }
            if (d.tipo === 'passiva') painel.append(el('p', 'Habilidade passiva: aplicada automaticamente.'));
            return painel;
        }
        function carta(c) {
            const b = botao('', () => { selecionada = c.uid; render(); });
            b.className = 'carta-online' + (c.uid === selecionada ? ' selecionada' : '');
            const d = Motor.descricao(c.base);
            const dono = estado.jogadores.findIndex(j => j.campo.some(x => x.uid === c.uid));
            const ataque = dono >= 0 ? Motor.ataqueTotal(c, estado.jogadores[1 - dono].campo[0]?.base, estado) : c.base.ataque;
            b.append(el('strong', c.base.nome), el('span', c.base.classe + (c.base.elemento ? ' · ' + c.base.elemento : '')),
                el('span', `ATQ ${ataque} · DEF ${c.defesa}`), el('span', d.texto));
            const efeitos = { veneno: 'Envenenada', queimadura: 'Pegando fogo', paralisia: 'Paralisada', confusao: 'Confusa', zumbi: 'Zumbi', torcida: 'Torcida ×2', dino: 'Bônus do Dino', copia: 'Habilidade copiada' };
            const etiquetas = Object.keys(efeitos).filter(k => c.st[k]).map(k => efeitos[k]);
            if (c.rec) etiquetas.push('Recarga: ' + c.rec);
            if (etiquetas.length) b.append(el('span', etiquetas.join(' · '), 'estado-online'));
            return b;
        }
        function zona(titulo, cartas) {
            const s = el('section');
            s.append(el('h3', titulo));
            const lista = el('div', undefined, 'cartas-online');
            if (!cartas.length) lista.append(el('p', 'Vazio'));
            for (const c of cartas) {
                const grupo = el('div');
                grupo.append(carta(c));
                for (const eq of c.equip) grupo.append(carta(eq));
                lista.append(grupo);
            }
            s.append(lista);
            return s;
        }
        function render() {
            if (!estado) return;
            mesa.hidden = false;
            const terminou = estado.vencedor !== null;
            const vencedor = estado.vencedor === -1 ? 'Empate!' : terminou ? estado.jogadores[estado.vencedor].nome + ' venceu!' : '';
            mesa.replaceChildren(el('h2', terminou ? vencedor : `Turno ${estado.numTurno} · ${estado.jogadores[estado.turno].nome}`));
            mesa.append(el('p', `Ações restantes: ${estado.acoes}. ${ativo() ? 'Sua vez: selecione uma carta ou compre.' : terminou ? 'Saia da sala para preparar outra partida.' : 'Aguarde o adversário.'}`));
            if (estado.cooperativo) mesa.append(el('p', 'Co-op: sua equipe compartilha a mão, o campo e duas ações por turno. As jogadas de todos são sincronizadas.'));
            mesa.append(botao('Comprar carta', () => agir('comprar'), ativo() && estado.acoes > 0), botao('Encerrar turno', () => agir('encerrar'), ativo()));
            mesa.append(aviso);
            const lados = el('div', undefined, 'lados-online');
            for (const i of [1 - estado.voce, estado.voce]) {
                const j = estado.jogadores[i], lado = el('section', undefined, 'lado-online');
                lado.append(el('h2', j.nome + (i === estado.voce ? ' · seu lado' : '')),
                    el('p', `Campeões derrotados: ${j.derrotados}/3 · Mão: ${j.maoTotal} · Baralho: ${j.baralhoTotal}`),
                    zona('Em batalha', j.campo), zona('Apoio', j.apoio));
                if (i === estado.voce) lado.append(zona('Sua mão', j.mao));
                else lado.append(el('p', 'Mão do adversário escondida.'));
                const descarte = document.createElement('details');
                descarte.append(el('summary', `Descarte (${j.descarte.length})`), zona('Cartas descartadas', j.descarte));
                lado.append(descarte); lados.append(lado);
            }
            mesa.append(lados);
            const painel = detalhe(); if (painel) mesa.append(painel);
            const registro = el('ol', undefined, 'registro-online');
            for (const linha of estado.log.slice(-15)) registro.append(el('li', linha));
            mesa.append(el('h3', 'Registro da partida'), registro);
        }
        socket.on('partida:estado', proximo => {
            if (estado && proximo.revisao !== estado.revisao) escolha.close();
            estado = proximo;
            render();
        });
        return { limpar() { estado = null; ocupado = false; selecionada = null; mesa.hidden = true; escolha.close(); aviso.textContent = ''; } };
    };
})();
