// Tempos compartilhados pelo aviso de turno e pelas máquinas.
(function(raiz){
    const ritmo={avisoTurno:4000,inicioIA:4500,entreAcoesIA:3800};
    if(typeof module!=='undefined'&&module.exports)module.exports=ritmo;
    else raiz.RITMO_ARENA=ritmo;
})(typeof window!=='undefined'?window:globalThis);
