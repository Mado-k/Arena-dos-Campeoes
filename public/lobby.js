// Lobby compartilhado pelas páginas de multiplayer e co-op.
// O modo vem do atributo data-modo do <body>.
(function () {
    const modo = document.body.dataset.modo;
    const $ = (id) => document.getElementById(id);

    const apelido = $('apelido');
    const codigo = $('codigo');
    const status = $('status');
    const painelEntrada = $('entrada');
    const painelSala = $('sala');

    let socket = null;
    let salaAtual = null;
    let mesa = null;

    function el(tag, classe, texto) {
        const e = document.createElement(tag);
        if (classe) e.className = classe;
        if (texto !== undefined && texto !== null) e.textContent = texto;
        return e;
    }

    function limpar(texto) {
        return (texto || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    }

    function aviso(texto, tipo) {
        status.textContent = texto;
        status.className = 'status' + (tipo ? ` ${tipo}` : '');
    }

    // apelido lembrado e código vindo do link de convite (?sala=ABCDE)
    try { apelido.value = localStorage.getItem('apelido') || ''; } catch { /* ignora */ }
    const convite = new URLSearchParams(location.search).get('sala');
    if (convite) codigo.value = limpar(convite);

    // ---------- conexão ----------
    function carregarScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error('Não foi possível carregar o Socket.IO do servidor.'));
            document.head.append(s);
        });
    }

    async function conectar() {
        if (socket) return socket;

        // o cliente é carregado do próprio servidor, então as versões sempre combinam
        await carregarScript(`${API}/socket.io/socket.io.js`);
        socket = io(API || location.origin);

        mesa = criarMesaOnline(socket);
        socket.on('sala', mostrarSala);
        socket.on('partida:encerrada', dados => { mesa.limpar(); aviso(dados.motivo, 'erro'); $('sala-aviso').textContent = dados.motivo; });
        socket.on('disconnect', () => {
            if (salaAtual) voltarParaEntrada('A conexão com o servidor caiu. Entre em uma sala de novo.', 'erro');
        });

        await new Promise((resolve, reject) => {
            const limite = setTimeout(() => reject(new Error('tempo esgotado')), 6000);
            socket.once('connect', () => { clearTimeout(limite); resolve(); });
            socket.once('connect_error', (err) => { clearTimeout(limite); reject(err); });
        });
        return socket;
    }

    async function pedir(evento, dados) {
        try {
            await conectar();
        } catch (err) {
            console.error(err);
            if (socket) { socket.close(); socket = null; }
            aviso('Não foi possível conectar ao servidor. Confira o endereço da API e se o servidor está acessível.', 'erro');
            return null;
        }
        return new Promise(resolve => socket.timeout(15000).emit(evento, dados, (err, res) => resolve(err ? { erro: 'O servidor não respondeu. Tente novamente.' } : res)));
    }

    // ---------- entrar / criar ----------
    async function abrirSala(evento, extra) {
        const nome = apelido.value.trim();
        if (!nome) {
            aviso('Escolha um apelido primeiro.', 'erro');
            apelido.focus();
            return;
        }
        try { localStorage.setItem('apelido', nome); } catch { /* ignora */ }

        aviso('Conectando…');
        const resp = await pedir(evento, { ...extra, modo, nome });
        if (!resp) return;
        if (!resp.ok) { aviso(resp.erro, 'erro'); return; }

        aviso('');
        mostrarSala(resp.sala);
    }

    $('criar').addEventListener('click', () => abrirSala('sala:criar', {}));

    function tentarEntrar() {
        const c = limpar(codigo.value);
        if (c.length !== 5) {
            aviso('O código da sala tem 5 letras ou números.', 'erro');
            codigo.focus();
            return;
        }
        abrirSala('sala:entrar', { codigo: c });
    }
    $('entrar').addEventListener('click', tentarEntrar);
    codigo.addEventListener('keydown', (e) => { if (e.key === 'Enter') tentarEntrar(); });
    codigo.addEventListener('input', () => { codigo.value = limpar(codigo.value); });

    // ---------- sala ----------
    function mostrarSala(sala) {
        salaAtual = sala;
        painelEntrada.hidden = true;
        painelSala.hidden = false;
        $('sala-codigo').textContent = sala.codigo;

        const lista = $('jogadores');
        lista.replaceChildren();

        for (const j of sala.jogadores) {
            const li = el('li', 'jogador');
            const nome = el('span', 'nome', j.nome);
            if (j.id === socket.id) nome.append(el('small', null, '(você)'));
            if (j.id === sala.anfitriao) nome.append(el('small', null, 'anfitrião'));
            li.append(
                el('span', 'avatar', j.nome.charAt(0).toUpperCase()),
                nome,
                el('span', 'estado' + (j.pronto ? ' pronto' : ''), j.pronto ? 'Pronto' : 'Aguardando')
            );
            lista.append(li);
        }
        for (let i = sala.jogadores.length; i < sala.max; i++) {
            const li = el('li', 'jogador slot-vazio');
            li.append(el('span', 'nome', 'Aguardando jogador…'));
            lista.append(li);
        }

        const eu = sala.jogadores.find((j) => j.id === socket.id);
        $('pronto').textContent = eu && eu.pronto ? 'Cancelar' : 'Estou pronto';

        const total = sala.jogadores.length;
        const prontos = sala.jogadores.filter((j) => j.pronto).length;
        let texto;
        if (total < sala.min) texto = `Aguardando jogadores (${total} de ${sala.min} no mínimo).`;
        else if (sala.emPartida) texto = 'Partida em andamento. A mesa está abaixo.';
        else if (sala.iniciando) texto = 'Carregando as cartas…';
        else if (prontos === total) texto = 'Todos prontos! O anfitrião pode iniciar a partida.';
        else texto = `${prontos} de ${total} jogadores prontos.`;
        $('sala-aviso').textContent = texto;
        $('iniciar').disabled = sala.anfitriao !== socket.id || total < sala.min || prontos !== total || sala.iniciando || sala.emPartida;
        $('pronto').disabled = sala.iniciando || sala.emPartida;
    }

    function voltarParaEntrada(texto, tipo) {
        salaAtual = null;
        if (mesa) mesa.limpar();
        painelSala.hidden = true;
        painelEntrada.hidden = false;
        aviso(texto || '', tipo);
    }

    $('iniciar').addEventListener('click', async () => {
        $('iniciar').disabled = true;
        const res = await pedir('partida:iniciar', {});
        if (res && res.erro) $('sala-aviso').textContent = res.erro;
    });

    $('pronto').addEventListener('click', () => {
        if (!salaAtual) return;
        const eu = salaAtual.jogadores.find((j) => j.id === socket.id);
        socket.emit('sala:pronto', !(eu && eu.pronto));
    });

    $('sair').addEventListener('click', () => {
        if (socket) socket.emit('sala:sair');
        voltarParaEntrada('');
    });

    $('copiar').addEventListener('click', async () => {
        if (!salaAtual) return;
        const botao = $('copiar');
        const link = `${location.origin}${location.pathname}?sala=${salaAtual.codigo}`;
        try {
            await navigator.clipboard.writeText(link);
            botao.textContent = 'Link copiado!';
        } catch {
            window.prompt('Copie o link do convite:', link);
        }
        setTimeout(() => { botao.textContent = 'Copiar convite'; }, 1800);
    });
})();
