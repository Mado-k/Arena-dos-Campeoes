// Salas de multiplayer e co-op (tempo real, via Socket.IO).
// Ficam só na memória: quando o servidor reinicia, as salas somem.
const { randomInt } = require('crypto');

// Ajuste aqui o tamanho das salas
const MODOS = {
  multiplayer: { max: 2, min: 2 },
  coop: { max: 4, min: 2 }
};

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I, para não confundir
const salas = new Map();

function novoCodigo() {
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
    jogadores: sala.jogadores.map((j) => ({ id: j.id, nome: j.nome, pronto: j.pronto }))
  };
}

module.exports = function iniciarSalas(io) {
  io.on('connection', (socket) => {
    const resposta = (cb) => (typeof cb === 'function' ? cb : () => {});

    function sair() {
      const codigo = socket.data.sala;
      if (!codigo) return;
      socket.leave(codigo);
      socket.data.sala = null;

      const sala = salas.get(codigo);
      if (!sala) return;

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
      const sala = { codigo: novoCodigo(), modo: dados.modo, max: modo.max, min: modo.min, anfitriao: socket.id, jogadores: [] };
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
      const jogador = sala.jogadores.find((j) => j.id === socket.id);
      if (!jogador) return;
      jogador.pronto = Boolean(valor);
      io.to(sala.codigo).emit('sala', publico(sala));
    });

    socket.on('sala:sair', sair);
    socket.on('disconnect', sair);
  });
};
