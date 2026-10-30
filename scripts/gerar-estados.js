// Atlas original, em grade nativa de 16 px, com quatro quadros por estado.
const fs=require('node:fs'),path=require('node:path'),S=require('../public/sprites');
const tipos=['paralisia','confusao','zumbi','peixe','bolha','canto','copia','escudo','amplifica','recarga','dino','recusa'];
const cores={paralisia:['#69562b','#ffcf56','#fff4b0'],confusao:['#52406d','#c395e7','#efe0ff'],zumbi:['#344a39','#8cba70','#d4e8a9'],peixe:['#234d64','#7dbfd8','#d8f4ee'],bolha:['#365879','#8dd7e8','#e5ffff'],canto:['#484b77','#aaa4e6','#f1e9ff'],copia:['#5d4775','#b69cdd','#f2e8ff'],escudo:['#32555e','#86c3bb','#d7f6e9'],amplifica:['#544d80','#e1bc6b','#fff1bb'],recarga:['#6d553d','#cba96e','#f3e4bd'],dino:['#36513e','#7ca062','#d8e6b1'],recusa:['#66364d','#d996a7','#ffe1e3']};
const alias={paralisia:'raio',amplifica:'duplicar',recarga:'runa',dino:'runa'};
const rect=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
let partes=[];
tipos.forEach((tipo,linha)=>{for(let f=0;f<4;f++){
 const[escuro,cor,luz]=cores[tipo];let d=S.glifo(alias[tipo]||tipo).match(/ d="([^"]+)"/)[1];
 if(tipo==='recarga')d='M2 0H14V3H12V6H10V10H12V13H14V16H2V13H4V10H6V6H4V3H2ZM5 3V5H7V7H9V5H11V3ZM7 10V12H5V14H11V12H9V10Z';
 if(tipo==='dino')d='M6 0H10V15H6ZM1 4H4V8H6V11H1ZM12 2H15V9H10V6H12Z';
 let base=`<path d="${d}" fill="${escuro}"/>`;
 base+=`<g transform="translate(${tipo==='peixe'?(f%2):0} ${tipo==='bolha'?1-f%3:0})"><path d="${d}" fill="${cor}"/></g>`;
 const pontos=[[2,2],[12,2],[12,12],[2,12]];
 const [x,y]=pontos[f];base+=rect(x,y,2,1,luz)+rect(x,y,1,2,luz);
 if(tipo==='canto'){base='';for(let k=0;k<4;k++){const h=[4,8,12,8][(k+f)%4];base+=rect(1+k*4,8-h/2,2,h,k%2?luz:cor);}}
 if(tipo==='recarga')base+=rect(7,4+f*2,2,2,luz);
 if(tipo==='confusao')base+=rect(...pontos[(f+2)%4],1,1,luz);
 if(tipo==='zumbi')base+=rect(f%2?5:9,5,2,2,luz);
 partes.push(`<g transform="translate(${16*f} ${16*linha})" clip-path="url(#celula)">${base}</g>`);
}});
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="192" viewBox="0 0 64 192" shape-rendering="crispEdges"><defs><clipPath id="celula"><rect width="16" height="16"/></clipPath></defs>${partes.join('')}</svg>`;
fs.writeFileSync(path.join(__dirname,'../public/assets/efeitos/estados-extra.svg'),svg);
console.log('Atlas de estados gerado: '+tipos.length+' estados, quatro quadros, 16×16 px.');
