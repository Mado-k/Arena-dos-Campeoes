// Configuração compartilhada por todas as páginas.
// Define onde está o servidor (Node, porta 3000), mesmo quando a página
// é aberta pelo Live Server (porta 5500) ou pelo Codespaces.
(function () {
    // Se a detecção automática errar, escreva o endereço aqui. Ex.: 'http://localhost:3000'
    const API_MANUAL = '';

    const { protocol, hostname, port } = location;
    let base = '';

    if (API_MANUAL) {
        base = API_MANUAL.replace(/\/$/, '');
    } else if (protocol === 'file:') {
        base = 'http://localhost:3000';
    } else if (/-\d+\.app\.github\.dev$/.test(hostname)) {
        // GitHub Codespaces: troca a porta no endereço (…-5500.app.github.dev -> …-3000.app.github.dev)
        base = `${protocol}//${hostname.replace(/-\d+\.app\.github\.dev$/, '-3000.app.github.dev')}`;
    } else if (port && port !== '3000') {
        base = `${protocol}//${hostname}:3000`;
    }

    window.API = base;

    // Cópia das listas do servidor: só serve para os selects nunca ficarem vazios
    // se o servidor estiver desligado. Quem valida de verdade é o server.js.
    window.OPCOES_PADRAO = {
        universo: ['cyberpunk', 'zumbi', 'mágico', 'normal', 'menção honrosa', 'game', 'void'],
        origem: ['mitologia grega', 'folclore brasileiro', 'folclore japonês', 'mitologia nórdica', 'memes', 'humanidade'],
        classe: ['campeão', 'besta', 'item', 'arma', 'auxiliar', 'feitiço', 'representante'],
        elemento: ['fogo', 'planta', 'água', 'fantasma', 'metálico', 'sombrio', 'divino', 'sonoro']
    };
})();
