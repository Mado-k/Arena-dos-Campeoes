// Avisos compartilhados pelas mesas offline e online.
(function () {
    'use strict';
    window.criarAvisosTurno = function (aoEncerrar, { aoConfirmar = () => {}, preservarVista = acao => acao() } = {}) {
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
        const inicio=document.createElement('dialog');
        inicio.className='aviso-acoes aviso-sua-vez';inicio.setAttribute('aria-label','É a sua vez');
        const tituloInicio=document.createElement('h2');tituloInicio.textContent='É a sua vez!';
        const textoInicio=document.createElement('p'),ok=document.createElement('button');
        ok.type='button';ok.className='btn primario';ok.textContent='OK';
        inicio.append(tituloInicio,textoInicio,ok);
        inicio.addEventListener('cancel',evento=>evento.preventDefault());
        document.body.append(janela, mensagem, inicio);
        let ultimoAvisado = null, timer, turnoConfirmado=null, turnoPendente=null;
        ok.addEventListener('click',()=>preservarVista(()=>{turnoConfirmado=turnoPendente;inicio.close();aoConfirmar();}));
        return {
            atualizar({ acoes, suaVez, numTurno, vencedor, ocupado = false, nome = '', confirmarInicio = true }) {
                if(!suaVez||vencedor!==null){inicio.close();turnoPendente=null;}
                else if(!confirmarInicio){inicio.close();turnoPendente=null;turnoConfirmado=numTurno;}
                else if(acoes>0&&turnoConfirmado!==numTurno){
                    clearTimeout(timer);mensagem.hidden=true;janela.close();
                    turnoPendente=numTurno;
                    tituloInicio.textContent=nome&&nome!=='Você'?`É a sua vez, ${nome}!`:'É a sua vez!';
                    textoInicio.textContent=`Você tem ${acoes} ${acoes===1?'ação disponível':'ações disponíveis'}. Confirme para começar a jogar.`;
                    if(!inicio.open){inicio.showModal();ok.focus({preventScroll:true});}
                }
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
            aguardandoConfirmacao(){return inicio.open;},
            limpar() {
                janela.close();
                inicio.close();turnoConfirmado=null;turnoPendente=null;
                ultimoAvisado = null;
                mensagem.hidden = true;
                clearTimeout(timer);
            }
        };
    };
})();
