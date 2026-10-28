// Salas de multiplayer e co-op (tempo real, via Socket.IO).
// Ficam só na memória: quando o servidor reinicia, as salas somem.
const { randomInt } = require('crypto');
const Partida = require('./partida');

// Ajuste aqui o tamanho das salas
const MODOS = {
  multiplayer: { max: 2, min: 2 },
  coop: { max: 4, min: 2 }
};

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I, para não confundir

function novoCodigo(salas) {
  let codigo;
  do {
    codigo = Array.from({ length: 5 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
  } while (salas.has(codigo));
  return codigo;
}

function limparNome(nome) {
  return String(nome || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 20);
}

function publico(sala) {
  return {
    codigo: sala.codigo,
    modo: sala.modo,
    max: sala.max,
    min: sala.min,
    anfitriao: sala.anfitriao,
    iniciando: Boolean(sala.iniciando),
    emPartida: Boolean(sala.partida),
    jogadores: sala.jogadores.map((j) => ({ id: j.id, nome: j.nome, pronto: j.pronto }))
  };
}

module.exports = function iniciarSalas(io, carregarCartas) {
  const salas = new Map();
  const publicar = sala => io.to(sala.codigo).emit('sala', publico(sala));
  function atualizarPartida(sala) {
    for (const j of sala.jogadores) io.to(j.id).emit('partida:estado', sala.partida.visao(j.id));
  }
  io.on('connection', (socket) => {
    const resposta = (cb) => (typeof cb === 'function' ? cb : () => {});

    function sair() {
      const codigo = socket.data.sala;
      if (!codigo) return;
      socket.leave(codigo);
      socket.data.sala = null;

      const sala = salas.get(codigo);
      if (!sala) return;

      if (sala.partida || sala.iniciando) {
        sala.partida = null;
        sala.iniciando = false;
        io.to(codigo).emit('partida:encerrada', { motivo: 'Um jogador saiu ou perdeu a conexão. A partida foi encerrada; prepare uma nova sala.' });
      }

      sala.jogadores = sala.jogadores.filter((j) => j.id !== socket.id);
      if (sala.jogadores.length === 0) {
        salas.delete(codigo);
        return;
      }
      if (sala.anfitriao === socket.id) sala.anfitriao = sala.jogadores[0].id;
      sala.jogadores.forEach((j) => { j.pronto = false; }); // quem ficou confirma de novo
      io.to(codigo).emit('sala', publico(sala));
    }

    function entrar(sala, nome) {
      sala.jogadores.push({ id: socket.id, nome, pronto: false });
      socket.join(sala.codigo);
      socket.data.sala = sala.codigo;
      io.to(sala.codigo).emit('sala', publico(sala));
    }

    socket.on('sala:criar', (dados, cb) => {
      const responder = resposta(cb);
      const modo = MODOS[dados && dados.modo];
      const nome = limparNome(dados && dados.nome);
      if (!modo) return responder({ ok: false, erro: 'Modo de jogo inválido.' });
      if (!nome) return responder({ ok: false, erro: 'Escolha um apelido.' });

      sair();
      const sala = { codigo: novoCodigo(salas), modo: dados.modo, max: modo.max, min: modo.min, anfitriao: socket.id, jogadores: [] };
      salas.set(sala.codigo, sala);
      entrar(sala, nome);
      responder({ ok: true, sala: publico(sala) });
    });

    socket.on('sala:entrar', (dados, cb) => {
      const responder = resposta(cb);
      const codigo = String((dados && dados.codigo) || '').toUpperCase();
      const nome = limparNome(dados && dados.nome);
      if (!nome) return responder({ ok: false, erro: 'Escolha um apelido.' });

      const sala = salas.get(codigo);
      if (!sala) return responder({ ok: false, erro: 'Sala não encontrada. Confira o código.' });
      if (sala.partida || sala.iniciando) return responder({ ok: false, erro: 'Essa sala já está em partida.' });
      if (sala.modo !== dados.modo) return responder({ ok: false, erro: 'Essa sala é de outro modo de jogo.' });
      if (sala.jogadores.some((j) => j.id === socket.id)) return responder({ ok: true, sala: publico(sala) });
      if (sala.jogadores.length >= sala.max) return responder({ ok: false, erro: 'A sala está cheia.' });

      sair();
      sala.jogadores.forEach((j) => { j.pronto = false; }); // alguém novo chegou: todos confirmam de novo
      entrar(sala, nome);
      responder({ ok: true, sala: publico(sala) });
    });

    socket.on('sala:pronto', (valor) => {
      const sala = salas.get(socket.data.sala);
      if (!sala) return;
      if (sala.partida || sala.iniciando) return;
      const jogador = sala.jogadores.find((j) => j.id === socket.id);
      if (!jogador) return;
      jogador.pronto = Boolean(valor);
      io.to(sala.codigo).emit('sala', publico(sala));
    });

    socket.on('partida:iniciar', async (_, cb) => {
      const responder = resposta(cb);
      const sala = salas.get(socket.data.sala);
      if (!sala || sala.anfitriao !== socket.id) return responder({ erro: 'Só o anfitrião pode iniciar.' });
      if (sala.partida || sala.iniciando) return responder({ erro: 'A partida já está iniciando ou em andamento.' });
      if (sala.jogadores.length < sala.min || !sala.jogadores.every(j => j.pronto)) return responder({ erro: 'Aguarde todos os jogadores ficarem prontos.' });
      sala.iniciando = true;
      const ids = sala.jogadores.map(j => j.id).join(',');
      publicar(sala);
      try {
        const cartas = await carregarCartas();
        if (!sala.iniciando || !salas.has(sala.codigo) || ids !== sala.jogadores.map(j => j.id).join(',')) return responder({ erro: 'Os jogadores da sala mudaram. Tente novamente.' });
        sala.partida = new Partida(sala.jogadores, cartas, sala.modo);
        sala.iniciando = false;
        publicar(sala);
        atualizarPartida(sala);
        responder({ ok: true });
      } catch (err) {
        sala.iniciando = false;
        publicar(sala);
        console.error('Não foi possível iniciar a partida:', err.code || err.message);
        responder({ erro: 'Não foi possível carregar as cartas. Confira a conexão do servidor com o banco.' });
      }
    });

    let janela = 0, quantidade = 0;
    socket.on('partida:sincronizar', () => {
      const sala = salas.get(socket.data.sala);
      if (sala && sala.partida) socket.emit('partida:estado', sala.partida.visao(socket.id));
    });
    socket.on('partida:acao', (dados, cb) => {
      const responder = resposta(cb);
      const agora = Date.now();
      if (agora - janela > 1000) { janela = agora; quantidade = 0; }
      if (++quantidade > 30) return responder({ erro: 'Muitas ações. Aguarde um instante.' });
      const sala = salas.get(socket.data.sala);
      if (!sala || !sala.partida) return responder({ erro: 'Não há partida em andamento.' });
      try {
        const res = sala.partida.agir(socket.id, dados);
        if (res.ok) sala.partida.jogarComputador();
        if (!res.pergunta) atualizarPartida(sala);
        responder(res);
      } catch (err) {
        console.error('Erro na ação:', err.code || err.message);
        responder({ erro: 'Não foi possível executar a ação.' });
      }
    });

    socket.on('sala:sair', sair);
    socket.on('disconnect', sair);
  });
};
