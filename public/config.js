// Configuração compartilhada por todas as páginas.
// Define onde está o servidor (Node, porta 3000), mesmo quando a página
// é aberta pelo Live Server (porta 5500), pelo Codespaces ou pelo GitHub Pages.
(function () {
    // A porta HTTP do Node não é a porta MySQL do Aiven.
    // Para outra porta no Live Server, defina window.ARENA_API antes deste script.
    const API_HOSPEDADA = 'https://arena-dos-campeoes.onrender.com';
    const PORTA_NODE = '16171';
    const { protocol, hostname, port } = location;
    let base = '';
    if (typeof window.ARENA_API === 'string') {
        base = window.ARENA_API.replace(/\/$/, '');
    } else if (protocol === 'file:') {
        base = 'http://localhost:' + PORTA_NODE;
    } else if (/-5500\.app\.github\.dev$/.test(hostname)) {
        base = `${protocol}//${hostname.replace(/-5500\.app\.github\.dev$/, '-' + PORTA_NODE + '.app.github.dev')}`;
    } else if (['localhost', '127.0.0.1', '[::1]'].includes(hostname) && port === '5500') {
        base = `${protocol}//${hostname}:${PORTA_NODE}`;
    } else if (hostname.endsWith('.github.io')) {
        base = API_HOSPEDADA;
    }

    window.API = base;

    // Cópia das listas do servidor: só serve para os selects nunca ficarem vazios
    // se o servidor estiver desligado. Quem valida de verdade é o server.js.
    window.OPCOES_PADRAO = {
        universo: ['cyberpunk', 'zumbi', 'mágico', 'normal', 'menção honrosa', 'game', 'void'],
        origem: ['mitologia grega', 'folclore brasileiro', 'folclore japonês', 'mitologia nórdica', 'memes', 'humanidade'],
        classe: ['campeão', 'besta', 'item', 'arma', 'auxiliar', 'feitiço', 'representante'],
        elemento: ['fogo', 'planta', 'água', 'fantasma', 'metálico', 'vento', 'sonoro', 'sombrio', 'divino']
    };

    // Toda carta tem ataque e defesa. Aceita também o formato antigo (dano/vida).
    window.normalizarCarta = function (c) {
        const ataque = c.ataque != null ? c.ataque : c.dano;
        const defesa = c.defesa != null ? c.defesa : c.vida;
        return Object.assign({}, c, { ataque: Number(ataque) || 0, defesa: Number(defesa) || 0 });
    };
})();