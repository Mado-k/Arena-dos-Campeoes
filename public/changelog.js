// O elemento details continua funcionando caso JavaScript esteja indisponível.
document.querySelectorAll('.versao').forEach(versao => {
    const titulo = versao.querySelector('summary');
    let animacao = null, expandida = versao.open;
    titulo.addEventListener('click', evento => {
        if (!versao.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        evento.preventDefault();
        const inicio = versao.getBoundingClientRect().height;
        if (animacao) animacao.cancel();
        expandida = !expandida;
        versao.open = true;
        const fim = expandida ? versao.getBoundingClientRect().height : titulo.getBoundingClientRect().height + 2;
        versao.style.overflow = 'hidden';
        animacao = versao.animate({ height: [inicio + 'px', fim + 'px'] }, { duration: 280, easing: 'ease-in-out' });
        animacao.onfinish = () => {
            versao.open = expandida;
            versao.style.overflow = '';
            animacao = null;
        };
    });
    // Mantém o estado coerente também após alternâncias sem animação.
    versao.addEventListener('toggle', () => { if (!animacao) expandida = versao.open; });
});
