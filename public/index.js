const $ = (id) => document.getElementById(id);

const grade = $('grade');
const vazio = $('vazio');
const contador = $('contador');
const busca = $('busca');
const detalhe = $('detalhe');
const corpo = $('detalhe-corpo');

// campo da carta -> <select> do catálogo
const filtros = {
    classe: $('f-classe'),
    elemento: $('f-elemento'),
    universo: $('f-universo'),
    origem: $('f-origem')
};

let cartas = [];

// ---------- utilidades ----------
function el(tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
}

const semAcento = (s) =>
    (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// "água" -> "agua", "metálico" -> "metalico" (combina com o CSS)
const idElemento = (s) => semAcento(s) || 'neutro';

function criarArte(carta) {
    const arte = el('div', 'arte');
    const inicial = () => arte.append(el('span', 'inicial', (carta.nome || '?').charAt(0).toUpperCase()));

    if (carta.imagem) {
        const img = document.createElement('img');
        img.src = API + carta.imagem;
        img.alt = '';
        img.loading = 'lazy';
        img.addEventListener('error', () => { img.remove(); inicial(); });
        arte.append(img);
    } else {
        inicial();
    }
    return arte;
}

function criarStats(carta) {
    const stats = el('div', 'stats');
    if (carta.dano !== null && carta.dano !== undefined) {
        const s = el('span', 'stat');
        s.append(el('small', null, 'Dano'), String(carta.dano));
        stats.append(s);
    }
    if (carta.vida !== null && carta.vida !== undefined) {
        const s = el('span', 'stat');
        s.append(el('small', null, 'Vida'), String(carta.vida));
        stats.append(s);
    }
    return stats;
}

// ---------- carta no catálogo ----------
function criarCarta(carta) {
    const botao = el('button', 'carta');
    botao.type = 'button';
    botao.dataset.elemento = idElemento(carta.elemento);

    const topo = el('div', 'carta-topo');
    topo.append(el('span', 'codigo', carta.codigo || `#${carta.numero}`), el('span', 'classe', carta.classe));

    const meta = [carta.universo, carta.origem].filter(Boolean).join(' · ');

    botao.append(topo, criarArte(carta), el('h3', 'carta-nome', carta.nome));
    if (meta) botao.append(el('p', 'carta-meta', meta));
    botao.append(criarStats(carta));

    botao.addEventListener('click', () => abrirDetalhe(carta));
    return botao;
}

// ---------- detalhe (janela) ----------
function abrirDetalhe(carta) {
    const caixa = el('div', 'detalhe');
    caixa.dataset.elemento = idElemento(carta.elemento);

    const info = el('div');
    info.append(el('p', 'codigo', carta.codigo || `Carta #${carta.numero}`), el('h3', null, carta.nome));

    const chips = el('div', 'chips');
    for (const valor of [carta.classe, carta.elemento, carta.universo, carta.origem]) {
        if (valor) chips.append(el('span', 'chip', valor));
    }
    info.append(chips, criarStats(carta));

    if (carta.habilidade) {
        info.append(el('p', 'titulo-hab', 'Habilidade'), el('p', 'habilidade', carta.habilidade));
    }

    caixa.append(criarArte(carta), info);
    corpo.replaceChildren(caixa);
    detalhe.showModal();
}

$('fechar').addEventListener('click', () => detalhe.close());
detalhe.addEventListener('click', (e) => { if (e.target === detalhe) detalhe.close(); });

// ---------- filtros ----------
function aplicar() {
    const termo = semAcento(busca.value.trim());

    const lista = cartas.filter((c) => {
        const bateBusca = !termo || semAcento(c.nome).includes(termo) || semAcento(c.habilidade).includes(termo);
        const bateFiltros = Object.entries(filtros).every(([campo, select]) => !select.value || c[campo] === select.value);
        return bateBusca && bateFiltros;
    });

    grade.replaceChildren(...lista.map(criarCarta));
    contador.textContent = `${lista.length} de ${cartas.length} cartas`;

    vazio.hidden = lista.length > 0;
    if (!lista.length) vazio.textContent = 'Nenhuma carta encontrada com esses filtros.';
}

busca.addEventListener('input', aplicar);
Object.values(filtros).forEach((s) => s.addEventListener('change', aplicar));

$('limpar').addEventListener('click', () => {
    busca.value = '';
    Object.values(filtros).forEach((s) => (s.value = ''));
    aplicar();
});

// ---------- guia (chips que filtram o catálogo) ----------
function montarGuia(campo, valores) {
    const area = $(`guia-${campo}`);
    for (const valor of valores) {
        const chip = el('button', 'chip', valor);
        chip.type = 'button';
        if (campo === 'elemento') chip.dataset.elemento = idElemento(valor);
        chip.addEventListener('click', () => {
            filtros[campo].value = valor;
            aplicar();
            $('cartas').scrollIntoView();
        });
        area.append(chip);
    }
}

// ---------- início ----------
async function iniciar() {
    try {
        // as opções aparecem mesmo que o servidor esteja fora do ar
        let opcoes = OPCOES_PADRAO;
        try {
            const respOpcoes = await fetch(`${API}/opcoes`);
            if (respOpcoes.ok) opcoes = await respOpcoes.json();
        } catch { /* usa a lista padrão do config.js */ }

        for (const campo of Object.keys(filtros)) {
            for (const valor of opcoes[campo]) filtros[campo].add(new Option(valor, valor));
            montarGuia(campo, opcoes[campo]);
        }

        const respCartas = await fetch(`${API}/cartas`);
        if (!respCartas.ok) throw new Error('O servidor respondeu com erro.');
        cartas = await respCartas.json();

        $('n-cartas').textContent = cartas.length;
        $('n-universos').textContent = opcoes.universo.length;
        $('n-elementos').textContent = opcoes.elemento.length;

        aplicar();
    } catch (err) {
        console.error(err);
        vazio.hidden = false;
        vazio.textContent = 'Não foi possível carregar as cartas. Confira se o servidor está rodando na porta 3000.';
    }
}

iniciar();
