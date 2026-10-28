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
    const cabeca = document.querySelector('.lobby-cabeca');

    let socket = null;
    let salaAtual = null;
    let mesa = null;
    let pedidoInicio = false;
    let representantes = [];
    let carregandoRepresentantes = true;
    const seletorRepresentante = $('representante');

    async function carregarRepresentantes() {
        try {
            const r = await fetch(`${API}/cartas`, { signal: AbortSignal.timeout(10000) });
            if (!r.ok) throw new Error('Falha ao carregar representantes.');
            const lista = await r.json();
            if (!Array.isArray(lista)) throw new Error('Lista de cartas inválida.');
            representantes = lista.filter(c => Motor.norm(c.classe) === 'representante').map(Motor.normalizarCarta);
            seletorRepresentante.replaceChildren(new Option('Sem representante', ''), ...representantes.map(c => new Option(c.nome, c.codigo)));
            carregandoRepresentantes = false;
            if (salaAtual) mostrarSala(salaAtual);
        } catch {
            $('representante-descricao').textContent = 'Não foi possível carregar os representantes. Clique para tentar novamente.';
            const tentar = el('button', 'btn pequeno', 'Carregar representantes');
            tentar.type = 'button';
            tentar.onclick = () => { tentar.remove(); carregarRepresentantes(); };
            seletorRepresentante.after(tentar);
        }
    }
    carregarRepresentantes();
    seletorRepresentante.addEventListener('change', async () => {
        const res = await pedir('sala:representante', seletorRepresentante.value || null);
        if (res?.erro) $('sala-erro').textContent = res.erro;
    });

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

        mesa = criarMesaOnline(socket, {
            aoMostrar() {
                painelEntrada.hidden = true;
                painelSala.hidden = true;
                cabeca.hidden = true;
                document.querySelector('main').classList.add('em-partida');
            },
            aoSair() {
                socket.emit('sala:sair');
                voltarParaEntrada('Você saiu da partida.');
            }
        });
        socket.on('sala', mostrarSala);
        socket.on('partida:encerrada', dados => { mesa.limpar(); aviso(dados.motivo, dados.empate ? '' : 'erro'); $('sala-aviso').textContent = dados.motivo; });
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
        const prazo = evento === 'partida:iniciar' ? 30000 : 15000;
        return new Promise(resolve => socket.timeout(prazo).emit(evento, dados, (err, res) => resolve(err ? { erro: 'O servidor não confirmou o pedido a tempo. Atualize a página e tente novamente; se persistir, confira os Logs do Render.' } : res)));
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
        $('sala-erro').textContent = '';
        mostrarSala(resp.sala);
    }

    $('criar').addEventListener('click', () => abrirSala('sala:criar', { tamanhoBaralho: Number($('tamanho-baralho').value), ...(modo === 'coop' ? { quantidadeJogadores: Number($('formato-coop').value) } : {}) }));
    if (modo === 'coop') $('formato-coop').addEventListener('change', () => {
        const quatro = $('formato-coop').value === '4';
        $('tamanho-baralho').querySelector('option[value="20"]').disabled = quatro;
        if (quatro && $('tamanho-baralho').value === '20') $('tamanho-baralho').value = '40';
    });

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
        painelSala.hidden = Boolean(sala.emPartida);
        cabeca.hidden = Boolean(sala.emPartida);
        document.querySelector('main').classList.toggle('em-partida', Boolean(sala.emPartida));
        $('sala-codigo').textContent = sala.codigo;
        $('sala-baralho').textContent = modo === 'coop'
            ? `${sala.max} jogadores × ${sala.maquinas} máquina(s) · ${sala.tamanhoBaralho} cartas únicas · metade para cada equipe, divididas entre seus integrantes · mãos privadas`
            : `${sala.tamanhoBaralho} cartas no total · ${sala.tamanhoBaralho / 2} por jogador · sem repetição`;

        const lista = $('jogadores');
        lista.replaceChildren();

        for (const j of sala.jogadores) {
            const li = el('li', 'jogador');
            const nome = el('span', 'nome', j.nome);
            const rep = representantes.find(r => r.codigo === j.representante);
            nome.append(el('small', null, rep ? rep.nome : 'Sem representante'));
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
        seletorRepresentante.value = eu?.representante || '';
        seletorRepresentante.disabled = sala.iniciando || sala.emPartida || carregandoRepresentantes;
        const rep = representantes.find(r => r.codigo === eu?.representante);
        if (!carregandoRepresentantes) $('representante-descricao').textContent = rep ? Motor.descricao(rep).texto : 'Sem bônus de representante. Você pode escolher antes de ficar pronto.';
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
        $('iniciar').disabled = pedidoInicio || sala.anfitriao !== socket.id || total < sala.min || prontos !== total || sala.iniciando || sala.emPartida;
        $('pronto').disabled = sala.iniciando || sala.emPartida || carregandoRepresentantes;
    }

    function voltarParaEntrada(texto, tipo) {
        salaAtual = null;
        if (mesa) mesa.limpar();
        painelSala.hidden = true;
        painelEntrada.hidden = false;
        cabeca.hidden = false;
        document.querySelector('main').classList.remove('em-partida');
        aviso(texto || '', tipo);
    }

    $('iniciar').addEventListener('click', async () => {
        if (pedidoInicio) return;
        pedidoInicio = true;
        $('iniciar').disabled = true;
        $('sala-erro').textContent = '';
        const res = await pedir('partida:iniciar', {});
        pedidoInicio = false;
        if (res && res.erro) $('sala-erro').textContent = res.erro;
        else if (!res) $('sala-erro').textContent = 'Não foi possível conectar ao servidor. Confira sua conexão e tente novamente.';
        if (salaAtual) mostrarSala(salaAtual);
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
