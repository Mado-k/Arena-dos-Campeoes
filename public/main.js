const form = document.getElementById('form-carta');
const mensagem = document.getElementById('mensagem');

// Preenche os selects com as listas fixas do servidor.
// Se o servidor estiver fora do ar, usa a cópia local para as opções nunca sumirem.
async function carregarOpcoes() {
    let opcoes = OPCOES_PADRAO;
    let servidorOk = true;

    try {
        const resposta = await fetch(`${API}/opcoes`);
        if (!resposta.ok) throw new Error(`O servidor respondeu ${resposta.status} em /opcoes`);
        opcoes = await resposta.json();
    } catch (err) {
        console.error(err);
        servidorOk = false;
    }

    for (const [campo, valores] of Object.entries(opcoes)) {
        const select = form.elements[campo];
        if (!select) continue;
        for (const valor of valores) {
            select.add(new Option(valor, valor));
        }
    }

    if (!servidorOk) {
        mensagem.className = 'erro';
        mensagem.textContent = 'Servidor não encontrado: mostrando as opções padrão. Inicie o server.js para conseguir salvar cartas.';
    }
}

carregarOpcoes();

form.addEventListener('submit', async (e) => {
    e.preventDefault(); // impede a página de recarregar

    const dados = new FormData(form);
    const senha = dados.get('senha');
    dados.delete('senha'); // a senha vai no cabeçalho, não no corpo
    const nome = dados.get('nome');

    try {
        const resposta = await fetch(`${API}/cartas`, {
            method: 'POST',
            headers: { 'x-admin-senha': senha }, // sem Content-Type: o navegador define sozinho
            body: dados
        });
        const resultado = await resposta.json();

        if (resposta.ok) {
            mensagem.className = 'ok';
            mensagem.textContent = `Carta "${nome}" cadastrada com o número ${resultado.numero}!`;
            // limpa os campos, mas mantém a senha para cadastrar várias seguidas
            form.reset();
            form.senha.value = senha;
        } else {
            mensagem.className = 'erro';
            mensagem.textContent = resultado.erro;
        }
    } catch (err) {
        mensagem.className = 'erro';
        mensagem.textContent = 'Não foi possível conectar ao servidor.';
    }
});
