// Importa as cartas já criadas (n001-n040 e D001-D007).
// Uso: node --env-file=.env seed.js
// Pode rodar mais de uma vez: cartas com o mesmo código são ignoradas.
const mysql = require('mysql2/promise');
const { configBanco, garantirTabela } = require('./db');
// Os textos das habilidades (já revisados) ficam em public/motor.js
const { TEXTOS } = require('./public/motor.js');

// [codigo, nome, elemento, classe, universo, origem, ataque, defesa, habilidade]
// Toda carta tem ataque e defesa: onde está null, o valor entra como 0 (preencha depois).
const cartas = [
  ['n001', 'grávida dos robôs', 'metálico', 'auxiliar', 'cyberpunk', 'memes', null, null,
    'quando a habilidade dessa carta, você deve comprar uma carta do baralho se ela for do tipo “metálico” adicione ela no baralho caso não, coloque a carta comprada na pilha de descarte'],
  ['n002', 'abertura da caixa de pandora', 'sombrio', 'feitiço', 'normal', 'mitologia grega', null, null,
    'todas os campeões/bestas invocados passaram a sofrer 10 de dano por turno (também afetará o invocador)'],
  ['n003', 'vingança do lobo-guará', 'planta', 'besta', 'mágico', 'humanidade', 6, 18,
    'da mais 2 de dano em cartas da origem humanidade'],
  ['n004', 'lança do Pirarucu', 'água', 'arma', 'mágico', 'folclore brasileiro', 2, null,
    'faz os auxiliares se transformarem em peixes, e impede que eles possam usar as habilidades'],
  ['n005', 'Maldição de atridas', 'sombrio', 'feitiço', 'zumbi', 'mitologia grega', null, null,
    'pega uma carta zumbi da sua pilha de descarte e coloca na sua mão'],
  ['n006', 'gravity gun', 'metálico', 'arma', 'game', 'humanidade', 1, null,
    'pode jogar os itens ou armas do oponente longe'],
  ['n007', 'cyber onimaru', 'sombrio', 'arma', 'cyberpunk', 'folclore japonês', 4, null,
    'dá dano apenas no tipo fantasma e sombrio'],
  ['n008', 'Heimdall', 'divino', 'auxiliar', 'normal', 'mitologia nórdica', null, null,
    'manda os auxiliares do universo normal invocador para sua mão'],
  ['n009', 'fuleco', 'sonoro', 'auxiliar', 'menção honrosa', 'folclore brasileiro', null, null,
    'Ao levantar a torcida o fuleco faz com os efeitos do seu time dobrem'],
  ['n010', 'cachorro caramelo', 'fogo', 'besta', 'menção honrosa', 'memes', 2, 14,
    'Não sofre dano direto de campeões'],
  ['n011', 'deusa amaterasu', 'fogo', 'campeão', 'cyberpunk', 'folclore japonês', 4, 18,
    'Dá dano em dobro em cartas do tipo metálico'],
  ['n012', 'Iara', 'sonoro', 'campeão', 'game', 'folclore brasileiro', 8, 19,
    'Com seu canto consegue bugar e anular as habilidades das cartas do universo “game”'],
  ['n013', 'Hércules', 'fogo', 'campeão', 'normal', 'mitologia grega', 7, 13,
    'seu dano dobra a cada três turnos'],
  ['n014', 'Bai besta', 'planta', 'besta', 'menção honrosa', 'folclore japonês', 6, 6,
    'da o dobro de dano em cartas do tipo sombrio,fantasma e divino'],
  ['n015', 'adão', 'planta', 'campeão', 'normal', 'humanidade', 5, 14,
    'não sofre cartas da classe besta'],
  ['n016', 'toxic kappa', 'água', 'besta', 'cyberpunk', 'folclore japonês', 1, 14,
    'da efeito de veneno no oponente no oponente, o oponente recebe 2 de dano por turno'],
  ['n017', 'thor circuito', 'metálico', 'feitiço', 'game', 'mitologia nórdica', 3, null,
    'paraliza por 1 turno, seres do universo games'],
  ['n018', 'Valir', 'divino', 'campeão', 'cyberpunk', 'mitologia nórdica', 3, 14,
    'da o dobro de dano em criaturas do tipo metálico'],
  ['n019', 'kitsune 100%', 'sonoro', 'besta', 'mágico', 'folclore japonês', 4, 18,
    'consegue retornar para sua mão uma única vez para recuperar seus status'],
  ['n020', 'irineu', 'sonoro', 'campeão', 'cyberpunk', 'memes', 4, 17,
    'deixa seu oponente confuso e faz ele se atacar por 1 turno e cooldown de 3 turnos para reutilizar a habilidade'],
  ['n021', 'batsopra bolha', 'água', 'arma', 'menção honrosa', 'memes', 6, null,
    'sopra bat bolhas no oponente distraindo os auxiliares e impedindo eles de usar as habilidades'],
  ['n022', 'dino do google', 'metálico', 'auxiliar', 'game', 'memes', null, null,
    'pula em cima dos inimigos em três turnos causando 4 de dano a mais, após os três turnos ele bate em um cacto  morre e a carta vai para pilha de descarte'],
  ['n023', 'zord Fenrir', 'metálico', 'besta', 'cyberpunk', 'mitologia nórdica', 2, 14,
    'ao ser derrotado adicione mais 100 de vida a próxima carta caso seja um campeão'],
  ['n024', 'bagunça de dados do saci', 'planta', 'feitiço', 'game', 'folclore brasileiro', null, null,
    'joga todas as cartas da pilha de descarte de volta no baralho e re embaralha as cartas'],
  ['n025', 'testemunha de jeová', 'divino', 'auxiliar', 'normal', 'humanidade', null, null,
    'anula o dano e efeito  de cartas do tipo divino'],
  // n026: o original tinha universo "humanidade" (que é um mito). Deixei vazio: confirme.
  ['n026', 'cobertor', 'sombrio', 'item', null, 'memes', null, 11,
    'HP +11. Anula habilidades de tipo fantasma'],
  ['n027', 'dados do cabelo do curupira', 'fogo', 'item', 'game', 'folclore brasileiro', null, null,
    'aplica efeito de fogo em qualquer um que te tocar, o oponente receberá 7 de dano por turno'],
  ['n028', 'gorro verde', 'sombrio', 'item', 'zumbi', 'folclore brasileiro', null, null,
    'zumbifica a carta do oponente, fazendo a vida ser reduzida pela metade'],
  ['n029', 'lobisomem', 'sonoro', 'besta', 'normal', 'folclore brasileiro', 4, 9,
    'caso seu oponente seja do tipo sombrio, a vida dessa carta é multiplicada por 10'],
  ['n030', 'ira de zeus', 'divino', 'feitiço', 'normal', 'mitologia grega', 5, null,
    'criaturas do universo normal sofrem dano dobrado'],
  // n031: o original tinha tipo "itens" (não é um elemento). Deixei sem elemento.
  ['n031', 'pergaminho do felipe TI', null, 'item', 'menção honrosa', 'folclore japonês', null, null,
    'compra três cartas do baralho e coloque essa carta na pilha de descarte'],
  ['n032', 'Marie Curie Zumbi', 'sombrio', 'campeão', 'zumbi', 'humanidade', 19, 40,
    'como ela foi a primeira infectada, ela tem muito mais vida que o normal'],
  // n033: o original tinha tipo "besta" e carta "fantasma" (parecia trocado). Corrigi.
  ['n033', 'ôni zumbi', 'fantasma', 'besta', 'zumbi', 'folclore japonês', 3, 19,
    'dobra o dano base caso esteja com uma arma'],
  ['n034', 'guss deus do design', 'fogo', 'campeão', 'menção honrosa', 'mitologia grega', 9, 16,
    'consegue copiar a habilidade do campeão/besta do oponente'],
  ['n035', 'doce hera', 'planta', 'campeão', 'game', 'mitologia grega', 4, 13,
    'procure uma carta de campeão no baralho e coloque na sua mão'],
  ['n036', 'toxic Ran', 'água', 'campeão', 'zumbi', 'mitologia nórdica', 4, 17,
    'auxiliares,itens e armas do tipo água, são mandados para pilha de descarte'],
  ['n037', 'gengar', 'fantasma', 'besta', 'menção honrosa', 'folclore japonês', 1, 20,
    'só pode ser ferido por fantasma'],
  ['n038', 'espírito do benito mussolini', 'fantasma', 'campeão', 'mágico', 'humanidade', 8, 18,
    'não é possível equipar auxiliares, itens e armas nessa carta'],
  ['n039', 'gaiamon', 'divino', 'campeão', 'game', 'mitologia grega', 3, 3,
    'faz seu oponente ter o mesmo tanto de vida que você'],
  ['n040', 'não tem café', 'divino', 'campeão', 'menção honrosa', 'memes', 8, 20,
    'essa habilidade destrói a carta do oponente (essa habilidade pode ser usada uma única vez)'],

  // Representantes
  ['D001', 'inteligência única', null, 'representante', 'cyberpunk', null, null, 200,
    'dá mais 10 de HP para seres do seu universo'],
  ['D002', 'lord Z', null, 'representante', 'zumbi', null, null, 200,
    'dá mais 10 de HP para seres do seu universo'],
  ['D003', 'merlin', null, 'representante', 'mágico', null, null, 200,
    'dá mais 10 de HP para seres do seu universo'],
  ['D004', 'o ditador', null, 'representante', 'normal', null, null, 200,
    'dá mais 10 de HP para seres do seu universo'],
  ['D005', 'canoni', null, 'representante', 'menção honrosa', null, null, 200,
    'dá mais 10 de HP para seres do seu universo'],
  ['D006', 'pixel', null, 'representante', 'game', null, null, 200,
    'dá mais 10 de HP para seres do seu universo'],
  ['D007', 'rei da arena dos campeões', null, 'representante', 'void', null, null, 400,
    'contém mais vida que os outros']
];

(async () => {
  const pool = mysql.createPool(configBanco());
  await garantirTabela(pool);

  let inseridas = 0;
  for (const c of cartas) {
    const [r] = await pool.query(
      `INSERT IGNORE INTO cartas
         (codigo, nome, elemento, classe, universo, origem, ataque, defesa, habilidade)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      c.map((valor, i) => (i === 8 && TEXTOS[c[0]] ? TEXTOS[c[0]] : (i === 6 || i === 7) && valor == null ? 0 : valor))
    );
    inseridas += r.affectedRows;
  }

  console.log(`${inseridas} de ${cartas.length} cartas inseridas.`);
  await pool.end();
})().catch((err) => {
  console.error('Erro no seed:', err);
  process.exit(1);
});