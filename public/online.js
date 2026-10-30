// Mesa online com a mesma organização visual do offline.
// O servidor continua sendo a única autoridade sobre as ações e as cartas privadas.
(function () {
    'use strict';
    const el = (tag, texto, classe) => {
        const n = document.createElement(tag);
        if (texto !== undefined) n.textContent = texto;
        if (classe) n.className = classe;
        return n;
    };
    window.criarMesaOnline = function (socket, { aoMostrar = () => {}, aoSair = () => {}, aoAbrirDescarte = () => {}, aoConfirmarInicio = () => {}, aoAlternarVisualizacao = () => {}, visaoLinearInicial, confirmarInicioTurno = () => true, exibirResultadoPadrao = true, compartilhada = false } = {}) {
        const mesa = el('section', undefined, 'jogo mesa-online');
        mesa.hidden = true;
        mesa.setAttribute('aria-label', 'Mesa da partida online');
        mesa.tabIndex = -1;
        const movimentos = criarMovimentosMesa(mesa);
        const efeitos = typeof criarEfeitosMesa === 'function' ? criarEfeitosMesa(mesa,{capturarVista,restaurarVista}) : null;
        let animando=false,processando=false,geracaoFila=0,fila=[],estadoEmAnimacao=null,animacoesLiberadasEm=0;
        document.querySelector('main').append(mesa);
        const escolha = document.createElement('dialog');
        escolha.className = 'escolha-online';
        escolha.setAttribute('aria-label', 'Escolha da habilidade');
        const descarte = document.createElement('dialog');
        descarte.className = 'descarte-online';
        descarte.setAttribute('aria-label', 'Descarte');
        const resultado = document.createElement('dialog');
        resultado.className = 'escolha-online resultado-partida';
        resultado.setAttribute('aria-label', 'Resultado da partida');
        const tituloResultado = el('h2');
        const textoResultado = el('p', '', 'suave');
        const botoesResultado = el('div', undefined, 'resultado-botoes');
        const votosResultado = el('p', '', 'suave');
        let respondeuRevanche = false;
        const jogarNovamente = botao('Jogar novamente', pedirRevanche, true, 'btn primario');
        botoesResultado.append(
            botao('Ver tabuleiro', () => { fecharDialogo(resultado); mesa.focus({ preventScroll: true }); }, true, 'btn'),
            botao('Voltar ao lobby', () => { resultado.close(); aoSair(); }, true, 'btn'), jogarNovamente);
        resultado.append(el('p', 'Partida encerrada', 'selo'), tituloResultado, textoResultado, votosResultado, botoesResultado);
        document.body.append(escolha, descarte, resultado);
        socket.on('partida:revanche', dados => {
            votosResultado.textContent = dados.indisponivel ? 'Um jogador saiu. Volte ao lobby para preparar outra partida.' : `${dados.votos} de ${dados.total} jogadores querem jogar novamente.`;
            if (dados.indisponivel) jogarNovamente.disabled = true;
        });
        let estado = null, ocupado = false, pausada = false, selecionada = null, sessao = 0, alvoSelecionado = null, resultadoMostrado = false;
        let ultimoToqueCarta=null,timerDescricao;
        function cancelarDescricao(){clearTimeout(timerDescricao);timerDescricao=null;}
        function cancelarToques(){ultimoToqueCarta=null;cancelarDescricao();}
        // arena-foco é a classe interna da disposição linear; seu nome público é Tabuleiro completo.
        let visaoLinear=visaoLinearInicial??matchMedia('(max-width:760px)').matches,espectadorAvisado=false;
        const espectador=document.createElement('dialog');espectador.className='escolha-online resultado-partida';espectador.setAttribute('aria-label','Acompanhar a final');
        espectador.append(el('h2','Você foi eliminado'),el('p','A próxima rodada começou. Quer assistir aos classificados ou sair da sala?','suave'));
        const opcoesEspectador=el('div',undefined,'resultado-botoes');opcoesEspectador.append(botao('Assistir',()=>fecharDialogo(espectador)),botao('Sair da sala',()=>{espectador.close();aoSair();}));espectador.append(opcoesEspectador);document.body.append(espectador);
        let resultadoPendente=false,timerResultado,rolagemTurnoAte=0,interacoesRolagem=0;
        let retornoVista=null,timerFocoMaquina,revisaoVista=0;
        function cancelarPasseio(){clearTimeout(timerFocoMaquina);retornoVista=null;rolagemTurnoAte=0;}
        for(const evento of ['wheel','touchmove','pointerdown','keydown'])window.addEventListener(evento,()=>{interacoesRolagem++;efeitos?.interromperCamera();cancelarPasseio();if(evento!=='pointerdown')cancelarDescricao();},{passive:true});
        window.addEventListener('pointerdown',evento=>{if(!evento.target.closest?.('[data-carta]'))cancelarToques();},{passive:true});
        for(const dialogo of [escolha,descarte,resultado,espectador])dialogo.addEventListener('cancel',evento=>{evento.preventDefault();fecharDialogo(dialogo);});
        const aviso = el('p', '', 'instrucao');
        aviso.setAttribute('role', 'status');
        const turnos = criarAvisosTurno(() => agir('encerrar'),{aoConfirmar:()=>{render();aoConfirmarInicio();},preservarVista:acao=>{const vista=capturarVista();acao();restaurarVista(vista);}});

        function capturarVista(){
            if(mesa.hidden)return null;
            const janela=mesa.querySelector('.arena-janela');
            const fileiras=[...mesa.querySelectorAll('[data-zona] .fileira')].map(n=>({
                jogador:n.closest('[data-jogador]').dataset.jogador,zona:n.closest('[data-zona]').dataset.zona,x:n.scrollLeft,y:n.scrollTop
            }));
            return {x:scrollX,y:scrollY,mesa:janela?{x:janela.scrollLeft,y:janela.scrollTop}:null,fileiras};
        }
        function restaurarVista(vista){
            if(!vista||mesa.hidden)return;
            const geracao=sessao,interacao=interacoesRolagem,revisao=++revisaoVista;
            const restaurar=()=>{
                if(geracao!==sessao||interacao!==interacoesRolagem||revisao!==revisaoVista||mesa.hidden)return;
                const janela=mesa.querySelector('.arena-janela');
                if(janela&&vista.mesa)janela.scrollTo({left:vista.mesa.x,top:vista.mesa.y,behavior:'instant'});
                restaurarFileiras(vista);
                window.scrollTo({left:vista.x,top:vista.y,behavior:'instant'});
            };
            restaurar();requestAnimationFrame(restaurar);
        }
        function restaurarFileiras(vista){
            for(const f of vista?.fileiras||[]){
                mesa.querySelector(`[data-jogador="${f.jogador}"] [data-zona="${f.zona}"] .fileira`)?.scrollTo({left:f.x,top:f.y,behavior:'instant'});
            }
        }
        function fecharDialogo(dialogo){const vista=capturarVista();dialogo.close();restaurarVista(vista);}

        function pedirRevanche() {
            if (!estado || estado.vencedor === null || respondeuRevanche) return;
            const geracao = sessao;
            respondeuRevanche = true; jogarNovamente.disabled = true;
            votosResultado.textContent = 'Aguardando a confirmação para jogar novamente…';
            socket.timeout(10000).emit('partida:revanche', true, (err, res) => {
                if (geracao !== sessao) return;
                if (err || res?.erro) {
                    respondeuRevanche = false; jogarNovamente.disabled = false;
                    votosResultado.textContent = res?.erro || 'Não foi possível confirmar. Tente novamente.';
                }
            });
        }
        function mostrarResultado() {
            const vista=capturarVista();
            espectador.close();
            if (!exibirResultadoPadrao || !estado || estado.vencedor === null) return;
            const venceu = estado.cooperativo ? estado.vencedor === estado.equipes[estado.voce] : estado.vencedor === estado.voce;
            const equipe = estado.cooperativo && estado.jogadores.some((_,i)=>i!==estado.voce&&estado.equipes[i]===estado.equipes[estado.voce]);
            tituloResultado.textContent = estado.vencedor === -1 ? 'Empate!' : compartilhada && estado.equipes2v2 ? `A equipe ${estado.vencedor+1} venceu!` : compartilhada && !estado.cooperativo
                ? estado.jogadores[estado.vencedor].nome + ' venceu!'
                : venceu ? equipe ? 'Sua equipe venceu!' : 'Você venceu!'
                : equipe ? 'Sua equipe foi derrotada' : 'Você perdeu';
            textoResultado.textContent = estado.motivoEmpate || 'Você pode consultar o tabuleiro, voltar ao lobby ou jogar novamente. A revanche entre jogadores precisa da confirmação dos participantes.';
            resultadoMostrado = true;
            escolha.close(); descarte.close(); turnos.limpar();
            if (!resultado.open) resultado.showModal();
            restaurarVista(vista);
        }

        function ativo() {
            return estado && estado.turno === estado.voce && estado.vencedor === null && !estado.jogadores[estado.voce].eliminado && !estado.torneio?.aguardando.includes(estado.voce) && !ocupado && !animando && !pausada && !turnos.aguardandoConfirmacao();
        }
        function botao(texto, acao, habilitado = true, classe = 'btn pequeno') {
            const b = el('button', texto, classe);
            b.type = 'button'; b.disabled = !habilitado;
            b.addEventListener('click', acao);
            return b;
        }
        function agir(tipo, uid, valor) {
            if (!ativo()) return;
            const vista=capturarVista();
            const pedidoSessao = sessao;
            cancelarToques();
            ocupado = true;
            escolha.close();
            render(vista);
            socket.timeout(10000).emit('partida:acao', { tipo, uid, escolha: valor, revisao: estado.revisao, ...((estado.cooperativo || estado.todosContraTodos) ? { alvo: alvoSelecionado } : {}) }, (err, res) => {
                if (!estado || pedidoSessao !== sessao) return;
                ocupado = false;
                aviso.textContent = err ? 'Não foi possível confirmar a ação. Sincronizando a mesa…' : res.erro || '';
                if (err) socket.emit('partida:sincronizar');
                render();
                if (res && res.pergunta) {
                    const vistaEscolha=capturarVista();
                    escolha.setAttribute('aria-label','Escolha da habilidade');
                    escolha.replaceChildren(el('h2', res.pergunta.titulo));
                    const opcoes = el('div', undefined, 'escolha-opcoes');
                    for (const o of res.pergunta.opcoes) opcoes.append(botao(o.rotulo, () => agir(tipo, uid, o.valor)));
                    escolha.append(opcoes, botao('Cancelar', () => fecharDialogo(escolha)));
                    escolha.showModal();
                    restaurarVista(vistaEscolha);
                }
            });
        }
        function selecionar(uid) {
            const vista=capturarVista();
            selecionada = uid;
            if(descarte.open)descarte.close();
            const painel=mesa.querySelector('.detalhe-online');
            if(painel)painel.replaceWith(detalhe());else render();
            for(const carta of mesa.querySelectorAll('[data-carta]')){
                const marcada=carta.dataset.carta===String(uid);
                carta.classList.toggle('selecionada',marcada);
                if(carta.hasAttribute('aria-pressed'))carta.setAttribute('aria-pressed',String(marcada));
            }
            restaurarVista(vista);
        }
        function arte(base) {
            const caixa = el('div', undefined, 'c-arte');
            const inicial = () => caixa.append(el('span', (base.nome || '?').charAt(0).toUpperCase(), 'inicial'));
            if (!base.imagem) {
                if(base.codigo==='n022'){const dino=el('span',undefined,'sprite-dino retrato-dino');dino.setAttribute('aria-hidden','true');caixa.append(dino);}
                else if(window.ArenaSprites?.perfil(base.codigo)){const retrato=el('span',undefined,'retrato-pixel');retrato.innerHTML=ArenaSprites.desenhar(base.codigo);retrato.setAttribute('aria-hidden','true');caixa.append(retrato);}
                else inicial();
                return caixa;
            }
            const img = document.createElement('img');
            try { img.src = fonteImagemCarta(base.imagem); }
            catch { inicial(); return caixa; }
            if(base.imagem.startsWith('/assets/cartas/'))img.classList.add('pixelart-carta');
            img.alt = ''; img.loading = 'lazy';
            img.addEventListener('error', () => { img.remove(); inicial(); }, { once: true });
            caixa.append(img);
            return caixa;
        }
        function stats(c, grande = false) {
            const dono = estado.jogadores.findIndex(j => j.campo.some(x => x.uid === c.uid));
            const alvo = dono >= 0 ? (dono === estado.voce && Motor.adversarios(estado, dono).includes(alvoSelecionado) ? alvoSelecionado : Motor.indiceOponente(estado, dono)) : -1;
            const ataque = dono >= 0 ? Motor.ataqueTotal(c, estado.jogadores[alvo]?.campo[0]?.base, estado) : c.base.ataque;
            const n = el('div', undefined, 'c-stats' + (grande ? ' grande' : ''));
            n.append(el('span', `ATQ ${ataque}`, 'd'), el('span', `DEF ${c.defesa}`, 'v'));
            return n;
        }
        function selo(d) {
            return el('span', d.tipo === 'ativa' ? '⚡ Ativa' : d.tipo === 'passiva' ? '● Passiva' : 'Sem habilidade', 'tipo-hab ' + d.tipo);
        }
        function etiquetas(c) {
            const linha = el('div', undefined, 'etqs');
            const efeitos = { veneno: 'Envenenada', queimadura: 'Pegando fogo', paralisia: 'Paralisada', confusao: 'Confusa', zumbi: 'Zumbi', dino: 'Turnos do Dino', copia: 'Habilidade copiada' };
            for (const k of Object.keys(efeitos)) if (c.st[k]) linha.append(el('span', efeitos[k] + (k==='paralisia'?` · ${Number(c.st[k])} ação(ões) do dono`:k==='confusao'?` · ${Number(c.st[k])} turno(s)`: ''), 'etq ' + (['dino', 'copia'].includes(k) ? 'bom' : 'ruim')));
            if (Motor.fatorHabilidade(estado,c) === 2) linha.append(el('span','Efeitos ×2','etq bom'));
            if(c.base.codigo==='n002')linha.append(el('span', Motor.descartePermanente(c)?(estado.jogadores.some(j=>j.feiticos?.some(f=>f.uid===c.uid))?'Último uso ativo · descarte permanente ao terminar':'Descarte permanente · 3/3 usos'):'Pandora: '+(c.usos.n002||0)+'/3 usos', 'etq'));
            if(c.st.dino)linha.append(el('span',c.st.dino+' turno(s) restantes · '+(c.st.danoDino||4)+' de dano a cada 2 turnos · próximo em '+(c.st.dino%2===0?2:1)+' turno(s)','etq'));
            if (c.rec) linha.append(el('span', 'Recarga: ' + c.rec, 'etq'));
            if (c.habilidade?.anulada || /peixes/.test(c.habilidade?.motivo || '')) linha.append(el('span', /peixes/.test(c.habilidade.motivo) ? 'Peixe' : 'Habilidade anulada', 'etq ruim'));
            return linha;
        }
        function estadosAnimados(c) {
            const linha=el('div',undefined,'estados-pixel');
            for(const [chave,tipo,nome]of [['queimadura','fogo','Fogo'],['veneno','veneno','Veneno']]){
                if(!c.st[chave])continue;
                const dano=Number(c.st[chave]);
                const efeito=el('span',undefined,'estado-pixel '+tipo),sprite=el('span',undefined,'sprite-estado sprite-'+tipo);
                sprite.setAttribute('aria-hidden','true');efeito.append(sprite,el('span',nome));
                efeito.title=nome+': '+(Number.isFinite(dano)?dano:'')+' de dano no início do turno do dono.';
                efeito.setAttribute('aria-label',efeito.title);linha.append(efeito);
            }
            const extras=[];
            if(c.st.paralisia)extras.push(['paralisia','Paralisia · '+c.st.paralisia+' ações']);
            if(c.st.confusao)extras.push(['confusao','Confusão']);
            if(c.st.zumbi)extras.push(['zumbi','Zumbi']);
            if(c.habilidade?.anulada&&!c.st.paralisia){const motivo=c.habilidade.motivo||'';extras.push([/paralisad/.test(motivo)?'paralisia':/peixes/.test(motivo)?'peixe':/bolhas/.test(motivo)?'bolha':'canto',/paralisad/.test(motivo)?'Paralisia':/peixes/.test(motivo)?'Peixe':/bolhas/.test(motivo)?'Distraído':'Anulada']);}
            if(c.st.copia)extras.push(['copia','Cópia']);
            if(c.rec)extras.push(['recarga','Recarga · '+c.rec]);
            if(c.st.dino)extras.push(['dino-estado','Dino · '+c.st.dino]);
            if(c.base.codigo==='n009'&&!c.habilidade?.anulada)extras.push(['amplifica','Efeitos ×2']);
            for(const [tipo,nome]of extras){
                const efeito=el('span',undefined,'estado-pixel estado-'+tipo),sprite=el('span',undefined,'sprite-estado-extra sprite-'+tipo);
                sprite.setAttribute('aria-hidden','true');efeito.title=nome;efeito.setAttribute('aria-label',nome);efeito.append(sprite,el('span',nome));linha.append(efeito);
            }
            return linha.childElementCount?linha:null;
        }
        function localizar(uid = selecionada) {
            for (let dono = 0; dono < estado.jogadores.length; dono++) for (const zona of ['mao', 'campo', 'apoio', 'descarte','feiticos']) {
                for (const c of estado.jogadores[dono][zona]||[]) {
                    if (c.uid === uid) return { c, dono, zona };
                    for (const eq of c.equip) if (eq.uid === uid) return { c: eq, dono, zona: 'equip' };
                }
            }
            return null;
        }
        function detalhe() {
            const painel = el('div', undefined, 'painel detalhe-online');
            painel.tabIndex=-1;
            const encontrada = localizar();
            if (!encontrada) {
                painel.append(el('p', 'Um toque leva à descrição após 0,8 s. Dois toques em até 0,6 s jogam uma carta da mão ou usam uma habilidade ativa sua em campo.', 'painel-vazio'));
                return painel;
            }
            const { c, dono, zona } = encontrada, d = Motor.descricao(c.base);
            const lugares = { mao: 'na mão', campo: 'em batalha', apoio: 'em apoio', equip: 'equipada', descarte: 'no descarte', feiticos:'em efeito ativo' };
            painel.dataset.elemento = Motor.norm(c.base.elemento) || 'neutro';
            painel.append(el('p', `${c.base.codigo || 'Carta #' + c.base.numero} · ${lugares[zona]}${dono !== estado.voce ? ' · de ' + estado.jogadores[dono].nome : ''}`, 'codigo'), el('h3', c.base.nome));
            const chips = el('div', undefined, 'chips');
            for (const v of [c.base.classe, c.base.elemento, c.base.universo, c.base.origem].filter(Boolean)) chips.append(el('span', v, 'chip'));
            painel.append(chips, stats(c, true), etiquetas(c));
            const estadosDetalhe=estadosAnimados(c);if(estadosDetalhe)painel.append(estadosDetalhe);
            if (zona === 'campo') painel.append(el('p', `Defesa máxima: ${c.defesaMax}`, 'suave'));
            if (c.equip.length) painel.append(el('p', 'Equipado: ' + c.equip.map(e => e.base.nome).join(', '), 'nota'));
            const habilidade = el('div', undefined, 'hab-box ' + d.tipo);
            const cab = el('div', undefined, 'hab-cab');
            cab.append(el('span', 'Habilidade', 'titulo-hab'), selo(d));
            habilidade.append(cab, el('p', d.texto || 'Esta carta não tem habilidade adicional.', 'habilidade'));
            if (d.detalhe) habilidade.append(el('p', 'Como funciona: ' + d.detalhe, 'hab-detalhe'));
            const sua = dono === estado.voce;
            const pode = ativo() && sua && estado.acoes > 0;
            if (sua && d.tipo === 'ativa' && zona !== 'descarte') {
                const h = c.habilidade || {};
                habilidade.append(botao('⚡ ' + (d.botao || 'Executar habilidade'), () => agir('habilidade', c.uid), pode && h.disponivel, 'btn habilidade-btn'));
                if (h.motivo) habilidade.append(el('p', h.motivo, 'nota'));
            } else if (d.tipo === 'passiva') habilidade.append(el('p', c.habilidade?.anulada ? c.habilidade.motivo : d.semEfeito ? 'Já está refletida nos atributos da carta.' : 'Funciona sozinha: o jogo aplica quando for preciso.', 'nota'));
            painel.append(habilidade);
            const acoes = el('div', undefined, 'acoes-painel');
            if (sua && zona === 'mao') {
                const cl = Motor.classeDe(c);
                if (Motor.ehCriatura(c)) acoes.append(botao('Colocar em batalha', () => agir('invocar', c.uid), pode, 'btn primario'));
                if (cl === 'auxiliar') {
                    const temCriatura=estado.jogadores[estado.voce].campo.length>0;
                    acoes.append(botao('Colocar em apoio', () => agir('apoio', c.uid), pode&&temCriatura, 'btn primario'));
                    if(!temCriatura)acoes.append(el('p','Coloque um campeão ou besta em batalha antes de usar auxiliares.','nota'));
                }
                if (['arma', 'item'].includes(cl) && !Motor.consumivel(c)) acoes.append(botao('Equipar', () => agir('equipar', c.uid), pode, 'btn primario'));
            }
            if (sua && zona === 'campo') {
                const alvo = estado.jogadores[alvoSelecionado ?? Motor.indiceOponente(estado, estado.voce)]?.campo[0];
                const dano = alvo ? Motor.ataqueTotal(c, alvo.base, estado) : null;
                const nomeAlvo = (estado.cooperativo || estado.todosContraTodos) && alvo ? ` · ${estado.jogadores[alvoSelecionado].nome}` : '';
                acoes.append(botao('Atacar criatura inimiga' + nomeAlvo + (alvo ? ` · ${dano} de dano` : ''), () => agir('atacar'), pode && Boolean(alvo) && !(c.st.paralisia > 0), 'btn primario'));
                if(c.st.paralisia > 0)painel.append(el('p','Sua criatura está paralisada: não pode atacar, contra-atacar nem usar habilidades. Você ainda pode comprar ou jogar outras cartas permitidas.','nota'));
                acoes.append(botao('Eliminar carta',()=>confirmarEliminacao(c),pode,'btn eliminar-carta'));
                if (!alvo) painel.append(el('p', 'O alvo selecionado não tem criatura em batalha para atacar.', 'nota'));
            }
            if (acoes.childNodes.length) painel.append(acoes);
            if (!ativo() && estado.vencedor === null) painel.append(el('p', 'Aguarde seu turno para jogar. Você pode continuar consultando as cartas.', 'nota'));
            return painel;
        }
        function jogarDaMao(uid){
            const encontrada=localizar(uid);
            if(!encontrada||encontrada.dono!==estado.voce||encontrada.zona!=='mao'||!ativo()||estado.acoes<=0)return;
            const c=encontrada.c,classe=Motor.classeDe(c);
            if(Motor.ehCriatura(c))agir('invocar',uid);
            else if(classe==='auxiliar')agir('apoio',uid);
            else if(Motor.consumivel(c)||classe==='feitico')agir('habilidade',uid);
            else if(['arma','item'].includes(classe))agir('equipar',uid);
        }
        function executarPorToques(uid){
            const encontrada=localizar(uid);
            if(!encontrada||encontrada.dono!==estado.voce||!ativo()||estado.acoes<=0)return false;
            if(encontrada.zona==='mao'){jogarDaMao(uid);return true;}
            const h=Motor.descricao(encontrada.c.base);
            if(h.tipo==='ativa'&&h.local.includes(encontrada.zona)){
                agir('habilidade',uid);return true;
            }
            return false;
        }
        function mostrarDescricaoDepois(uid){
            const geracao=sessao,numTurno=estado.numTurno;
            timerDescricao=setTimeout(()=>{
                timerDescricao=null;
                if(geracao!==sessao||!estado||estado.numTurno!==numTurno||selecionada!==uid||mesa.hidden||pausada||document.querySelector('dialog[open]'))return;
                cancelarPasseio();revisaoVista++;
                const painel=mesa.querySelector('.detalhe-online');
                painel?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
                painel?.focus({preventScroll:true});
            },800);
        }
        function tocarCarta(uid,evento){
            if(animando)return;
            const instante=performance.now();
            const duplo=evento.detail!==0&&ultimoToqueCarta?.uid===uid&&instante-ultimoToqueCarta.instante<=600;
            ultimoToqueCarta=evento.detail===0||duplo?null:{uid,instante};
            cancelarDescricao();
            selecionar(uid);
            if(!duplo||!executarPorToques(uid))mostrarDescricaoDepois(uid);
        }
        function carta(c) {
            const b = botao('', evento => tocarCarta(c.uid,evento), true, 'c carta-online' + (c.uid === selecionada ? ' selecionada' : '')+(c.st.paralisia>0?' paralisada':''));
            b.dataset.carta = String(c.uid);
            b.dataset.elemento = Motor.norm(c.base.elemento) || 'neutro';
            b.dataset.classe = Motor.classeDe(c);
            b.setAttribute('aria-label', c.base.nome);
            b.setAttribute('aria-pressed', String(c.uid === selecionada));
            const topo = el('div', undefined, 'c-topo');
            topo.append(el('span', c.base.elemento || ''));
            const d = Motor.descricao(c.base);
            b.title=[c.base.nome,c.base.classe,d.texto,'Um toque: descrição após 0,8 s. Dois em até 0,6 s: jogar da mão ou usar habilidade ativa própria.'].filter(Boolean).join(' · ');
            const leitura=el('div',undefined,'c-leitura'),textos=el('div',undefined,'c-textos');
            textos.append(el('span',Motor.tituloNome(c.base.classe),'classe-carta'),el('p', c.base.nome, 'c-nome'));
            const estadosCarta=estadosAnimados(c);if(estadosCarta)textos.append(estadosCarta);
            textos.append(stats(c), el('p', d.texto, 'c-desc'), selo(d), etiquetas(c));
            leitura.append(textos);
            b.append(topo, arte(c.base), leitura);
            return b;
        }
        function zona(titulo, cartas, { limite, dica = '', apoio = false, campo = false } = {}) {
            const s = el('section', undefined, 'fileira-wrap' + (apoio ? ' apoio' : ''));
            if (campo) s.dataset.zona = apoio ? 'apoio' : 'campo';
            const h = el('h4', titulo + (limite === undefined ? ` (${cartas.length})` : ` (${cartas.length}/${limite})`));
            if (dica) h.append(el('span', ' · ' + dica, 'dica-fileira'));
            s.append(h);
            const lista = el('div', undefined, 'fileira cartas-online');
            for (const c of cartas) {
                const grupo = el('div', undefined, 'c-wrap');
                grupo.append(carta(c));
                if (c.equip.length) {
                    const equips = el('div', undefined, 'equips');
                    for (const eq of c.equip) {
                        const b = botao('+ ' + eq.base.nome, evento => tocarCarta(eq.uid,evento), true, 'equip' + (eq.uid === selecionada ? ' selecionada' : ''));
                        b.dataset.carta = String(eq.uid);
                        b.dataset.elemento = Motor.norm(eq.base.elemento) || 'neutro';
                        equips.append(b);
                    }
                    grupo.append(equips);
                }
                lista.append(grupo);
            }
            if (!campo || !cartas.length) {
                for (let i = cartas.length; i < (limite || 0); i++) lista.append(el('div', 'vazio', 'slot-vazio'));
            }
            if (!cartas.length && limite === undefined) lista.append(el('p', 'Nenhuma carta.', 'mao-escondida'));
            s.append(lista);
            return s;
        }
        function abrirDescarte(i) {
            const vista=capturarVista();
            const j = estado.jogadores[i];
            descarte.replaceChildren(el('h2', `Descarte de ${j.nome}`), zona('Cartas descartadas', j.descarte), botao('Fechar', () => fecharDialogo(descarte)));
            descarte.showModal();
            restaurarVista(vista);
            aoAbrirDescarte(i);
        }
        function confirmarEliminacao(c){
            if(!ativo()||estado.acoes<=0)return;
            const vista=capturarVista(),campeao=Motor.ehCampeao(c);
            escolha.setAttribute('aria-label','Confirmar eliminação');
            const texto=`Eliminar ${c.base.nome} custa uma ação. A criatura, seus equipamentos e auxiliares vinculados irão para o descarte. ${campeao?'Você receberá uma derrota na sua própria contagem de campeões.':'Por ser uma besta, não altera a contagem de campeões.'}${campeao&&estado.jogadores[estado.voce].derrotados>=2?' Esta será sua terceira derrota de campeão.':''}`;
            escolha.replaceChildren(el('h2','Eliminar sua carta?'),el('p',texto),botao('Confirmar eliminação',()=>agir('eliminar',c.uid),true,'btn eliminar-carta'),botao('Cancelar',()=>fecharDialogo(escolha)));
            escolha.showModal();restaurarVista(vista);
        }
        function verso() {
            const c = el('div', undefined, 'carta-verso');
            c.setAttribute('aria-hidden','true');c.append(el('span','A','verso-emblema'));return c;
        }
        function maoComPilhas(i) {
            const j=estado.jogadores[i],sua=i===estado.voce;
            const recuperaveis=d=>d.descarte.filter(c=>!Motor.descartePermanente(c)).length;
            const grupo=estado.torneio?[i,...Motor.adversarios(estado,i)].map(k=>estado.jogadores[k]):estado.jogadores;
            const podeComprar=j.baralhoTotal>0||(estado.cooperativo?recuperaveis(j)>0:(!estado.torneio||grupo.length===2)&&!grupo.some(d=>d.baralhoTotal)&&grupo.reduce((n,d)=>n+recuperaveis(d),estado.reservaCentralTotal||0)>=grupo.filter(d=>!d.eliminado).length);
            const area=el('div',undefined,'mao-com-pilhas');
            const compra=el('section',undefined,'pilha-compra');compra.dataset.zona='baralho';
            if(sua)compra.append(botao('Comprar carta',()=>agir('comprar'),ativo()&&estado.acoes>0&&podeComprar,'btn primario acao-compra'));
            else compra.append(el('h4','Compra'));
            const topo=sua?botao('',()=>agir('comprar'),ativo()&&estado.acoes>0&&podeComprar,'pilha-cartas pilha-interativa pilha-comprar'):el('div',undefined,'pilha-cartas');
            if(sua){topo.setAttribute('aria-label',`Comprar carta do seu baralho (${j.baralhoTotal} cartas)`);topo.title='Comprar uma carta · gasta 1 ação';}
            if(j.baralhoTotal)topo.append(verso());else topo.append(el('span','Vazio','pilha-vazia'));
            compra.append(topo,el('span',j.baralhoTotal+' carta(s)','pilha-contagem'));
            if(sua&&estado.vencedor===null)compra.append(botao('Encerrar turno',()=>agir('encerrar'),ativo(),'btn acao-encerrar'+(ativo()?' primario':'')+(ativo()&&estado.acoes===0?' acoes-esgotadas':'')));
            let mao;
            if(sua)mao=zona('Sua mão',j.mao);
            else {
                mao=el('section',undefined,'fileira-wrap mao-oculta');mao.append(el('h4','Mão de '+j.nome+' ('+j.maoTotal+')'));
                const cartas=el('div',undefined,'fileira cartas-de-costas');
                cartas.setAttribute('aria-label',j.maoTotal+' cartas de costas. Identidades ocultas.');
                for(let k=0;k<j.maoTotal;k++)cartas.append(verso());
                if(!j.maoTotal)cartas.append(el('span','Nenhuma carta.','suave'));
                mao.append(cartas);
            }
            mao.dataset.zona='mao';
            const descarteArea=el('section',undefined,'pilha-descarte');descarteArea.dataset.zona='descarte';
            const abrir=botao('Ver descarte',()=>abrirDescarte(i),true,'btn pequeno');
            descarteArea.append(abrir);
            const monte=botao('',()=>abrirDescarte(i),true,'pilha-cartas pilha-interativa pilha-ver-descarte');
            monte.setAttribute('aria-label',`Ver descarte de ${j.nome} (${j.descarte.length} cartas)`);monte.title='Consultar descarte · não gasta ação';
            if(j.descarte.length){
                const ultima=j.descarte.at(-1),face=el('div',undefined,'topo-descarte');
                face.dataset.topoDescarte=String(ultima.uid);face.append(arte(ultima.base),el('span',ultima.base.nome,'topo-descarte-nome'),el('small',Motor.tituloNome(ultima.base.classe),'topo-descarte-classe'));
                monte.append(face);monte.title='Topo: '+ultima.base.nome+' · clique para consultar o descarte';
                monte.setAttribute('aria-label',`Ver descarte de ${j.nome}: ${ultima.base.nome} no topo (${j.descarte.length} cartas)`);
            }else monte.append(el('span','Vazio','pilha-vazia'));
            descarteArea.append(monte,el('span',j.descarte.length+' carta(s)','pilha-contagem'));
            area.append(compra,mao,descarteArea);return area;
        }
        function lado(i,mesaCompleta=false) {
            const j = estado.jogadores[i], sua = i === estado.voce;
            const aliada = estado.equipes[i] === estado.equipes[estado.voce];
            const n = el('section', undefined, 'lado lado-online' + (sua ? ' lado-ativo' : '') + (j.eliminado ? ' lado-eliminado' : ''));
            n.dataset.jogador = String(i);
            const confronto=confrontoAtual(),participa=confronto&&[confronto.jogador,confronto.alvo].includes(i);
            if(participa)n.classList.add('confronto-ativo');
            if (!aliada) n.classList.add('lado-adversario');
            if ((estado.cooperativo || estado.todosContraTodos) && !sua) n.classList.add('lado-publico');
            if ((estado.cooperativo || estado.todosContraTodos) && !aliada && i === alvoSelecionado) n.classList.add('lado-alvo');
            n.setAttribute('aria-label', sua ? 'Seu lado da mesa' : (aliada ? 'Campo aliado: ' : 'Campo adversário: ') + j.nome);
            const cab = el('div', undefined, 'cab'), quem = el('div', undefined, 'quem');
            quem.append(el('strong', j.nome));
            const maximo=j.acoesPorTurno||Motor.REGRAS.acoesPorTurno,disponiveis=estado.vencedor===null&&i===estado.turno&&!j.eliminado?estado.acoes:0;
            const contador=el('span',undefined,'acoes-jogador'+(i===estado.turno&&estado.vencedor===null?' acoes-vez':''));
            contador.setAttribute('aria-label',`${disponiveis} de ${maximo} ações disponíveis agora`);
            contador.title=i===estado.turno?'Ações restantes neste turno':`Aguarda sua vez · ${maximo} ações por turno`;
            contador.append(el('span',`Ações: ${disponiveis}/${maximo}`));
            for(let k=0;k<maximo;k++)contador.append(el('span',undefined,'acao-pip'+(k>=disponiveis?' gasta':'')));
            quem.append(contador);
            if(estado.equipes2v2){const arena=(estado.arenas2v2||[[0,1],[2,3]]).findIndex(a=>a.includes(i));quem.append(el('span','Arena '+(arena+1),'etq arena-identidade'));}
            if(participa)quem.append(el('span',i===estado.turno?'Joga agora':'Adversário do turno','etq confronto-selo'));
            if (j.rep) quem.append(el('span', '· ' + j.rep.nome, 'rep'));
            if (j.bonusCampeao) quem.append(el('span', 'Próximo campeão: +' + j.bonusCampeao + ' DEF', 'etq'));
            if(estado.torneio?.aguardando.includes(i)){n.classList.add('lado-aguardando');quem.append(el('span','Aguarda próxima rodada','etq'));}
            if (j.eliminado) quem.append(el('span', 'Eliminado', 'etq ruim'));
            if ((estado.cooperativo || estado.todosContraTodos) && !aliada && i === alvoSelecionado && !j.eliminado) quem.append(el('span', 'Alvo selecionado', 'etq alvo-selecionado'));
            if (i === estado.turno && estado.vencedor === null) quem.append(el('span', sua ? 'Sua vez' : aliada ? 'Vez do aliado' : j.maquina ? 'Vez da máquina' : 'Vez do adversário', 'selo-vez'));
            const derrotados = el('div', undefined, 'derrotados');
            const pips = el('div', undefined, 'pips');
            pips.setAttribute('aria-hidden', 'true');
            for (let k = 0; k < Motor.REGRAS.campeoesParaVencer; k++) pips.append(el('span', undefined, 'pip' + (k < j.derrotados ? ' cheio' : '')));
            derrotados.append(el('span', 'Campeões derrotados'), pips, el('strong', `${j.derrotados}/${Motor.REGRAS.campeoesParaVencer}`));
            cab.append(quem, derrotados);
            const campo = el('div', undefined, 'campo-mesa');
            campo.append(
                zona('Em batalha', j.campo, { limite: Motor.REGRAS.maxCampo, dica: 'campeão ou besta', campo: true }),
                zona('Apoio', j.apoio, { limite: Motor.REGRAS.maxApoio, dica: 'auxiliares', apoio: true, campo: true })
            );
            if(aliada||mesaCompleta)n.append(cab,campo,maoComPilhas(i));
            else n.append(cab,maoComPilhas(i),campo);
            return n;
        }
        const eliminado=i=>estado.jogadores[i].eliminado||estado.jogadores[i].derrotados>=Motor.REGRAS.campeoesParaVencer;
        function confrontoAtual(){
            if(!estado||(estado.vencedor!==null)||(!estado.cooperativo&&!estado.equipes2v2))return null;
            const jogador=estado.turno,rivais=Motor.adversarios(estado,jogador);
            const alvo=jogador===estado.voce&&rivais.includes(alvoSelecionado)?alvoSelecionado:rivais.includes(estado.alvo)?estado.alvo:Motor.indiceOponente(estado,jogador);
            return {jogador,alvo,arena:estado.equipes2v2?(estado.arenas2v2||[[0,1],[2,3]]).findIndex(a=>a.includes(jogador))+1:null};
        }
        const participantesAtivos=()=>estado.jogadores.map((_,i)=>i).filter(i=>!eliminado(i));
        function ancoraDaMesa(){
            if(!eliminado(estado.voce))return estado.voce;
            const vivos=participantesAtivos();
            return vivos.find(i=>!estado.torneio?.aguardando.includes(i))??vivos[0];
        }
        function assento(i,posicao,ativo=false){
            const n=el('div',undefined,'assento assento-'+posicao);
            n.dataset.ativo=String(ativo);n.append(lado(i,true));return n;
        }
        function arenaQuatro(janela){
            const arena=el('div',undefined,'arena-completa'+(estado.cooperativo?' arena-equipes':''));
            const vivos=participantesAtivos(),ancora=ancoraDaMesa();
            const rivais=vivos.filter(i=>estado.equipes[i]!==estado.equipes[ancora]);
            const espelhado=estado.equipes2v2?(estado.arenas2v2||[[0,1],[2,3]]).find(a=>a.includes(ancora))?.find(i=>i!==ancora):alvoSelecionado;
            if(rivais.includes(espelhado))rivais.sort((a,b)=>Number(b===espelhado)-Number(a===espelhado));
            const oposto=Motor.adversarios(estado,ancora)[0]??(ancora+2)%4;
            const laterais=[0,1,2,3].filter(i=>i!==ancora&&i!==oposto);
            const posicoes=estado.cooperativo
                ? [...rivais.map(i=>[i,'norte']),[ancora,'sul'],...vivos.filter(i=>i!==ancora&&estado.equipes[i]===estado.equipes[ancora]).map(i=>[i,'sul'])]
                : [[oposto,'norte'],[laterais[0],'oeste'],[laterais[1],'leste'],[ancora,'sul']];
            for(const [i,posicao] of posicoes)if(!eliminado(i))arena.append(assento(i,posicao,i===ancora||i===oposto||i===estado.turno));
            janela.append(arena);
        }
        function arenaConfrontos(janela){
            const vivos=participantesAtivos(),ancora=ancoraDaMesa(),grupos=[];
            if(estado.cooperativo){
                const aliados=[ancora,...vivos.filter(i=>i!==ancora&&estado.equipes[i]===estado.equipes[ancora])];
                const rivais=vivos.filter(i=>estado.equipes[i]!==estado.equipes[ancora]);
                if(rivais.includes(alvoSelecionado))rivais.sort((a,b)=>Number(b===alvoSelecionado)-Number(a===alvoSelecionado));
                for(let i=0;i<Math.max(aliados.length,rivais.length);i++)grupos.push([aliados[i],rivais[i]].filter(i=>i!==undefined));
            }else if(estado.torneio){
                for(const duelo of estado.torneio.duelos){const vivosDoDuelo=duelo.filter(i=>!eliminado(i));if(vivosDoDuelo.length)grupos.push(vivosDoDuelo);}
                const usados=new Set(grupos.flat());for(const i of vivos)if(!usados.has(i))grupos.push([i]);
                grupos.sort((a,b)=>Number(b.includes(ancora))-Number(a.includes(ancora)));
            }else{
                const rival=Motor.adversarios(estado,ancora)[0],restantes=vivos.filter(i=>i!==ancora&&i!==rival);
                if(ancora!==undefined)grupos.push([ancora,rival].filter(i=>i!==undefined&&!eliminado(i)));
                while(restantes.length)grupos.push(restantes.splice(0,2));
            }
            const arena=el('div',undefined,'arena-completa arena-fileiras');
            for(const grupo of grupos){
                const sul=grupo.includes(ancora)?ancora:grupo[0],norte=grupo.find(i=>i!==sul);
                const confronto=el('section',undefined,'confronto-mesa');
                const titulo=norte===undefined?`${estado.jogadores[sul].nome}${estado.torneio?.aguardando.includes(sul)?' · aguarda próxima rodada':''}`:`${estado.jogadores[sul].nome} × ${estado.jogadores[norte].nome}`;
                confronto.append(el('h3',titulo,'confronto-titulo'));
                if(norte!==undefined)confronto.append(assento(norte,'norte',grupo.includes(ancora)||grupo.includes(estado.turno)));
                confronto.append(assento(sul,'sul',grupo.includes(ancora)||grupo.includes(estado.turno)));
                arena.append(confronto);
            }
            janela.append(arena);
        }
        function arenaDaPartida(){
            const janela=el('div',undefined,'arena-janela'+(visaoLinear?' arena-foco':''));
            janela.setAttribute('aria-label','Campo de batalha');
            if(!participantesAtivos().length)janela.append(el('p','Todos os invocadores foram eliminados. Consulte o resultado e o registro da partida.','arena-vazia'));
            else if(estado.jogadores.length===4&&participantesAtivos().length>2)arenaQuatro(janela);
            else arenaConfrontos(janela);
            const ativas=estado.jogadores.flatMap((j,dono)=>(j.feiticos||[]).map(c=>({c,dono})));
            if(ativas.length){
                const palco=el('div',undefined,'arena-palco'),rail=el('aside',undefined,'feiticos-em-campo');
                rail.setAttribute('aria-label','Feitiços em efeito');
                for(const {c,dono}of ativas){
                    const local=el('section',undefined,'pandora-em-campo');local.dataset.jogador=String(dono);local.dataset.zona='feiticos';
                    local.append(el('h4','Efeito ativo'),carta(c),el('small',estado.jogadores[dono].nome,'suave'));
                    rail.append(local);
                }
                palco.append(rail,...janela.childNodes);janela.append(palco);
            }
            return janela;
        }
        function render(vista=capturarVista()) {
            if (!estado || animando) return;
            const posicaoMesa=vista?.mesa;
            mesa.hidden = false;
            const terminou = estado.vencedor !== null;
            const tabuleiro = el('div', undefined, 'mesa');
            const barra = el('div', undefined, 'barra');
            const info = el('div', undefined, 'turno-info');
            const vencedor = estado.vencedor === -1 ? 'Empate!' : terminou ? (estado.cooperativo ? estado.equipes2v2 ? `A equipe ${estado.vencedor+1} venceu!` : estado.vencedor === 0 ? 'A equipe venceu!' : 'As máquinas venceram!' : estado.jogadores[estado.vencedor].nome + ' venceu!') : '';
            info.append(el('strong', terminou ? exibirResultadoPadrao ? vencedor : 'Treino concluído' : `Turno ${estado.numTurno} · vez de ${estado.jogadores[estado.turno].nome}`));
            info.append(el('small', `${estado.tamanhoBaralho} cartas únicas · divisão inicial: ${estado.tamanhoBaralho / estado.jogadores.length} por participante${estado.reservaCentralTotal ? ' · ' + estado.reservaCentralTotal + ' carta(s) no centro' : ''}`, 'suave'));
            const controles = el('div', undefined, 'barra-botoes');
            if (terminou) { if(exibirResultadoPadrao)controles.append(botao('Ver resultado', mostrarResultado), botao('Voltar ao lobby', aoSair, true, 'btn primario')); }
            const instrucaoFim = exibirResultadoPadrao ? 'Partida encerrada. Você pode consultar o tabuleiro ou voltar ao lobby para jogar novamente.' : 'Consulte o tabuleiro e use as opções do guia para continuar.';
            const instrucao = pausada && !terminou ? 'Partida pausada. Aguardando a reconexão de todos os jogadores.' : aviso.textContent || (terminou ? instrucaoFim : ativo() ? estado.acoes === 0 ? 'Suas ações acabaram. Encerre o turno para passar a vez.' : 'Selecione uma carta para ver sua habilidade e as ações disponíveis.' : eliminado(estado.voce) ? 'Você está assistindo aos invocadores que continuam na partida.' : 'Aguarde o adversário. Sua mão continua visível somente para você.');
            aviso.className = 'instrucao' + (aviso.textContent ? ' erro' : '');
            const dica = el('p', instrucao, aviso.className);
            dica.setAttribute('role', 'status');
            barra.append(info, controles, dica);
            const confronto=confrontoAtual();
            if(confronto)barra.append(el('p',`${confronto.arena?'Vez da Arena '+confronto.arena:'Confronto do turno'} · ${estado.jogadores[confronto.jogador].nome} × ${estado.jogadores[confronto.alvo]?.nome||'aguardando adversário'}`,'confronto-aviso'));
            if(estado.pandora)barra.append(el('p', 'Pandora ativa: ' + estado.danoPandora + ' de dano no início do turno de cada criatura, até uma delas morrer. Usos: ' + estado.pandoraUsos + '/3.', 'nota-equipe'));
            if (estado.torneio) {
                const t=estado.torneio,duelos=t.duelos.map(d=>d.filter(i=>!eliminado(i))).filter(d=>d.length).map(d=>d.map(i=>estado.jogadores[i].nome).join(' × ')+(d.length===1?' · aguarda próxima rodada':'')).join(' · ');
                barra.append(el('p',`${estado.jogadores.filter(j=>!j.eliminado).length===2?'Final':'Rodada '+t.rodada} · ${duelos}${t.aguardando.includes(estado.voce)?' · Você aguarda os outros duelos.':''}`,'nota-equipe'));
            }
            if (estado.cooperativo || estado.jogadores.some(j=>j.maquina)) barra.append(el('p', 'Dificuldade: ' + ({facil:'Fácil',normal:'Normal',dificil:'Difícil'}[estado.dificuldade] || 'Normal'), 'suave'));
            if (estado.cooperativo || estado.todosContraTodos) {
                const rivais = participantesAtivos().filter(i => estado.equipes[i] !== estado.equipes[estado.voce]);
                const alvos = el('div', undefined, 'alvo-coop');
                const label = el('label', estado.torneio ? 'Seu adversário' : rivais.some(i=>estado.jogadores[i].maquina) ? 'Máquina alvo' : 'Adversário alvo');
                const select = document.createElement('select');
                select.setAttribute('aria-label', rivais.some(i=>estado.jogadores[i].maquina) ? 'Máquina alvo' : 'Adversário alvo');
                const opcoesAlvo=(estado.torneio ? Motor.adversarios(estado,estado.voce) : rivais).filter(i=>!eliminado(i));
                for (const i of opcoesAlvo) {
                    const option = new Option(estado.jogadores[i].nome + (estado.jogadores[i].eliminado ? ' · derrotada' : ''), String(i));
                    option.disabled = estado.jogadores[i].eliminado;
                    select.add(option);
                }
                select.value = String(alvoSelecionado);
                select.disabled = !ativo() || Boolean(estado.torneio);
                select.addEventListener('change', () => { alvoSelecionado = Number(select.value); render(); });
                label.append(select); alvos.append(label); if(opcoesAlvo.length)barra.append(alvos);
                barra.append(el('p', estado.jogadores[estado.voce].eliminado ? (estado.todosContraTodos ? 'Você foi eliminado. Acompanhe os jogadores que continuam na arena.' : 'Você foi eliminado. Acompanhe e torça pelos aliados que continuam em jogo.') : estado.torneio ? 'Mata-mata: enfrente seu adversário espelhado. Os vencedores avançam; quem já venceu aguarda a próxima rodada.' : estado.todosContraTodos ? 'Todos contra todos. Escolha o adversário alvo; vence o último jogador não eliminado.' : estado.equipes2v2 ? 'Duplas 2v2. Você e o aliado compartilham a vitória; cada um tem sua mão e seu campo.' : estado.jogadores.some((j,i)=>j.maquina&&estado.equipes[i]===estado.equipes[estado.voce]) ? 'As máquinas aliadas jogam automaticamente. Cada integrante tem sua própria mão e seu campo; a vitória é da equipe.' : estado.jogadores.filter(j => !j.maquina).length === 1 ? 'Você enfrenta uma máquina, com sua própria mão e seu próprio campo.' : 'Mão e campo individuais. Combine os ataques com os aliados; apenas você pode jogar suas cartas.', 'nota-equipe'));
            }
            const opcoes=el('div',undefined,'arena-opcoes');
            opcoes.append(el('span',visaoLinear?'Visão atual: Tabuleiro completo':'Visão atual: Foco no duelo','visao-atual'),botao(visaoLinear?'Focar no duelo':'Ver tabuleiro completo',()=>{if(animando)return;cancelarPasseio();cancelarToques();visaoLinear=!visaoLinear;render();aoAlternarVisualizacao(visaoLinear);},true,'btn primario alternar-tabuleiro'),el('small','Um toque: descrição após 0,8 s. Dois em até 0,6 s: jogar da mão ou usar habilidade ativa sua. Deslize para explorar a mesa.','suave'));
            tabuleiro.append(barra,opcoes,arenaDaPartida());
            const lateral = el('aside', undefined, 'lateral');
            lateral.append(detalhe());
            if (estado.cooperativo || estado.todosContraTodos) {
                const ordem = el('div', undefined, 'painel ordem-turnos');
                ordem.append(el('h3', 'Ordem dos turnos'));
                const lista = el('ol');
                for (const i of estado.ordemTurnos) {
                    const j = estado.jogadores[i];
                    const item = el('li', j.nome + (i === estado.voce ? ' (você)' : '') + (j.eliminado ? ' · eliminado' : i === estado.turno ? ' · jogando' : '') );
                    if (i === estado.turno) item.className = 'turno-atual';
                    lista.append(item);
                }
                ordem.append(lista); lateral.append(ordem);
            }
            const registro = el('ol', undefined, 'log registro-online');
            for (const linha of estado.log.slice(-40).reverse()) registro.append(el('li', linha));
            const painelRegistro = el('div', undefined, 'painel');
            painelRegistro.append(el('h3', 'Registro da partida'), registro);
            lateral.append(painelRegistro, botao('Sair da partida', () => {
                if (estado.vencedor !== null || window.confirm('Sair encerra a partida para todos. Deseja continuar?')) aoSair();
            }, true, 'btn pequeno'));
            mesa.replaceChildren(tabuleiro, lateral);
            restaurarFileiras(vista);
            const janelaNova=mesa.querySelector('.arena-janela');
            if(janelaNova&&posicaoMesa){janelaNova.scrollLeft=posicaoMesa.x;janelaNova.scrollTop=posicaoMesa.y;}
            else if(janelaNova&&!visaoLinear){
                const foco=janelaNova.querySelector('.lado-ativo')||janelaNova.querySelector('.assento[data-ativo="true"]');
                if(foco){const r=foco.getBoundingClientRect(),j=janelaNova.getBoundingClientRect();janelaNova.scrollLeft=r.left-j.left+r.width/2-janelaNova.clientWidth/2;}
            }
            if(!compartilhada&&!espectadorAvisado&&estado.torneio?.rodada>1&&estado.jogadores[estado.voce].eliminado&&estado.vencedor===null){espectadorAvisado=true;espectador.showModal();}
            turnos.atualizar({ acoes: estado.acoes, suaVez: estado.turno === estado.voce && !pausada && !estado.jogadores[estado.voce].eliminado && !estado.torneio?.aguardando.includes(estado.voce), numTurno: estado.numTurno, vencedor: estado.vencedor, ocupado, nome:estado.jogadores[estado.voce].nome, confirmarInicio:confirmarInicioTurno(estado) });
            if (terminou && exibirResultadoPadrao && !resultadoMostrado && !resultadoPendente) mostrarResultado();
            if(Date.now()>=rolagemTurnoAte)restaurarVista(vista);
        }
        function aplicarEstado(proximo) {
            let vista=capturarVista();
            const antes = movimentos.capturar(estado);
            for(const [uid,origem]of efeitos?.consumirOrigens?.()||[]){
                if(antes){antes.cartas.set(uid,origem);antes.locais.set(uid,{dono:origem.dono,zona:'lancamento'});}
            }
            if(exibirResultadoPadrao&&antes&&proximo.vencedor!==null&&proximo.revisao!==estado.revisao&&!resultadoMostrado&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
                resultadoPendente=true;clearTimeout(timerResultado);
                timerResultado=setTimeout(()=>{resultadoPendente=false;if(estado?.vencedor!==null&&estado)mostrarResultado();},1150);
            }
            const mudouTurno=estado&&proximo.vencedor===null&&proximo.numTurno>estado.numTurno;
            if (mudouTurno) {
                clearTimeout(timerFocoMaquina);
                const nome = estado.jogadores[estado.turno].nome;
                turnos.notificar(`${nome} encerrou o turno. Agora é a vez de ${proximo.jogadores[proximo.turno].nome}.`);
                animacoesLiberadasEm=proximo.jogadores[proximo.turno].maquina?Date.now()+RITMO_ARENA.avisoTurno:0;
            }
            if(retornoVista&&(proximo.vencedor!==null||(mudouTurno&&!proximo.jogadores[proximo.turno].maquina))){
                vista=retornoVista;cancelarPasseio();
            }
            if (estado && proximo.revisao !== estado.revisao) { cancelarToques(); escolha.close(); descarte.close(); }
            if (!estado || estado.numTurno !== proximo.numTurno) alvoSelecionado = null;
            estado = proximo;
            const cartaSelecionada=localizar();if(cartaSelecionada&&eliminado(cartaSelecionada.dono))selecionada=null;
            const alvos = Motor.adversarios(estado, estado.voce);
            if (!alvos.includes(alvoSelecionado)) alvoSelecionado = alvos.includes(estado.alvo) ? estado.alvo : alvos[0] ?? null;
            aoMostrar();
            render(vista);
            movimentos.animar(antes,proximo);
            mesa.dispatchEvent(new CustomEvent('mesa:atualizada',{bubbles:true}));
            if(mudouTurno&&proximo.jogadores[proximo.turno].maquina){
                retornoVista=retornoVista||vista;
                const geracao=sessao,numTurno=proximo.numTurno;
                timerFocoMaquina=setTimeout(()=>{
                    if(geracao!==sessao||estado?.numTurno!==numTurno||pausada||estado.vencedor!==null)return;
                    rolagemTurnoAte=Date.now()+900;
                    mesa.querySelector('[data-jogador="'+estado.turno+'"] .campo-mesa')?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',inline:'center'});
                },RITMO_ARENA.avisoTurno);
            }
        }
        async function processarFila() {
            if(processando)return;
            processando=true;
            const token=geracaoFila;
            try {
                while(fila.length&&token===geracaoFila){
                    const item=fila.shift(),proximo=item.estado;estadoEmAnimacao=proximo;
                    const eventos=efeitos?.planejar(estado,proximo)||[];
                    if(eventos.length&&!item.saltar&&!pausada){
                        if(animacoesLiberadasEm>Date.now()&&!document.hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
                            await new Promise(resolve=>setTimeout(resolve,animacoesLiberadasEm-Date.now()));
                            if(token!==geracaoFila)return;
                        }
                        cancelarToques();cancelarPasseio();turnos.ocultarParaEfeito?.();
                        animando=true;
                        try { await efeitos.executar(estado,proximo); }
                        catch { aviso.textContent='A mesa foi sincronizada. Você pode continuar a partida.'; }
                        if(token!==geracaoFila)return;
                        animando=false;
                    }
                    aplicarEstado(proximo);estadoEmAnimacao=null;
                }
            } finally { if(token===geracaoFila){animando=false;processando=false;} }
        }
        function interromperEfeitos(aplicarUltimo=false){
            const ultimo=fila.at(-1)?.estado||estadoEmAnimacao;
            geracaoFila++;fila=[];estadoEmAnimacao=null;animacoesLiberadasEm=0;processando=false;animando=false;efeitos?.limpar();
            if(aplicarUltimo&&ultimo)aplicarEstado(ultimo);
        }
        socket.on('partida:estado',proximo=>{
            // Troca de pessoa no mesmo dispositivo nunca mantém a mão anterior exposta.
            if(estado&&proximo.voce!==estado.voce)interromperEfeitos();
            fila.push({estado:proximo});
            // Uma conexão atrasada deve recuperar o presente em vez de reproduzir todo o passado.
            if(fila.length>6)fila=[{estado:proximo,saltar:true}];
            void processarFila();
        });
        document.addEventListener('visibilitychange',()=>{if(document.hidden){efeitos?.limpar();movimentos.limpar();}});
        window.addEventListener('resize',()=>efeitos?.limpar(),{passive:true});
        socket.on('partida:pausa', dados=>{interromperEfeitos(true);cancelarToques();if(pausada!==Boolean(dados.pausada))cancelarPasseio();pausada=Boolean(dados.pausada);render();});
        return { capturarVista, restaurarVista, pausar(){interromperEfeitos(true);cancelarToques();cancelarPasseio();pausada=true;render();}, limpar() { interromperEfeitos();cancelarToques(); cancelarPasseio(); revisaoVista++; movimentos.limpar(); clearTimeout(timerResultado); resultadoPendente=false; sessao++; alvoSelecionado = null; estado = null; ocupado = false; pausada=false; selecionada = null; mesa.hidden = true; escolha.close(); descarte.close(); resultado.close(); espectador.close(); espectadorAvisado=false; resultadoMostrado = false; respondeuRevanche = false; jogarNovamente.disabled = false; votosResultado.textContent = ''; if(visaoLinearInicial!==undefined)visaoLinear=visaoLinearInicial;turnos.limpar(); aviso.textContent = ''; } };
    };
})();
