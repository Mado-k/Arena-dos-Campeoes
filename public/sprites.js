/* Arte vetorial original desenhada em grades inteiras de 32×32 pixels. */
(function(raiz,fabrica){const api=fabrica();if(typeof module==='object'&&module.exports)module.exports=api;else raiz.ArenaSprites=api;})(typeof window!=='undefined'?window:globalThis,function(){
    'use strict';
    // A animação representa a aplicação da regra; não transforma toda habilidade em ataque.
    const perfis={
        n002:['Caixa de Pandora','caixa','pandora','maldicao','sombrio'],
        n003:['Vingança do Lobo-guará','guara','folhas','ataque','planta'],
        n004:['Lança do Pirarucu','lanca','peixe','anulacao','agua'],
        n005:['Maldição de Atridas','tumulo','ressurreicao','recuperar','sombrio'],
        n006:['Gravity Gun','arma','gravidade','arremesso','metalico'],
        n007:['Cyber Onimaru','katana','corte','arma','sombrio'],
        n008:['Heimdall','guardiao','bifrost','captura','divino'],
        n009:['Fuleco','tatu','duplicar','amplificar','sonoro'],
        n010:['Cachorro Caramelo','cachorro','escudo','protecao','fogo'],
        n011:['Deusa Amaterasu','solar','sol','ataque','fogo'],
        n012:['Iara','sereia','canto','anulacao','sonoro'],
        n013:['Hércules','heroi','forca','reforco','fogo'],
        n014:['Bai Besta','besta','folhas','ataque','planta'],
        n015:['Adão','adao','folhas','protecao','planta'],
        n016:['Toxic Kappa','kappa','veneno','envenenar','agua'],
        n017:['Thor Circuito','martelo','raio','paralisar','metalico'],
        n018:['Valir','cavaleiro','luz','ataque','divino'],
        n019:['Kitsune 100%','raposa','retorno','retornar','sonoro'],
        n020:['Irineu','irineu','confusao','confundir','sonoro'],
        n021:['Batsopra Bolha','bolhas','bolha','anulacao','agua'],
        n022:['Dino do Google','dino','golpe','dino','metalico'],
        n023:['Zord Fenrir','fenrir','heranca','heranca','metalico'],
        n024:['Bagunça de Dados do Saci','saci','redemoinho','reciclar','planta'],
        n025:['Testemunha de Jeová','testemunha','escudo','protecao','divino'],
        n026:['Cobertor','cobertor','escudo','protecao','sombrio'],
        n027:['Dados do Cabelo do Curupira','curupira','fogo','queimar','fogo'],
        n028:['Gorro Verde','gorro','zumbi','zumbificar','sombrio'],
        n029:['Lobisomem','lobisomem','lua','reforco','sonoro'],
        n030:['Ira de Zeus','zeus','raio','feitico','divino'],
        n031:['Pergaminho do Felipe TI','pergaminho','cartas','comprar','neutro'],
        n032:['Marie Curie Zumbi','cientista','defesa','resistencia','sombrio'],
        n033:['Ôni Zumbi','oni','forca','reforco','fantasma'],
        n034:['Guss Deus do Design','designer','copia','copiar','fogo'],
        n035:['Doce Hera','hera','busca','buscar','planta'],
        n036:['Toxic Ran','ran','agua','remover-agua','agua'],
        n037:['Gengar','espectro','fantasma','protecao','fantasma'],
        n038:['Espírito do Benito Mussolini','espirito','recusa','sem-anexos','fantasma'],
        n039:['Gaiamon','gaia','igualar','igualar','divino'],
        n040:['Não Tem Café','cafe','ruptura','destruir','divino'],
        D001:['Inteligência Única','robo','defesa','representante','metalico'],
        D002:['Lord Z','lord','defesa','representante','sombrio'],
        D003:['Merlin','mago','defesa','representante','divino'],
        D004:['O Ditador','uniforme','defesa','representante','neutro'],
        D005:['Canoni','canoni','defesa','representante','sonoro'],
        D006:['Pixel','pixel','defesa','representante','metalico'],
        D007:['Rei da Arena dos Campeões','rei','cura','curar','divino']
    };
    const cores={planta:['#16392f','#4d9b52','#b4e879'],fogo:['#542334','#dc713b','#ffcf72'],agua:['#153957','#368da8','#a1f0e1'],sombrio:['#25223f','#715885','#c6a4cc'],sonoro:['#37305c','#8c72c9','#e9ccff'],divino:['#4d3a35','#c49757','#ffefaa'],metalico:['#233447','#71879b','#cce7eb'],fantasma:['#30254a','#8257af','#d5b7f6'],neutro:['#343746','#8f9ca9','#ecf1ed']};
    function perfil(codigo){const chave=/^d\d{3}$/i.test(codigo||'')?codigo.toUpperCase():codigo;const p=perfis[chave];return p?{codigo:chave,nome:p[0],modelo:p[1],efeito:p[2],acao:p[3],elemento:p[4]}:null;}
    const R=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
    const G=(classe,conteudo)=>`<g class="${classe}">${conteudo}</g>`;
    function glifo(tipo){
        const formas={
            raio:'M9 0H5V7H2V9H7L5 16 14 5H9Z',cura:'M6 1H10V6H15V10H10V15H6V10H1V6H6Z',escudo:'M2 1H14V9H12V12H10V14H6V12H4V9H2ZM5 4V8H7V11H9V8H11V4Z',
            golpe:'M12 0H16V4H13V7H10V10H7V13H4V16H0V12H3V9H6V6H9V3H12Z',corte:'M13 0H16V3H14V6H11V9H8V12H5V15H1V11H4V8H7V5H10V2H13Z',
            agua:'M6 0H10V4H12V6H14V12H12V14H4V12H2V6H4V4H6ZM5 8V11H7V8Z',confusao:'M3 1H13V3H15V11H13V13H5V11H3V5H11V9H7V7H5V11H13V3H3V15H1V3H3Z',
            sol:'M6 0H10V3H13V6H16V10H13V13H10V16H6V13H3V10H0V6H3V3H6Z',runa:'M6 0H10V3H13V6H16V10H13V13H10V16H6V13H3V10H0V6H3V3H6ZM6 5V11H10V5Z',
            peixe:'M3 4H11V6H13V3H16V13H13V10H11V12H3V10H1V6H3ZM3 6V8H5V6Z',bolha:'M4 1H12V3H14V5H15V11H13V13H11V15H5V13H3V11H1V5H3V3H4ZM5 4V6H4V9H6V5H10V4Z',
            cartas:'M1 1H10V3H3V11H1ZM5 4H15V15H5ZM7 6V13H13V6Z',busca:'M2 1H10V3H12V9H10V11H8V13H10V15H14V11H12V9H10V3H4V9H2Z',
            igualar:'M1 4H15V7H1ZM1 10H15V13H1Z',duplicar:'M1 1H6V6H1ZM10 1H15V6H10ZM1 10H6V15H1ZM10 10H15V15H10Z',
            recusa:'M2 0H14V2H16V14H14V16H2V14H0V2H2ZM3 3V6H6V9H9V12H12V9H9V6H6V3Z',
            zumbi:'M3 1H13V3H15V11H12V15H4V11H1V3H3ZM4 5V8H7V5ZM9 5V8H12V5ZM6 11V13H10V11Z',fantasma:'M4 0H12V2H14V6H16V16H12V13H10V16H6V13H4V16H0V6H2V2H4ZM4 5V8H6V5ZM10 5V8H12V5Z',
            heranca:'M6 1H10V4H14V8H10V14H6V8H2V4H6Z',forca:'M2 4H5V1H8V4H11V2H14V5H16V11H14V15H4V12H1V8H2Z',defesa:'M2 1H14V10H12V12H10V15H6V12H4V10H2ZM5 5V8H11V5Z',
            ruptura:'M1 1H7V4H5V7H8V10H5V15H1ZM9 1H15V15H9V12H11V9H8V6H11V3H9Z',
            gravidade:'M1 1H6V4H4V10H6V13H10V10H12V4H10V1H15V11H13V14H10V16H6V14H3V11H1Z',
            retorno:'M5 0H9V3H14V5H16V11H14V13H10V10H13V6H8V9H5V6H2V3H5Z',ressurreicao:'M6 0H10V3H13V6H10V9H6V6H3V3H6ZM2 10H14V15H2Z',
            redemoinho:'M1 1H15V3H3V6H13V8H5V11H11V13H7V16H5V13H3V11H1V8H3V6H1Z',canto:'M2 6H5V10H2ZM6 3H9V13H6ZM10 0H12V16H10ZM13 4H16V12H13Z',
            folhas:'M1 1H9V3H12V6H14V12H10V14H5V12H2V8H1ZM6 7V10H9V7Z',copia:'M0 0H11V3H3V11H0ZM5 5H16V16H5ZM8 8V13H13V8Z',
            lua:'M6 0H12V2H7V5H5V10H7V13H12V15H6V13H3V11H1V4H3V2H6Z',bifrost:'M0 8H2V5H5V2H11V5H14V8H16V15H13V9H11V7H5V9H3V15H0Z'
        };
        return `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="${formas[tipo]||formas.runa}"/></svg>`;
    }
    function desenhar(codigo){
        const p=perfil(codigo);if(!p||p.modelo==='dino')return '';
        const [escuro,medio,claro]=cores[p.elemento],tinta='#151c2b',pele='#deb28a',luz='#f8eed1';let corpo='';
        const r=R, olhos=(x=11,y=10,c=tinta)=>r(x,y,2,2,c)+r(x+7,y,2,2,c);
        function humano({roupa=medio,cabelo=escuro,rosto=pele,armadura=false}={}){
            return G('pix-cabeca',r(10,3,12,3,tinta)+r(8,6,16,8,tinta)+r(10,6,12,9,rosto)+r(9,3,14,4,cabelo)+r(8,6,3,5,cabelo)+r(21,6,3,5,cabelo)+olhos())+
                G('pix-corpo',r(8,16,16,11,tinta)+r(10,16,12,10,roupa)+r(14,16,4,3,claro)+(armadura?r(10,20,12,2,claro):r(10,24,12,2,escuro)))+
                G('pix-bracos',r(5,17,4,9,tinta)+r(6,18,3,6,roupa)+r(5,24,4,3,rosto)+r(23,17,4,9,tinta)+r(23,18,3,6,roupa)+r(23,24,4,3,rosto))+
                G('pix-pernas',r(10,26,5,5,tinta)+r(18,26,5,5,tinta)+r(10,26,4,3,escuro)+r(18,26,4,3,escuro));
        }
        function quadrupede(cor=medio,orelha=claro){return G('pix-corpo',r(4,14,20,11,tinta)+r(5,15,18,8,cor)+r(20,7,10,15,tinta)+r(21,8,8,12,cor)+r(21,4,3,6,orelha)+r(27,4,3,6,orelha)+r(25,11,2,2,luz)+r(27,15,4,3,tinta)+r(1,10,4,11,cor))+G('pix-pernas',r(6,24,4,7,tinta)+r(19,24,4,7,tinta)+r(6,24,3,5,cor)+r(19,24,3,5,cor));}
        switch(p.modelo){
            case 'guara':corpo=quadrupede('#d8803f','#342c37')+r(8,15,9,3,'#f5c575');break;
            case 'cachorro':corpo=quadrupede('#b87a3f','#694333')+r(20,8,3,10,'#88552e')+r(27,8,3,10,'#88552e');break;
            case 'fenrir':corpo=quadrupede('#8295b2','#c9e2e9')+r(7,16,3,6,'#d4e4ee')+r(13,16,3,6,'#d4e4ee')+r(24,11,3,2,'#80f7f6');break;
            case 'raposa':corpo=quadrupede('#e89d56','#f8eee0')+r(1,6,6,16,'#f8eee0')+r(1,8,4,13,'#e89d56')+r(6,8,4,11,'#f8eee0')+r(9,10,3,7,'#e89d56');break;
            case 'besta':corpo=quadrupede('#598b51','#e2d48d')+r(20,1,3,9,'#e7dfb1')+r(28,1,3,9,'#e7dfb1')+r(8,11,4,5,'#a5cc6b');break;
            case 'kappa':corpo=humano({roupa:'#446f49',cabelo:'#376344',rosto:'#8fca62'})+r(10,2,12,2,'#c2ebac')+r(8,4,16,2,'#5a9671')+r(13,13,7,3,'#e1c773')+r(23,16,5,10,'#405947')+r(24,18,2,6,'#b1d488');break;
            case 'tatu':corpo=humano({roupa:'#f2ce69',cabelo:'#315b9e',rosto:'#f0d18a'})+r(7,8,3,6,'#315b9e')+r(22,8,3,6,'#315b9e')+r(8,17,3,9,'#315b9e')+r(21,17,3,9,'#315b9e')+r(12,20,8,4,'#315b9e');break;
            case 'lobisomem':case 'oni':corpo=humano({roupa:escuro,cabelo:medio,rosto:claro})+r(8,0,4,8,medio)+r(21,0,4,8,medio)+r(13,13,7,4,tinta)+r(14,13,2,2,luz)+r(19,13,2,2,luz);if(p.modelo==='oni')corpo+=r(7,0,3,7,'#ffe5b3')+r(23,0,3,7,'#ffe5b3')+r(11,9,3,2,'#e8b47d');break;
            case 'espectro':corpo=G('pix-corpo',r(8,3,16,3,tinta)+r(5,6,22,5,tinta)+r(3,11,26,15,tinta)+r(5,10,22,17,medio)+r(4,23,5,7,medio)+r(12,24,6,7,medio)+r(23,23,5,7,medio)+r(6,3,5,8,medio)+r(21,3,5,8,medio)+r(9,13,4,3,'#dd727d')+r(19,13,4,3,'#dd727d')+r(10,20,12,4,luz)+r(12,20,2,4,tinta)+r(18,20,2,4,tinta));break;
            case 'lanca':corpo=r(14,6,3,25,'#b2b7ad')+r(10,4,11,3,claro)+r(13,1,5,7,claro)+r(10,11,10,3,medio)+r(12,23,7,3,escuro);break;
            case 'katana':corpo=r(7,23,3,7,'#d6b16f')+r(9,17,3,8,tinta)+r(7,20,9,3,claro)+r(12,12,3,8,'#b5b9da')+r(15,9,3,6,'#b5b9da')+r(18,6,3,6,'#b5b9da')+r(21,1,3,8,'#e6edff')+r(15,15,2,3,'#a86bd2');break;
            case 'arma':corpo=r(3,11,23,10,tinta)+r(4,12,20,7,'#a87542')+r(8,14,11,4,'#f2d18b')+r(24,7,4,6,'#70d3ef')+r(24,20,4,6,'#70d3ef')+r(8,21,5,9,'#73899f')+r(11,22,6,3,'#a0b8bb');break;
            case 'caixa':corpo=G('pix-tampa',r(5,7,22,6,tinta)+r(6,8,20,4,'#9a6744')+r(7,8,2,4,'#e4bc6f')+r(23,8,2,4,'#e4bc6f'))+r(5,15,22,14,tinta)+r(6,16,20,12,'#755044')+r(6,20,20,2,'#d4a866')+r(14,18,4,7,'#e8c383')+r(15,20,2,3,tinta)+G('pix-aura',r(13,12,6,3,'#9f85d4'));break;
            case 'tumulo':corpo=r(10,9,12,3,escuro)+r(7,12,18,16,escuro)+r(9,12,14,14,medio)+r(15,15,3,8,claro)+r(12,17,9,3,claro)+r(4,28,24,3,tinta)+r(2,22,5,4,'#82a97d')+r(25,22,5,4,'#82a97d');break;
            case 'martelo':corpo=r(5,4,22,11,tinta)+r(6,5,20,8,'#8aa0b1')+r(7,6,4,6,'#d6e9e5')+r(13,15,5,16,'#836249')+r(14,17,3,3,'#d8b67b')+r(14,24,3,3,'#d8b67b')+r(19,2,2,4,'#88f3ea');break;
            case 'bolhas':corpo=r(7,7,17,8,tinta)+r(8,8,15,5,'#8aa2c9')+r(12,15,4,14,'#d1c781')+r(22,4,5,3,claro)+r(25,7,3,5,claro)+r(22,11,5,3,claro)+r(21,7,2,5,claro);break;
            case 'cobertor':corpo=r(5,5,22,24,tinta)+r(6,6,20,21,'#796e9c')+r(9,6,3,21,'#c9c4e1')+r(20,6,3,21,'#c9c4e1')+r(6,10,20,3,'#a9a0c9')+r(6,21,20,3,'#a9a0c9')+r(7,27,3,3,claro)+r(14,27,3,3,claro)+r(22,27,3,3,claro);break;
            case 'gorro':corpo=r(8,7,16,4,'#355943')+r(6,11,20,12,'#5b9b5d')+r(4,23,24,6,'#a7c981')+r(8,3,5,5,'#b7d59a')+r(10,12,4,8,'#8bc173');break;
            case 'pergaminho':corpo=r(5,5,22,4,'#8e6546')+r(7,8,18,18,'#e4d2a1')+r(4,25,24,5,'#b39668')+r(10,11,12,2,'#746a57')+r(10,16,8,2,'#746a57')+r(10,21,12,2,'#746a57');break;
            case 'pixel':corpo=r(8,4,16,4,'#b1e9e2')+r(5,8,22,14,'#4aa7b7')+r(9,11,4,4,tinta)+r(19,11,4,4,tinta)+r(11,18,10,2,'#b1e9e2')+r(9,23,5,7,'#8cd9cf')+r(18,23,5,7,'#8cd9cf');break;
            default: {
                const roupas={solar:'#c8864b',guardiao:'#b69b62',heroi:'#a26443',adao:'#609f5c',irineu:'#637b98',testemunha:'#455c7a',cientista:'#c2c9be',designer:'#834d87',hera:'#5a977c',ran:'#407e97',espirito:'#8588a9',gaia:'#80b5a1',cafe:'#9b775a',rei:'#a96b69',mago:'#5c68a0',lord:'#715382',robo:'#759da5'};
                corpo=humano({roupa:roupas[p.modelo]||medio,cabelo:p.modelo==='cientista'?'#a8c09b':escuro,rosto:['ran','cientista','lord'].includes(p.modelo)?'#a0b998':pele,armadura:['cavaleiro','guardiao','robo','rei'].includes(p.modelo)});
                if(['solar','hera','gaia'].includes(p.modelo))corpo+=r(6,2,20,2,claro)+r(5,0,3,6,medio)+r(24,0,3,6,medio);
                if(p.modelo==='sereia')corpo=humano({roupa:'#7486bb',cabelo:'#244857'})+r(10,26,12,3,'#619e9e')+r(7,29,7,3,'#a1e4d1')+r(19,29,7,3,'#a1e4d1');
                if(p.modelo==='curupira')corpo=humano({roupa:'#53764a',cabelo:'#ef8b3d'})+r(9,1,3,4,'#ffcd58')+r(15,0,3,4,'#ffcd58')+r(21,1,3,4,'#ffcd58');
                if(p.modelo==='saci')corpo=humano({roupa:'#b1624d',cabelo:'#b44542',rosto:'#a66c4d'})+r(11,0,10,4,'#d3675a')+r(10,27,5,5,'#a66c4d')+r(18,27,5,5,'#151c2b');
                if(p.modelo==='zeus')corpo=humano({roupa:'#dfd8b9',cabelo:'#efeadc'})+r(10,13,12,5,'#efeadc')+r(3,10,3,11,'#f5d875');
                if(p.modelo==='irineu')corpo+=r(9,11,6,2,'#282b38')+r(17,11,6,2,'#282b38')+r(14,13,5,2,'#574334');
                if(p.modelo==='designer')corpo+=r(1,18,6,8,'#bd87c3')+r(2,19,2,2,'#ffca74')+r(4,22,2,2,'#8fe4d8');
                if(p.modelo==='ran')corpo+=r(6,4,4,12,'#3e4e76')+r(22,4,4,12,'#3e4e76')+r(4,20,4,7,'#94e0d0')+r(24,20,4,7,'#94e0d0');
                if(['mago','rei','lord'].includes(p.modelo))corpo+=r(7,25,18,5,escuro);
                if(p.modelo==='mago')corpo+=r(13,0,6,3,'#8994c2')+r(9,3,14,3,'#8994c2')+r(26,7,2,24,'#b2996f')+r(24,4,6,5,'#c4e5df');
                if(p.modelo==='rei')corpo+=r(9,0,3,5,'#f2d184')+r(15,0,3,5,'#f2d184')+r(21,0,3,5,'#f2d184')+r(9,4,15,3,'#d9ae59');
                if(p.modelo==='cafe')corpo+=r(23,18,7,7,'#eee3c7')+r(24,18,5,2,'#302b33')+r(29,20,3,3,'#eee3c7');
                if(p.modelo==='espirito')corpo+=r(9,27,4,4,claro)+r(19,27,4,4,claro);
            }
        }
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true">${corpo}</svg>`;
    }
    return {perfis,perfil,desenhar,glifo,cores};
});
