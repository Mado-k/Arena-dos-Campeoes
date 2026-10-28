// Configuração compartilhada por todas as páginas.
// Define onde está o servidor (Node, porta 3000), mesmo quando a página
// é aberta pelo Live Server (porta 5500 ou 5501), pelo Codespaces ou pelo GitHub Pages.
(function () {
    // A porta HTTP do Node não é a porta MySQL do Aiven.
    // Para outra porta no Live Server, defina window.ARENA_API antes deste script.
    const API_HOSPEDADA = ''; // Preencha se quiser uma API no GitHub Pages.
    const PORTA_NODE = '3000';
    const { protocol, hostname, port } = location;
    let base = '';
    if (typeof window.ARENA_API === 'string') {
        base = window.ARENA_API.replace(/\/$/, '');
    } else if (protocol === 'file:') {
        base = 'http://localhost:' + PORTA_NODE;
    } else if (/-(5500|5501)\.app\.github\.dev$/.test(hostname)) {
        base = `${protocol}//${hostname.replace(/-(5500|5501)\.app\.github\.dev$/, '-' + PORTA_NODE + '.app.github.dev')}`;
    } else if (['localhost', '127.0.0.1', '[::1]'].includes(hostname) && ['5500', '5501'].includes(port)) {
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

    function tituloNome(nome) {
        const peq = ['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o'];
        return String(nome == null ? '' : nome).trim().split(/\s+/).map((p, i) => {
            if (/[A-ZÀ-Ý]/.test(p.slice(1))) return p;
            const min = p.toLowerCase();
            if (i > 0 && peq.includes(min)) return min;
            return min.charAt(0).toUpperCase() + min.slice(1);
        }).join(' ');
    }

    // Toda carta tem ataque e defesa. Aceita também o formato antigo (dano/vida).
    window.normalizarCarta = function (c) {
        const ataque = c.ataque != null ? c.ataque : c.dano;
        const defesa = c.defesa != null ? c.defesa : c.vida;
        return Object.assign({}, c, { nome: tituloNome(c.nome), ataque: Number(ataque) || 0, defesa: Number(defesa) || 0 });
    };
})();