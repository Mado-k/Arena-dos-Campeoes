// Exporta os desenhos das invocações como arquivos independentes do catálogo.
const fs = require('node:fs');
const path = require('node:path');
const Sprites = require('./public/sprites');
const { imagens } = require('./pixelarts');

const pasta = path.join(__dirname, 'public/assets/cartas');
fs.mkdirSync(pasta, { recursive: true });
for (const codigo of Object.keys(imagens)) {
  let svg = Sprites.desenhar(codigo);
  if (codigo === 'n022') {
    const png = fs.readFileSync(path.join(__dirname, 'public/assets/efeitos/dino-chromium.png'));
    const largura = png.readUInt32BE(16), altura = png.readUInt32BE(20);
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="848 2 44 47" shape-rendering="crispEdges"><image width="${largura}" height="${altura}" style="image-rendering:pixelated" href="data:image/png;base64,${png.toString('base64')}"/></svg>`;
  }
  fs.writeFileSync(path.join(pasta, `${codigo}.svg`), svg + '\n');
}
console.log(`${Object.keys(imagens).length} pixel arts exportadas para public/assets/cartas.`);
