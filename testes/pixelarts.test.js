const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { imagens, atualizarPixelArts } = require('../pixelarts');

test('as 46 imagens persistidas existem como SVGs independentes; Dino inclui os pixels originais', () => {
  assert.equal(Object.keys(imagens).length, 46);
  assert.equal(imagens.n001, undefined);
  for (const imagem of Object.values(imagens)) {
    const svg = fs.readFileSync(path.join(__dirname, '../public', imagem), 'utf8');
    assert.match(svg, /<svg[^>]+viewBox=/);
    assert.doesNotMatch(svg, /<script|https?:\/\/(?!www\.w3\.org)/);
  }
  const dino = fs.readFileSync(path.join(__dirname, '../public', imagens.n022), 'utf8');
  assert.match(dino, /viewBox="848 2 44 47"/);
  assert(dino.includes(fs.readFileSync(path.join(__dirname, '../public/assets/efeitos/dino-chromium.png')).toString('base64')));
});

test('migração preenche somente imagens vazias, confirma e libera a conexão', async () => {
  const chamadas = [];
  const conexao = {
    beginTransaction: async () => chamadas.push('iniciar'),
    execute: async (sql, valores) => {
      assert.match(sql, /imagem IS NULL OR TRIM\(imagem\) = ''/);
      assert.equal(imagens[valores[1]], valores[0]);
      return [{ affectedRows: valores[1] === 'n022' ? 1 : 0 }];
    },
    commit: async () => chamadas.push('confirmar'),
    rollback: async () => chamadas.push('reverter'),
    release: () => chamadas.push('liberar')
  };
  assert.equal(await atualizarPixelArts({ getConnection: async () => conexao }), 1);
  assert.deepEqual(chamadas, ['iniciar', 'confirmar', 'liberar']);
  conexao.execute = async () => { throw new Error('falha no banco'); };
  chamadas.length = 0;
  await assert.rejects(atualizarPixelArts({ getConnection: async () => conexao }), /falha no banco/);
  assert.deepEqual(chamadas, ['iniciar', 'reverter', 'liberar']);
});

test('URLs das pixel arts funcionam na API separada e na cópia offline', () => {
  for (const href of ['https://jogo.example/sub/index.html', 'file:///jogo/public/index.html']) {
    const location = new URL(href), window = { ARENA_API: 'https://api.example' };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/config.js'), 'utf8'), { window, location, URL });
    const fonte = window.fonteImagemCarta;
    assert.equal(fonte('/assets/cartas/n022.svg', true), './assets/cartas/n022.svg');
    assert.equal(fonte('/uploads/arte.png', true), '../uploads/arte.png');
    if (location.protocol === 'https:') {
      assert.equal(fonte('/assets/cartas/n022.svg'), 'https://api.example/assets/cartas/n022.svg');
      assert.equal(fonte('https://artes.example/carta.png'), 'https://artes.example/carta.png');
    } else assert.equal(fonte('/assets/cartas/n022.svg'), './assets/cartas/n022.svg');
  }
});

test('preparação compartilhada permite tentar novamente após falha temporária do banco', async () => {
  let consultas=0, transacoes=0;
  const preparar=require('../db').preparadorBanco({
    query:async()=>{if(++consultas===1)throw new Error('banco indisponível');},
    getConnection:async()=>({beginTransaction:async()=>{transacoes++;},execute:async()=>[{affectedRows:0}],commit:async()=>{},rollback:async()=>{},release(){}})
  });
  const inicial=preparar();assert.equal(inicial,preparar());
  await assert.rejects(inicial,/banco indisponível/);
  const nova=preparar();assert.equal(nova,preparar());await nova;await preparar();
  assert.equal(consultas,2);assert.equal(transacoes,1);
});
