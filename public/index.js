// Página inicial. O catálogo é carregado pelo botão ou por um link filtrado do tutorial.
const $ = (id) => document.getElementById(id);

const POR_PAGINA = 24;

const grade = $('grade');
const vazio = $('vazio');
const contador = $('contador');
const busca = $('busca');
const detalhe = $('detalhe');
const corpo = $('detalhe-corpo');
const catalogo = $('catalogo');

// campo da carta -> <select> do catálogo
const filtros = {
    classe: $('f-classe'),
    elemento: $('f-elemento'),
    universo: $('f-universo'),
    origem: $('f-origem')
};

let cartas = [];
let fonte = 'servidor';       // 'servidor' ou 'offline'
let carregado = false;
let carregando = null;
let visiveis = POR_PAGINA;

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

function carregarScript(src) {
    return new Promise((ok, falha) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = ok;
        s.onerror = () => falha(new Error(`Não foi possível carregar ${src}`));
        document.head.append(s);
    });
}

// texto corrigido da habilidade (vem do motor, se já foi carregado)
function descricaoDe(carta) {
    if (window.Motor) return Motor.descricao(carta);
    return { tipo: carta.habilidade ? 'passiva' : 'nenhuma', texto: carta.habilidade || '', detalhe: '' };
}

function criarArte(carta) {
    const arte = el('div', 'arte');
    const inicial = () => arte.append(el('span', 'inicial', (carta.nome || '?').charAt(0).toUpperCase()));

    if (carta.imagem) {
        const img = document.createElement('img');
        img.src = fonteImagemCarta(carta.imagem, fonte === 'offline');
        if (carta.imagem.startsWith('/assets/cartas/')) img.classList.add('pixelart-carta');
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.addEventListener('error', () => { img.remove(); inicial(); });
        arte.append(img);
    } else {
        inicial();
    }
    return arte;
}

function criarStats(carta) {
    const stats = el('div', 'stats');
    for (const [rotulo, valor] of [['Ataque', carta.ataque], ['Defesa', carta.defesa]]) {
        const s = el('span', 'stat');
        s.append(el('small', null, rotulo), String(valor));
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
    const texto = descricaoDe(carta).texto;

    botao.append(topo, criarArte(carta), el('h3', 'carta-nome', carta.nome));
    if (meta) botao.append(el('p', 'carta-meta', meta));
    botao.append(criarStats(carta));
    if (texto) botao.append(el('p', 'carta-desc', texto));

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

    const d = descricaoDe(carta);
    if (d.texto) {
        const cab = el('div', 'hab-cab');
        cab.append(el('p', 'titulo-hab', 'Habilidade'));
        if (d.tipo === 'ativa') cab.append(el('span', 'tipo-hab ativa', '⚡ Ativa · gasta 1 ação'));
        if (d.tipo === 'passiva') cab.append(el('span', 'tipo-hab passiva', '● Passiva · automática'));
        info.append(cab, el('p', 'habilidade', d.texto));
        if (d.detalhe) {
            const det = el('p', 'hab-detalhe');
            det.append(el('strong', null, 'Como funciona: '), d.detalhe);
            info.append(det);
        }
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
        const bateBusca = !termo || semAcento(c.nome).includes(termo) || semAcento(descricaoDe(c).texto).includes(termo);
        const bateFiltros = Object.entries(filtros).every(([campo, select]) => !select.value || c[campo] === select.value);
        return bateBusca && bateFiltros;
    });

    const mostrar = lista.slice(0, visiveis);
    grade.replaceChildren(...mostrar.map(criarCarta));
    let texto = `${lista.length} de ${cartas.length} cartas`;
    if (fonte === 'offline') texto += ' · cópia offline (servidor indisponível)';
    contador.textContent = texto;

    $('mais').hidden = lista.length <= visiveis;
    vazio.hidden = lista.length > 0;
    if (!lista.length) vazio.textContent = 'Nenhuma carta encontrada com esses filtros.';
}

function novaBusca() { visiveis = POR_PAGINA; aplicar(); }

busca.addEventListener('input', novaBusca);
Object.values(filtros).forEach((s) => s.addEventListener('change', novaBusca));

$('limpar').addEventListener('click', () => {
    busca.value = '';
    Object.values(filtros).forEach((s) => (s.value = ''));
    novaBusca();
});

$('mais').addEventListener('click', () => { visiveis += POR_PAGINA; aplicar(); });

// ---------- catálogo (carregado só quando o jogador pede) ----------
async function buscarCartas() {
    try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 2500);
        const r = await fetch(`${API}/cartas`, { signal: ctl.signal });
        clearTimeout(t);
        if (!r.ok) throw new Error(`status ${r.status}`);
        const lista = await r.json();
        if (!Array.isArray(lista) || !lista.length) throw new Error('sem cartas');
        fonte = 'servidor';
        return lista;
    } catch {
        // sem servidor (ou site publicado no GitHub Pages): usa a cópia que vai junto com o site
        await carregarScript('cartas-offline.js');
        fonte = 'offline';
        return window.CARTAS_OFFLINE || [];
    }
}

async function opcoesDoServidor() {
    try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 1500);
        const r = await fetch(`${API}/opcoes`, { signal: ctl.signal });
        clearTimeout(t);
        if (!r.ok) return OPCOES_PADRAO;
        const recebidas = await r.json();
        return recebidas && Object.keys(OPCOES_PADRAO).every((c) => Array.isArray(recebidas[c])) ? recebidas : OPCOES_PADRAO;
    } catch {
        return OPCOES_PADRAO;
    }
}

function carregarCatalogo() {
    if (carregado) return Promise.resolve();
    if (carregando) return carregando;
    contador.textContent = 'Carregando as cartas...';
    carregando = (async () => {
        try {
            const [lista, opcoes] = await Promise.all([
                buscarCartas(),
                opcoesDoServidor(),
                carregarScript('motor.js').catch(() => null)   // textos revisados das habilidades
            ]);
            cartas = lista.map(window.normalizarCarta);
            for (const campo of Object.keys(filtros)) {
                for (const valor of opcoes[campo]) filtros[campo].add(new Option(valor, valor));
            }
            carregado = true;
            aplicar();
        } catch (err) {
            console.error(err);
            carregando = null;
            vazio.hidden = false;
            vazio.textContent = 'Não foi possível carregar as cartas agora. Tente de novo em instantes.';
            contador.textContent = '';
        }
    })();
    return carregando;
}

async function abrirCatalogo() {
    catalogo.hidden = false;
    $('ver-cartas').setAttribute('aria-expanded', 'true');
    $('ver-cartas').hidden = true;
    $('cartas').scrollIntoView();
    await carregarCatalogo();
}

function esconderCatalogo() {
    catalogo.hidden = true;
    $('ver-cartas').hidden = false;
    $('ver-cartas').setAttribute('aria-expanded', 'false');
    $('ver-cartas').focus();
}

document.querySelectorAll('[data-abrir-cartas]').forEach((b) => b.addEventListener('click', abrirCatalogo));
$('esconder').addEventListener('click', esconderCatalogo);

// Links do tutorial abrem o catálogo com o elemento escolhido.
const elementoInicial = new URLSearchParams(location.search).get('elemento');
if (OPCOES_PADRAO.elemento.includes(elementoInicial)) {
    abrirCatalogo().then(() => { filtros.elemento.value = elementoInicial; novaBusca(); });
}

// Preserva favoritos e convites que apontavam ao guia na página inicial.
function encaminharTutorial() {
    if (location.hash === '#como-jogar' || location.hash.startsWith('#cj-')) {
        location.replace(new URL('tutorial.html' + location.hash, location.href).href);
    }
}
encaminharTutorial();
window.addEventListener('hashchange', encaminharTutorial);
