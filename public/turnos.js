// Avisos compartilhados pelas mesas offline e online.
(function () {
    'use strict';
    window.criarAvisosTurno = function (aoEncerrar) {
        const janela = document.createElement('dialog');
        janela.className = 'aviso-acoes';
        janela.setAttribute('aria-label', 'Suas ações acabaram');
        const titulo = document.createElement('h2');
        titulo.textContent = 'Suas ações acabaram';
        const texto = document.createElement('p');
        texto.textContent = 'Você usou as duas ações deste turno. Encerre o turno para continuar a partida.';
        const encerrar = document.createElement('button');
        encerrar.type = 'button';
        encerrar.className = 'btn primario acao-encerrar acoes-esgotadas';
        encerrar.textContent = 'Encerrar turno';
        encerrar.addEventListener('click', aoEncerrar);
        janela.append(titulo, texto, encerrar);
        const mensagem = document.createElement('div');
        mensagem.className = 'aviso-turno';
        mensagem.hidden = true;
        mensagem.setAttribute('role', 'status');
        mensagem.setAttribute('aria-live', 'polite');
        document.body.append(janela, mensagem);
        let ultimoAvisado = null, timer;
        return {
            atualizar({ acoes, suaVez, numTurno, vencedor, ocupado = false }) {
                const acabou = suaVez && acoes === 0 && vencedor === null;
                encerrar.disabled = ocupado;
                if (!acabou) janela.close();
                else if (!janela.open && ultimoAvisado !== numTurno) {
                    ultimoAvisado = numTurno;
                    janela.showModal();
                    encerrar.focus({preventScroll:true});
                }
            },
            notificar(texto) {
                clearTimeout(timer);
                mensagem.textContent = texto;
                mensagem.hidden = false;
                timer = setTimeout(() => { mensagem.hidden = true; }, RITMO_ARENA.avisoTurno);
            },
            limpar() {
                janela.close();
                ultimoAvisado = null;
                mensagem.hidden = true;
                clearTimeout(timer);
            }
        };
    };
})();
