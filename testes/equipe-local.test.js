const {test}=require('node:test'),assert=require('node:assert/strict');
const Partida=require('../partida'),M=require('../public/motor');
const cartas=[...Array.from({length:48},(_,i)=>({codigo:'equipe'+i,nome:'Campeão '+i,classe:'campeão',ataque:3,defesa:20})),{codigo:'D007',nome:'Rei',classe:'representante',universo:'normal',defesa:400}];
const pessoas=n=>Array.from({length:n},(_,i)=>({id:'p'+i,nome:'Pessoa '+i}));
for(let vagas=1;vagas<=4;vagas++)for(let humanos=1;humanos<=vagas;humanos++)test(`Equipe Local: ${humanos} humano(s), ${vagas-humanos} máquina(s) aliada(s) e ${vagas} adversárias`,()=>{
 const reps=Array.from({length:2*vagas-humanos},(_,i)=>i%2?'D007':null);
 const p=new Partida(pessoas(humanos),cartas,'coop',20,{vagasEquipe:vagas,representantesMaquinas:reps}),e=p.estado;
 assert.equal(p.ids.length,humanos);assert.equal(e.jogadores.length,2*vagas);
 for(const time of[0,1])assert.equal(e.jogadores.filter(j=>j.equipe===time).length,vagas);
 assert.equal(e.jogadores.slice(0,vagas).filter(j=>j.maquina).length,vagas-humanos);
 assert(e.jogadores.slice(vagas).every(j=>j.maquina));
 assert.deepEqual(e.jogadores.slice(humanos).map(j=>j.rep?.codigo||null),reps);
 assert.deepEqual(e.ordemTurnos,Array.from({length:vagas},(_,i)=>[i,i+vagas]).flat());
 const total=M.tamanhoParaParticipantes(20,2*vagas),inicial=e.jogadores.flatMap(j=>[...j.mao,...j.baralho]);
 assert.equal(e.tamanhoBaralho,total);assert.equal(new Set(inicial.map(c=>c.base.codigo)).size,total);
 assert(e.jogadores.every(j=>j.mao.length===3&&j.mao.length+j.baralho.length===total/(2*vagas)));
 assert.equal(p.visao('p0').jogadores[0].mao.length,3);assert(p.visao('p0').jogadores.slice(1).every(j=>j.mao.length===0));
 assert(p.agir('p0',{tipo:'encerrar',revisao:0}).ok);p.jogarComputador();
 assert.equal(p.estado.turno,humanos>1?1:0,'máquinas aliadas e adversárias jogam até o próximo humano');
 const restaurada=Partida.restaurar(JSON.parse(JSON.stringify(p.salvar())));assert.deepEqual(restaurada.visao('p0'),p.visao('p0'));
});
test('vagas e representantes inválidos são recusados antes de distribuir cartas',()=>{
 for(const vagasEquipe of[0,5,1.5,'4'])assert.throws(()=>new Partida(pessoas(1),cartas,'coop',20,{vagasEquipe}),/vagas/);
 assert.throws(()=>new Partida(pessoas(3),cartas,'coop',20,{vagasEquipe:2}),/vagas/);
 assert.throws(()=>new Partida(pessoas(2),cartas,'local',20,{vagasEquipe:2}),/vagas/);
 assert.throws(()=>new Partida(pessoas(1),cartas,'coop',20,{vagasEquipe:3,representantesMaquinas:[null]}),/lista/);
 assert.throws(()=>new Partida(pessoas(1),cartas,'coop',20,{vagasEquipe:1,representantesMaquinas:['equipe0']}),{code:'REPRESENTANTE_INVALIDO'});
});
test('sem configurar vagas, o co-op online mantém uma máquina por humano, sem aliadas extras',()=>{
 const p=new Partida(pessoas(2),cartas,'coop',20);
 assert.equal(p.estado.jogadores.length,4);assert.equal(p.estado.jogadores.filter(j=>j.maquina).length,2);
 assert(p.estado.jogadores.slice(0,2).every(j=>!j.maquina));assert(p.estado.jogadores.slice(2).every(j=>j.maquina));
});
test('eliminação do único humano não encerra a equipe enquanto uma máquina aliada continua',()=>{
 const p=new Partida(pessoas(1),cartas,'coop',20,{vagasEquipe:2}),e=p.estado;
 e.turno=0;e.jogadores[0].derrotados=2;const a=e.jogadores[0].mao.shift(),b=e.jogadores[2].mao.shift();e.jogadores[0].campo=[a];e.jogadores[2].campo=[b];a.defesa=1;a.ataqueBase=1;b.ataqueBase=20;b.defesa=30;
 assert(p.agir('p0',{tipo:'atacar',alvo:2,revisao:0}).ok);assert(p.estado.jogadores[0].eliminado);assert.equal(p.estado.vencedor,null);
 p.jogarComputador();assert.equal(p.estado.vencedor,null);assert(p.estado.jogadores[p.estado.turno].maquina);
});
