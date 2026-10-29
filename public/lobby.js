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
    let conexaoPendente = null, retomando = false;
    const chaveSessao = 'arena-sessao-' + modo, chaveBackup = chaveSessao + '-ultima';
    let sessaoSalva = null, identidade = null;
    try { sessaoSalva = JSON.parse(sessionStorage.getItem(chaveSessao) || 'null'); identidade = sessaoSalva?.jogadorId; } catch { /* armazenamento indisponível */ }
    function limparSessao() {
        const anterior = sessaoSalva; sessaoSalva = null; identidade = null;
        try { sessionStorage.removeItem(chaveSessao); const ultima=JSON.parse(localStorage.getItem(chaveBackup)||'null'); if(ultima?.jogadorId===anterior?.jogadorId)localStorage.removeItem(chaveBackup); } catch { /* ignora */ }
        $('retomar-sessao').hidden=true;
    }
    function conexao(texto) { $('conexao-jogo').textContent=texto; $('conexao-jogo').hidden=!texto; }
    async function retomar() {
        if(!sessaoSalva || !socket?.connected)return;
        retomando=true;mesa?.pausar();conexao('Recuperando a partida…');
        const res=await new Promise(resolve=>socket.timeout(15000).emit('sala:retomar',{...sessaoSalva,modo},(err,r)=>resolve(err?{erro:'Não foi possível retomar agora. Tente novamente.'}:r)));
        retomando=false;
        if(res?.ok){mostrarSala(res.sala);if(res.sala.jogadores.every(j=>j.conectado))conexao('');}
        else { if(res?.expirada){limparSessao();voltarParaEntrada(res.erro,'erro');return;}conexao('');aviso(res?.erro||'Não foi possível retomar a sessão.','erro'); }
    }

    let representantes = [];
    let cartasDisponiveis = null, alterandoBaralho = false;
    let carregandoRepresentantes = true;
    const seletorRepresentante = $('representante');

    async function carregarRepresentantes() {
        try {
            const r = await fetch(`${API}/cartas`, { signal: AbortSignal.timeout(10000) });
            if (!r.ok) throw new Error('Falha ao carregar representantes.');
            const lista = await r.json();
            if (!Array.isArray(lista)) throw new Error('Lista de cartas inválida.');
            cartasDisponiveis = new Set(lista.filter(c => Motor.norm(c.classe) !== 'representante').map(c => c.codigo ? `codigo:${String(c.codigo).trim().toLowerCase()}` : c.numero != null ? `numero:${c.numero}` : `nome:${Motor.norm(c.nome)}`)).size;
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
        if (conexaoPendente) return conexaoPendente;
        if (socket?.connected) return socket;
        conexaoPendente = (async () => {
            if(!window.io)await carregarScript(`${API}/socket.io/socket.io.js`);
            if(!socket){
                socket=io(API||location.origin,{autoConnect:false});
                mesa=criarMesaOnline(socket,{
                    aoMostrar(){painelEntrada.hidden=true;painelSala.hidden=true;cabeca.hidden=true;document.querySelector('main').classList.add('em-partida');},
                    aoSair(){socket.emit('sala:sair');limparSessao();voltarParaEntrada('Você saiu da partida.');}
                });
                socket.on('sessao',dados=>{sessaoSalva=dados;identidade=dados.jogadorId;try{sessionStorage.setItem(chaveSessao,JSON.stringify(dados));localStorage.setItem(chaveBackup,JSON.stringify(dados));}catch{/* ignora */}$('retomar-sessao').hidden=true;});
                socket.on('sala',mostrarSala);
                socket.on('partida:encerrada',dados=>{mesa.limpar();if(dados.final){limparSessao();voltarParaEntrada(dados.motivo,'erro');}else{aviso(dados.motivo,(dados.empate||dados.revanche)?'':'erro');$('sala-aviso').textContent=dados.motivo;}});
                socket.on('partida:pausa',dados=>{conexao(dados.pausada?'Partida pausada. Aguardando '+dados.ausentes.join(', ')+'. A reconexão preserva as cartas e o turno; prazo de '+Math.ceil(dados.prazoMs/60000)+' minutos.':'');});
                socket.on('disconnect',()=>{if(sessaoSalva){mesa.pausar();conexao('Conexão interrompida. Reconectando automaticamente; sua partida está preservada.');}});
                socket.on('connect',()=>{retomar().catch(()=>conexao('Não foi possível recuperar agora. Tentando reconectar…'));});
            }
            await new Promise((resolve,reject)=>{
                const limite=setTimeout(()=>{socket.off('connect',ok);reject(Error('Tempo esgotado'));},15000);
                async function ok(){clearTimeout(limite);while(retomando)await new Promise(r=>setTimeout(r,25));resolve();}
                socket.once('connect',ok);socket.once('connect_error',err=>{clearTimeout(limite);socket.off('connect',ok);reject(err);});socket.connect();
            });
            return socket;
        })();
        try{return await conexaoPendente;}finally{conexaoPendente=null;}
    }

    async function pedir(evento, dados) {
        try {
            await conectar();
        } catch (err) {
            console.error(err);
            if (socket && !sessaoSalva) { socket.close(); socket = null; }
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

    $('criar').addEventListener('click', () => abrirSala('sala:criar', { ...(modo==='coop'?{dificuldade:$('dificuldade').value}:{}) }));

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
        const anfitriao = sala.anfitriao === (identidade || socket.id);
        if ($('formato-sala')) {
            $('formato-sala').value=sala.formato||'livre';
            $('formato-sala').disabled=!anfitriao||sala.iniciando||sala.emPartida;
            $('formato-descricao').textContent=sala.formato==='2v2'?'Quatro pessoas. A primeira e a terceira formam uma dupla; a segunda e a quarta formam a outra.':'Com quatro participantes, enfrente quem estiver à sua frente. Os vencedores disputam a final; com três, um participante tem folga na primeira rodada.';
        }
        const quantidade = sala.cartasPorParticipante;
        const insuficiente = cartasDisponiveis !== null && sala.tamanhoBaralho > cartasDisponiveis;
        $('tamanho-baralho').value = String(sala.tamanhoBaralhoEscolhido);
        $('tamanho-baralho').disabled = !anfitriao || sala.iniciando || sala.emPartida || alterandoBaralho;
        $('sala-baralho').textContent = `${sala.tamanhoBaralho} cartas no total · ${quantidade} por participante · sem repetição`;
        $('sala-distribuicao').textContent = `${modo === 'coop' ? `${sala.jogadores.length} jogador(es) + ${sala.maquinas} máquina(s)` : sala.jogadores.length < sala.min ? `Prévia para ${sala.min} jogadores; atualizada quando alguém entrar` : `${sala.jogadores.length} jogadores`} · Cada pessoa${modo === 'coop' ? ' e máquina' : ''} começa com 3 cartas na mão e ${quantidade - 3} na compra.${sala.tamanhoBaralho !== sala.tamanhoBaralhoEscolhido ? ` Total escolhido: ${sala.tamanhoBaralhoEscolhido}; ajustado para ${sala.tamanhoBaralho} para dividir igualmente e garantir pelo menos 5 cartas por participante.` : ''}`;
        $('sala-catalogo').hidden = !insuficiente;
        $('sala-catalogo').textContent = insuficiente ? `A divisão exige ${sala.tamanhoBaralho} cartas únicas, mas o catálogo tem ${cartasDisponiveis}. O anfitrião precisa escolher um total menor para iniciar.` : '';

        const lista = $('jogadores');
        lista.replaceChildren();

        for (const [indice,j] of sala.jogadores.entries()) {
            const li = el('li', 'jogador');
            const nome = el('span', 'nome', j.nome);
            if(sala.formato==='2v2')nome.append(el('small',null,`Equipe ${indice%2+1}`));
            const rep = representantes.find(r => r.codigo === j.representante);
            nome.append(el('small', null, rep ? rep.nome : 'Sem representante'));
            nome.append(el('small', null, `${quantidade} cartas no início (3 na mão + ${quantidade - 3} na compra)`));
            if (j.id === (identidade || socket.id)) nome.append(el('small', null, '(você)'));
            if (j.id === sala.anfitriao) nome.append(el('small', null, 'anfitrião'));
            li.append(
                el('span', 'avatar', j.nome.charAt(0).toUpperCase()),
                nome,
                el('span', 'estado' + (j.pronto ? ' pronto' : ''), !j.conectado ? 'Reconectando' : j.pronto ? 'Pronto' : 'Aguardando')
            );
            lista.append(li);
        }
        for (let i = sala.jogadores.length; i < sala.max; i++) {
            const li = el('li', 'jogador slot-vazio');
            li.append(el('span', 'nome', modo === 'coop' || i >= sala.min ? 'Vaga disponível (opcional)' : 'Aguardando jogador…'));
            lista.append(li);
        }

        const eu = sala.jogadores.find((j) => j.id === (identidade || socket.id));
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
        else if (sala.jogadores.some(j=>!j.conectado)) texto = 'Aguardando a reconexão de todos os jogadores.';
        else if (sala.iniciando) texto = 'Carregando as cartas…';
        else if (prontos === total) texto = modo === 'coop' ? `Todos prontos! O anfitrião pode iniciar ${total} jogador(es) × ${sala.maquinas} máquina(s).` : 'Todos prontos! O anfitrião pode iniciar a partida.';
        else texto = `${prontos} de ${total} jogadores prontos.`;
        $('sala-aviso').textContent = texto;
        $('iniciar').disabled = pedidoInicio || alterandoBaralho || insuficiente || sala.anfitriao !== (identidade || socket.id) || total < sala.min || prontos !== total || sala.iniciando || sala.emPartida || sala.jogadores.some(j=>!j.conectado);
        $('pronto').disabled = sala.iniciando || sala.emPartida || carregandoRepresentantes;
    }

    function voltarParaEntrada(texto, tipo) {
        salaAtual = null;
        if (mesa) mesa.limpar();
        painelSala.hidden = true;
        painelEntrada.hidden = false;
        cabeca.hidden = false;
        document.querySelector('main').classList.remove('em-partida');
        conexao('');
        aviso(texto || '', tipo);
    }

    $('formato-sala')?.addEventListener('change', async () => {
        const formato=$('formato-sala').value;$('formato-sala').disabled=true;
        const res=await pedir('sala:formato',formato);
        if(res?.erro)$('sala-erro').textContent=res.erro;
        if(salaAtual)mostrarSala(res?.sala||salaAtual);
    });

    $('tamanho-baralho').addEventListener('change', async () => {
        if (!salaAtual || alterandoBaralho) return;
        const total = Number($('tamanho-baralho').value);
        alterandoBaralho = true;
        $('sala-erro').textContent = '';
        mostrarSala(salaAtual);
        const res = await pedir('sala:baralho', total);
        alterandoBaralho = false;
        if (res?.erro) $('sala-erro').textContent = res.erro;
        if (res?.sala) mostrarSala(res.sala);
        else if (salaAtual) mostrarSala(salaAtual);
    });

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
        const eu = salaAtual.jogadores.find((j) => j.id === (identidade || socket.id));
        socket.emit('sala:pronto', !(eu && eu.pronto));
    });

    $('sair').addEventListener('click', () => {
        if (socket) socket.emit('sala:sair');
        limparSessao();
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
    $('retomar-sessao').addEventListener('click',async()=>{
        try{sessaoSalva=JSON.parse(localStorage.getItem(chaveBackup)||'null');}catch{sessaoSalva=null;}
        if(!sessaoSalva)return;identidade=sessaoSalva.jogadorId;
        try{await conectar();if(!salaAtual)await retomar();}catch{aviso('Não foi possível reconectar. Tente novamente.','erro');}
    });
    try{const ultima=JSON.parse(localStorage.getItem(chaveBackup)||'null');if(ultima){$('retomar-sessao').hidden=false;$('retomar-sessao').textContent='Retomar partida de '+ultima.nome;}}catch{/* ignora */}
    if(sessaoSalva)conectar().catch(()=>aviso('Servidor indisponível. A sessão foi mantida para uma nova tentativa.','erro'));
})();
