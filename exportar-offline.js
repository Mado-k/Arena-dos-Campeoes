// Atualiza public/cartas-offline.js com as cartas que estão no banco.
// Rode sempre que cadastrar cartas novas e quiser que o modo offline as tenha:
//   node --env-file=.env exportar-offline.js
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'arena_campeoes'
  });

  const [cartas] = await pool.query('SELECT * FROM cartas ORDER BY numero');
  const topo =
    '// Cópia das cartas para jogar sem servidor nem internet.\n' +
    '// Para atualizar com as cartas do banco: node --env-file=.env exportar-offline.js\n';
  const destino = path.join(__dirname, 'public', 'cartas-offline.js');
  fs.writeFileSync(destino, topo + 'window.CARTAS_OFFLINE = ' + JSON.stringify(cartas, null, 1) + ';\n');

  console.log(`${cartas.length} cartas gravadas em ${destino}`);
  await pool.end();
})().catch((err) => {
  console.error('Erro ao exportar:', err.message);
  process.exit(1);
});
