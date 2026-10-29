const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../public/motor'),Partida=require('../partida');
const cartas=Array.from({length:40},(_,i)=>({codigo:'dino'+i,nome:'Criatura '+i,classe:'campeão',ataque:2,defesa:100}));
function preparar(modo='multiplayer',n=2){
 const p=new Partida(Array.from({length:n},(_,i)=>({id:'j'+i,nome:'Jogador '+i})),cartas,modo,40),e=p.estado;e.turno=0;
 for(const j of e.jogadores)j.campo.push(j.mao.shift());
 const dino=e.jogadores[0].mao[0];dino.base={...dino.base,codigo:'n022',nome:'Dino do Google',classe:'auxiliar',universo:'game',elemento:'metálico',ataque:0,defesa:0};
 return {p,e,dino,alvo:e.cooperativo?n:1};
}
for(const [modo,n]of [['multiplayer',2],['local',2],['local',4],['coop',4]])test(`Dino passivo dá 4 de dano por três encerramentos próprios: ${modo}/${n}`,()=>{
 const {e,dino,alvo}=preparar(modo,n),a=e.jogadores[0],b=e.jogadores[alvo];
 assert(M.colocarApoio(e,dino.uid).ok);assert.equal(e.acoes,1);assert.equal(b.campo[0].defesa,100);assert.equal(M.ataqueTotal(a.campo[0],b.campo[0].base,e),2);
 assert(M.executarHabilidade(e,dino.uid).erro);
 for(let turno=1;turno<=3;turno++){
  e.alvo=alvo;assert(M.encerrarTurno(e).ok);assert.equal(b.campo[0].defesa,100-4*turno);assert.equal(a.campo[0].defesa,100,'passiva não recebe contra-ataque');
  if(turno<3){assert.equal(dino.st.dino,3-turno);while(e.turno!==0){const defesa=b.campo[0].defesa;assert(M.encerrarTurno(e).ok);assert.equal(b.campo[0].defesa,defesa);}}
 }
 assert.equal(a.apoio.length,0);assert(a.descarte.includes(dino));
});
test('Dino usa alvo selecionado e não causa dano nos aliados ou outros inimigos',()=>{
 const {p,e,dino}=preparar('coop',2);assert(M.colocarApoio(e,dino.uid).ok);
 assert(p.agir('j0',{tipo:'encerrar',alvo:3,revisao:0}).ok);
 assert.equal(p.estado.jogadores[3].campo[0].defesa,96);for(const i of [0,1,2])assert.equal(p.estado.jogadores[i].campo[0].defesa,100);
 assert(p.visao('j1').log.some(l=>l.includes('Dino do Google causou 4 de dano')));
});
for(const classe of ['campeão','besta'])test(`Dino pode encerrar a partida ao derrotar campeão; besta não pontua: ${classe}`,()=>{
 const {e,dino,alvo}=preparar(),b=e.jogadores[alvo];b.campo[0].base.classe=classe;b.campo[0].defesa=4;b.derrotados=2;
 assert(M.colocarApoio(e,dino.uid).ok);const turno=e.numTurno;assert(M.encerrarTurno(e).ok);
 assert.equal(b.campo.length,0);assert.equal(b.derrotados,classe==='campeão'?3:2);assert.equal(e.vencedor,classe==='campeão'?0:null);
 if(classe==='campeão')assert.equal(e.numTurno,turno,'não inicia outro turno após vencer');
});
test('Dino anulado não causa dano mas consome o turno de duração',()=>{
 const {e,dino,alvo}=preparar(),b=e.jogadores[alvo];b.campo[0].base.codigo='n012';
 assert(M.colocarApoio(e,dino.uid).ok);assert(M.encerrarTurno(e).ok);assert.equal(b.campo[0].defesa,100);assert.equal(dino.st.dino,2);
});
test('Dino respeita proteção contra seu elemento e não gera dano',()=>{
 const {e,dino,alvo}=preparar(),b=e.jogadores[alvo];b.campo[0].base.codigo='n037';
 assert(M.colocarApoio(e,dino.uid).ok);assert(M.encerrarTurno(e).ok);assert.equal(b.campo[0].defesa,100);assert.equal(dino.st.dino,2);
});
test('sem alvo o prazo passa, e Dino sai no terceiro encerramento',()=>{
 const {e,dino,alvo}=preparar();e.jogadores[alvo].mao.push(...e.jogadores[alvo].campo.splice(0));assert(M.colocarApoio(e,dino.uid).ok);
 for(let i=0;i<3;i++){assert(M.encerrarTurno(e).ok);if(i<2)assert(M.encerrarTurno(e).ok);}assert(e.jogadores[0].descarte.includes(dino));
});
test('Dino sai com a criatura vinculada antes do prazo e não executa depois',()=>{
 const {e,dino,alvo}=preparar();assert(M.colocarApoio(e,dino.uid).ok);e.jogadores[0].campo[0].defesa=1;e.turno=alvo;e.acoes=2;assert(M.atacar(e).ok);
 const defesa=e.jogadores[alvo].campo[0].defesa;assert(M.encerrarTurno(e).ok);assert(M.encerrarTurno(e).ok);assert.equal(e.jogadores[alvo].campo[0].defesa,defesa);assert(e.jogadores[0].descarte.includes(dino));
});
test('Fuleco amplia Dino para 8 de dano/6 turnos e restauração conserva valores',()=>{
 const {p,e,dino,alvo}=preparar(),a=e.jogadores[0],f=a.mao[1];f.base={...f.base,codigo:'n009',classe:'auxiliar'};assert(M.colocarApoio(e,f.uid).ok);assert(M.colocarApoio(e,dino.uid).ok);
 assert.equal(dino.st.dino,6);assert.equal(dino.st.danoDino,8);
 const r=Partida.restaurar(p.salvar());assert(r.agir('j0',{tipo:'encerrar',revisao:0}).ok);assert.equal(r.estado.jogadores[alvo].campo[0].defesa,92);assert.equal(r.estado.jogadores[0].apoio.find(c=>c.uid===dino.uid).st.dino,5);
});
test('máquina também ativa Dino ao encerrar seu turno por passos',()=>{
 const {p,e}=preparar('coop',1),j=e.jogadores[1],dino=j.mao[0];dino.base={...dino.base,codigo:'n022',classe:'auxiliar'};e.turno=1;
 assert(M.colocarApoio(e,dino.uid).ok);e.acoes=0;assert(p.passoComputador());assert.equal(p.estado.jogadores[0].campo[0].defesa,96);assert(p.log.some(l=>l.includes('causou 4 de dano')));
});
