const {test}=require('node:test'),assert=require('node:assert/strict'),Partida=require('../partida'),M=require('../public/motor');
const cartas=Array.from({length:40},(_,i)=>({codigo:'sorteio'+i,nome:'Campeão '+i,classe:'campeão',ataque:3,defesa:20}));
const pessoas=Array.from({length:4},(_,i)=>({id:'p'+i,nome:'Pessoa '+i}));
for(const sorte of [.1,.3,.6,.9])test('sorteio escolhe arena e primeiro participante: '+sorte,t=>{
 t.mock.method(Math,'random',()=>sorte);const p=new Partida(pessoas,cartas,'multiplayer',40,{formato:'2v2'}),e=p.estado;
 const primeiro=Math.floor(sorte*4);assert.equal(e.turno,primeiro);assert.equal(e.arenaInicial,Math.floor(primeiro/2)+1);
 assert.deepEqual(e.arenas2v2,[[0,1],[2,3]]);assert.equal(e.ordemTurnos[0],primeiro);assert.equal(new Set(e.ordemTurnos).size,4);
 for(let k=0;k<4;k++){assert.equal(e.turno,e.ordemTurnos[k]);assert.equal(M.indiceOponente(e),e.arenas2v2.find(a=>a.includes(e.turno)).find(i=>i!==e.turno));assert(M.encerrarTurno(e).ok);}
 assert.equal(e.turno,primeiro);assert.deepEqual(Partida.restaurar(p.salvar()).visao('p0'),p.visao('p0'));
});
test('2v2 mantém escolha de alvo além do adversário espelhado',()=>{
 const p=new Partida(pessoas,cartas,'multiplayer',40,{formato:'2v2'}),e=p.estado;e.turno=0;e.alvo=3;assert.equal(M.indiceOponente(e),3);
});
test('sorteio também pode começar por uma máquina no Local solo 2v2',t=>{
 t.mock.method(Math,'random',()=>.9);const p=new Partida([pessoas[0]],cartas,'local',40,{formato:'2v2',maquinas:3});assert.equal(p.estado.turno,3);assert(p.estado.jogadores[3].maquina);
});
