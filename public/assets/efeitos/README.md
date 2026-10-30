# Sprites e referências dos efeitos

Os recursos são servidos pelo próprio jogo. Nenhuma animação busca imagens em
outros sites durante a partida.

- `dino-chromium.png`: atlas oficial do jogo do dinossauro do Chromium, obtido de
  [Chromium — offline sprite](https://github.com/chromium/chromium/blob/main/components/neterror/resources/images/default_100_percent/offline/100-offline-sprite.png).
  Licença BSD de três cláusulas, reproduzida em `LICENCA-CHROMIUM.txt`.
  A animação usa os quadros originais de corrida e salto; a imagem de referência
  fornecida por Luciano identifica o personagem. Não implica endosso do Google.
- `estados-pixel.png`: arte original gerada para o projeto a partir da proposta de
  fogo e veneno enviada por Luciano. Atlas transparente com quatro colunas e
  quatro linhas: oito quadros de fogo seguidos de oito quadros de veneno.
  A referência de fogo com marca d'água não foi copiada nem teve a marca removida.
- Glifos de raio, cura, escudo, golpe, água, sol, confusão e runas: silhuetas próprias
  em grades de 16 pixels, desenhadas no código de `sprites.js`. O mesmo módulo
  contém os 45 outros modelos próprios de personagens/objetos de 32 pixels.
  Somados ao Dino, cobrem 46 cartas. A Grávida dos Robôs aguarda design.
  Toxic Ran é o nome correto da carta n036; a referência anterior a Leviatã
  foi corrigida. Não foram utilizadas imagens externas para esses modelos.
- A abertura da invocação utiliza recorte e deslocamento vertical, inspirado no
  movimento de entrada e saída mostrado no vídeo fornecido; o vídeo não integra
  os arquivos distribuídos pelo jogo.

## Pesquisa para os próximos recursos

Foram consultados os quadros e a implementação do [T-Rex do Chromium](https://github.com/chromium/chromium/blob/main/components/neterror/resources/dino_game/trex.ts),
assim como [PixiJS](https://github.com/pixijs/pixijs) para referências de animação
2D e [Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator)
como possível base futura de personagens. Nenhuma arte LPC nem dependência PixiJS
foi incorporada nesta atualização. Antes de adotar arte externa futura, conferir
as licenças e os créditos específicos de cada sprite.

A revisão 2.970 redesenhou o atlas de estados com blocos maiores e paleta reduzida.
Os personagens de `sprites.js` usam retângulos e coordenadas inteiras, sem
suavização de bordas, gradientes ou fontes de emoji. As poses são animadas por CSS
e pelo diretor de cenas. Os desenhos são ilustrações próprias para os efeitos;
as futuras artes oficiais das cartas continuam tendo prioridade.
