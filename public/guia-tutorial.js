// Orientação visual da Partida TUTORIAL. Não altera regras ou ações da partida.
(function () {
    'use strict';
    window.criarSetasTutorial = function ({ guia, ajuda }) {
        let alvo = null, chave = null, timer, quadro, lembrar = false, aguardando = false;
        function criar(rotulo) {
            const seta = document.createElement('div');
            seta.className = 'seta-tutorial';
            seta.setAttribute('popover', 'manual');
            seta.setAttribute('aria-hidden', 'true');
            seta.innerHTML = '<span class="seta-legenda"></span><span class="seta-corpo"><svg viewBox="0 0 40 48" focusable="false"><path d="M14 3h12v23h10L20 44 4 26h10z"/></svg></span>';
            seta.firstChild.textContent = rotulo;
            document.body.append(seta);
            return seta;
        }
        const passo = criar('Clique aqui'), lembrete = criar('Precisa de ajuda?');
        function esconder(seta) { if (seta.matches(':popover-open')) seta.hidePopover(); }
        function posicionar(seta, elemento) {
            if (!elemento?.isConnected || !elemento.getClientRects().length) { esconder(seta); return; }
            const r = elemento.getBoundingClientRect();
            let limite = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
            for (let n = elemento.parentElement; n && n !== document.body; n = n.parentElement) {
                const css = getComputedStyle(n), caixa = n.getBoundingClientRect();
                if (/(auto|scroll|hidden|clip)/.test(css.overflowX)) { limite.left = Math.max(limite.left, caixa.left); limite.right = Math.min(limite.right, caixa.right); }
                if (/(auto|scroll|hidden|clip)/.test(css.overflowY)) { limite.top = Math.max(limite.top, caixa.top); limite.bottom = Math.min(limite.bottom, caixa.bottom); }
            }
            if (!elemento.closest('dialog') && !guia.contains(elemento)) limite.top = Math.max(limite.top, guia.getBoundingClientRect().bottom);
            const esquerda = Math.max(r.left, limite.left), direita = Math.min(r.right, limite.right), topo = Math.max(r.top, limite.top), baixo = Math.min(r.bottom, limite.bottom);
            if (direita - esquerda < 12 || baixo - topo < 12) { esconder(seta); return; }
            const x = (esquerda + direita) / 2, y = (topo + baixo) / 2, largura = 100, altura = 78, folga = 10;
            const opcoes = [
                { direcao: 'baixo', x: x - largura / 2, y: topo - altura - folga },
                { direcao: 'cima', x: x - largura / 2, y: baixo + folga },
                { direcao: 'direita', x: esquerda - largura - folga, y: y - altura / 2 },
                { direcao: 'esquerda', x: direita + folga, y: y - altura / 2 }
            ];
            const pos = opcoes.find(p => p.y >= 8 && p.y + altura <= innerHeight - 8 && p.x >= 4 && p.x + largura <= innerWidth - 4)
                || opcoes.find(p => p.y >= 8 && p.y + altura <= innerHeight - 8);
            if (!pos) { esconder(seta); return; }
            seta.dataset.direcao = pos.direcao;
            seta.style.left = Math.max(4, Math.min(innerWidth - largura - 4, pos.x)) + 'px';
            seta.style.top = pos.y + 'px';
            if (!seta.matches(':popover-open')) seta.showPopover();
        }
        function desenhar() {
            quadro = null;
            posicionar(passo, alvo);
            ajuda.classList.toggle('precisa-ajuda', lembrar);
            if (lembrar && aguardando) posicionar(lembrete, ajuda); else esconder(lembrete);
        }
        function agendar() { if (!quadro) quadro = requestAnimationFrame(desenhar); }
        window.addEventListener('scroll', agendar, { capture: true, passive: true });
        window.addEventListener('resize', agendar);
        const tamanho = new ResizeObserver(() => {
            document.body.style.setProperty('--altura-guia', guia.getBoundingClientRect().height + 'px');
            agendar();
        });
        tamanho.observe(guia);
        function iniciarEspera() {
            clearTimeout(timer); lembrar = false;
            if (aguardando) timer = setTimeout(() => { lembrar = true; agendar(); }, 15000);
        }
        return {
            atualizar(elemento, estado) {
                alvo = elemento;
                if (chave !== estado.chave || aguardando !== estado.aguardando) {
                    chave = estado.chave; aguardando = estado.aguardando; iniciarEspera();
                }
                agendar();
            },
            ajudar() { iniciarEspera(); agendar(); },
            limpar() { clearTimeout(timer); chave = null; alvo = null; lembrar = false; aguardando = false; agendar(); }
        };
    };
})();
