// Atualiza public/cartas-offline.js com as cartas que estão no banco.
// Rode sempre que cadastrar cartas novas e quiser que o modo offline as tenha:
//   node --env-file=.env exportar-offline.js
const banco = require('./banco');
const fs = require('fs');
const path = require('path');

(async () => {
  const pool = banco.criarPool();

  const [cartas] = await pool.query('SELECT * FROM cartas ORDER BY numero');
  const topo =
    '// Cópia das cartas para jogar sem servidor nem internet.\n' +
    '// Para atualizar com as cartas do banco: node --env-file=.env exportar-offline.js\n';
  const destino = path.join(__dirname, 'public', 'cartas-offline.js');
  fs.writeFileSync(destino, topo + 'window.CARTAS_OFFLINE = ' + JSON.stringify(cartas.map(banco.normalizar), null, 1) + ';\n');

  console.log(`${cartas.length} cartas gravadas em ${destino}`);
  await pool.end();
})().catch((err) => {
  console.error('Erro ao exportar:', err.message);
  process.exit(1);
});
