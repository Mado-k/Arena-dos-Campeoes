# Regras confirmadas e o que falta verificar

Atualizado com as respostas de Luciano e os esclarecimentos enviados no chat.
Ataque/defesa zero nos apoios são válidos; não há ajustes manuais.

## Confirmado e implementado

- [x] Escolha do representante antes da partida nos três modos. No Local, fica na
  configuração; no online, na sala, antes de confirmar prontidão. Trocar a escolha
  desmarca a prontidão de todos. A opção de jogar sem representante foi preservada.
- [x] Apoio e auxiliar são a mesma categoria. Quando um campeão **ou besta** morre,
  os auxiliares vinculados a ele também vão ao descarte, por qualquer causa e em
  qualquer modo. Não são alvos de ataques diretos; efeitos podem removê-los ou
  anulá-los. Os auxiliares de outros participantes não são afetados pela derrota.
- [x] D007 recupera 1 ponto de defesa da criatura no início do turno do dono, até a
  defesa máxima. Não revive criaturas derrotadas e não restaura a antiga vida dos
  jogadores. Seu valor de defesa continua 400.
- [x] `sonoro` e `feitiço` permanecem no jogo.

| Carta | Regra confirmada |
| --- | --- |
| n002 — Caixa de Pandora | 10 de dano no início do turno do dono de cada criatura, de todos os lados, até uma criatura morrer. Três usos; depois fica permanentemente no descarte. Auxiliares não recebem dano. |
| n001 | Ao entrar em apoio, busca automaticamente a primeira metálica a partir do topo, sem outra ação. Não altera a ordem das demais. Sem metálica, a própria Grávida vai ao descarte. |
| n008 — Heimdall | Passiva: captura para a sua mão as cartas do universo Normal já em jogo ou jogadas posteriormente pelo adversário. Inclui criaturas, auxiliares e equipamentos. Anexos de outros universos voltam à mão do dono anterior. Capturar não conta como derrotar; proteções e anulações continuam valendo. Não acessa cartas escondidas. |
| n009 — Fuleco | Passiva enquanto estiver em apoio: duplica os efeitos numéricos das outras cartas do próprio dono. Não beneficia o adversário. |
| n013 — Hércules | Multiplica cumulativamente o ataque base por 2 a cada três turnos próprios em batalha: 7 → 14 → 28. |
| n019 — Kitsune | Retorna à mão com os itens, armas e auxiliares vinculados, recuperando os atributos. Uma utilização da habilidade por partida, inclusive quando copiada. |
| n022 — Dino | Passiva: 4 de dano à criatura inimiga no fim de cada um de três turnos próprios; depois vai ao descarte; vai ao descarte antes do prazo se a criatura vinculada morrer, inclusive besta. |
| n025 | Mantida a proteção contra dano e efeitos divinos enquanto estiver em apoio, conforme confirmação do item anterior. |
| n033 — Oni Zumbi | Dobra o ataque base quando equipa item; bestas continuam sem poder equipar armas. |
| n034 — Guss | Executa imediatamente a habilidade ativa copiada; uma passiva copiada passa a valer imediatamente, incluindo gatilhos de presença. |

### Alcance dos efeitos do Fuleco

Duplica danos de habilidades, bônus de ataque/defesa, multiplicadores, quantidade de
cartas obtidas/removidas e duração dos efeitos. Exemplos: veneno 2 → 4, queimadura
7 → 14, paralisia 1 → 2 turnos, defesa de equipamento 11 → 22, Dino 4 de dano/3 turnos →
8 de dano/6 turnos e recuperação do D007 1 → 2. O ataque básico da criatura não dobra.
Custos de ações, recargas, intervalos de ativação e limites de uso único não dobram.
Os efeitos já aplicados conservam seus valores e duração; ao sair ou ser anulado,
Fuleco deixa de ampliar aplicações novas e bônus passivos calculados continuamente.
Quando uma habilidade permite obter/remover duas cartas, ambas são escolhidas
antes de gastar a ação; cancelar a seleção não altera a partida.

### Redistribuição no Local e no multiplayer

Somente quando **os dois baralhos de compra estiverem vazios**, os descartes são
reunidos, embaralhados e divididos igualmente entre os dois jogadores. Se houver
uma carta ímpar, fica reservada no centro para entrar na próxima redistribuição.
Uma carta já reservada também entra na mistura seguinte. Mãos, campos e equipamentos
não entram nessa mistura. Sem pelo menos duas cartas disponíveis, não se cria uma
carta nem se gasta uma ação de compra sem resultado. Feitiços com regra própria de
reciclagem continuam funcionando conforme sua descrição.
Não há mais conservação de metade das cartas por jogador depois do início: Heimdall
e a redistribuição podem mudar a posse. A quantidade total e a unicidade são mantidas.

### Empate

Critério confirmado: no Local e no multiplayer, depois de **pelo menos quatro
redistribuições concluídas**, se todas as cartas da partida estiverem nos descartes
ou na reserva central, o jogo termina empatado **antes de embaralhar novamente**.
Não pode restar carta em mão, baralho, campo, apoio ou equipamentos em uso. A quarta
redistribuição ainda é permitida; o empate ocorre quando o descarte total acontecer
após ela (ou após uma redistribuição posterior). Não há contagem de três turnos
pulados nem empate apenas por imunidades. A vitória por três campeões derrotados
tem prioridade. O registro e o aviso de resultado mostram a causa do empate.

O resultado empatado oferece jogar novamente ou encerrar. No online, todos precisam
aceitar a revanche; se alguém encerrar, a partida termina. Uma revanche volta à mesma
sala, para conferir representantes e confirmar prontidão antes de iniciar novamente.
No Local, reiniciar reutiliza a configuração e pede confirmação dos humanos
quando houver revanche entre pessoas. No mata-mata, cada duelo recicla seus
próprios descartes quando os dois baralhos daquele confronto acabam.

## Ainda falta definir

- [ ] **Co-op:** regras específicas, balanceamento, distribuição, reciclagem,
  condições de vitória e habilidades de equipe ficam para uma etapa futura.
  O formato provisório agora aceita de 1 a 4 humanos e cria uma máquina por pessoa,
  automaticamente conforme o lobby. Ambos têm duas ações e turnos alternados.
  Três pessoas exigem pelo menos 30 cartas e quatro exigem 40; o lobby
  informa o ajuste, garantindo cinco cartas totais por participante, incluindo a mão.
  A redistribuição de dois jogadores não foi aplicada ao co-op; por enquanto cada
  participante continua reciclando seu próprio descarte.

## Ajuste provisório do co-op confirmado

- [x] Uma pessoa pode criar a sala e iniciar contra uma máquina.
- [x] Entradas e saídas no lobby ajustam a contagem, de 1 × 1 até 4 × 4.
- [x] Removido o seletor de formatos; as vagas adicionais são opcionais.
- [x] Mãos e campos continuam individuais, com cartas únicas e representantes prévios.
- [x] Duas ações por participante e turnos alternados entre humano e máquina.
- [x] Ajuste automático para 30 cartas com três humanos e 40 com quatro humanos.

## Verificação prática no Render

Os cinco “sim” de Luciano foram associados, na ordem, aos itens da lista anterior:

- [x] Comprar carta destacado e desativado conforme ações/turno.
- [x] Auxiliares descartados com o campeão e preservação dos demais participantes.
- [x] Privacidade de mãos e baralhos, inclusive entre aliados.
- [x] Avisos de turno, seleção de alvo e danos no registro.
- [x] Partida com quatro pessoas, incluindo celular.

Após o próximo deploy, conferir as novidades desta revisão:

- [ ] Criar co-op sozinho e iniciar; depois testar entradas/saídas até quatro pessoas.
- [ ] Conferir a contagem de máquinas, o ajuste de cartas e os turnos alternados.

- [ ] Selecionar D007 antes da partida e observar a recuperação no turno do dono.
- [ ] Derrubar uma besta e conferir o descarte dos auxiliares vinculados.
- [ ] Conferir captura de cartas Normais e retorno dos anexos dos outros universos.
- [ ] Conferir Fuleco com dano, paralisia e bônus de defesa.
- [ ] Esgotar os dois baralhos e conferir a redistribuição e a sobra central.
- [ ] Após quatro redistribuições, descartar todas as cartas e conferir o empate
  automático, sem novo embaralhamento, com as opções de revanche e encerramento.

## Melhorias solicitadas implementadas

- [x] Versão 2.35: ações preservam a rolagem; foco no campo da máquina somente
  na troca de turno; IA aguarda o aviso sumir e mantém pausas de cerca de 2 s.

- [x] Versão 2.2: Dino executa dano passivo ao encerrar cada turno próprio e é
  descartado depois da terceira execução; não acrescenta ataque ao campeão.

- [x] Versão 2.1 (+0.2): campo adversário completamente espelhado, descrição acima
  da imagem, pilhas do tamanho das cartas da mão, animações mais suaves e IA por
  passos com pausa. Auxiliares exigem campeão/besta em campo.

- [x] Versão 1.9: mãos ocultas com versos, pilhas de compra/descarte junto à mão e
  animações de compra, jogada e descarte, respeitando movimento reduzido.

- [x] Tutorial em página própria, com instruções dos modos, regras e controles;
  links Como jogar atualizados e inicial sem o guia completo.

- [x] Changelog público com versões recolhidas, animação de abertura/fechamento e
  acesso pelos menus. Incrementos de 0.1, 0.5 ou 1.0 conforme o tamanho da atualização.

- [x] Janela de vitória/derrota/empate no Local, multiplayer e co-op, com Ver tabuleiro,
  Voltar ao lobby e Jogar novamente. O resultado pode ser reaberto; sair após o fim não fecha
  o tabuleiro dos demais jogadores online.
- [x] Revanche após vitória, derrota ou empate. No online exige todos os humanos e
  retorna à mesma sala; no Local entre pessoas exige confirmação de cada jogador.
  Contra máquinas no Local, reinicia com a mesma configuração.
- [x] Local substitui Offline: 1 a 4 humanos contra igual número de máquinas, ou
  2 a 4 humanos entre si no mesmo dispositivo. Mãos separadas e cortina na troca.
- [x] Individual Local e online com rivais fixos e espelhados, mata-mata e final.
  Perder três campeões elimina; o classificado aguarda os demais confrontos.
- [x] Pelo menos cinco cartas totais por participante, incluindo a mão inicial de três,
  em todos os modos; cartas únicas e aumento automático do total quando necessário.
- [x] Fácil, Normal e Difícil antes da partida contra máquinas, sem vantagens de
  atributos, ações ou acesso às mãos adversárias.
- [x] Desconexão pausa por até dez minutos. Recarregar retoma a sessão; uma nova aba
  oferece retomar a última partida no mesmo navegador. Sair pelo botão é abandono.
- [x] Sessões persistidas em `arena_sessoes` no MySQL, com recuperação após reinício
  do servidor. Ações só são confirmadas depois de salvas; falhas revertem a jogada.
- [x] Oni Zumbi dobra o ataque base com item equipado, mantendo a proibição de armas.
- [x] Pandora: dano por turno em todos os lados; encerra quando uma criatura morre.
  Até três usos, sem acumular. Após o terceiro fica permanentemente no descarte,
  mesmo quando outras cartas recuperam ou reciclam o descarte. Só campeões pontuam.
- [x] Fenrir: +100 de defesa atual e máxima ao próximo campeão, preservando a reserva
  ao invocar bestas; bônus pendente e aplicação visíveis na mesa e no registro.
- [x] A página inicial apresenta o Local e as regras atuais. O complemento antigo
  que chegou cortado não bloqueia mais o projeto, conforme orientação de Luciano.

## Novidades a conferir após o deploy

- [ ] Concluir uma partida: conferir resultado, consulta ao tabuleiro e retorno
  ao lobby. No online, um jogador pode voltar enquanto o outro consulta o tabuleiro.
- [ ] Abrir Local, testar os dois formatos e a cortina de mãos com até quatro pessoas.
- [ ] Conferir Fácil, Normal e Difícil no Local e no co-op.
- [ ] Recarregar a página durante a partida: conferir mão, ações e turno preservados.
- [ ] Fechar e reabrir a aba no mesmo navegador: usar o botão de retomada.
- [ ] Desconectar um jogador: o restante aguarda; reconectar libera a partida.
- [ ] Confirmar criação e acesso a `arena_sessoes` no Aiven e retomada após reinício
  do Render. A integração com banco foi validada localmente, não em produção.
- [ ] Equipar Oni Zumbi com item e conferir o dobro do ataque base.
- [ ] Lançar Pandora e conferir dano no início de cada turno, incluindo o invocador,
  término na primeira derrota e pontuação de campeões. Reutilizar até três vezes
  e conferir que depois não sai do descarte, nem por embaralhamento ou habilidade.
- [ ] Derrotar Fenrir, conferir a reserva de +100, invocar uma besta e depois um
  campeão: só o campeão recebe e consome a herança.

## Formatos e mesa confirmados nesta atualização

- [x] Quatro posições voltadas ao centro no individual; duas duplas frente a frente no 2v2. Foco no duelo para telas menores e mesa completa disponível.
- [x] Solo: um humano contra uma a quatro máquinas no individual; no 2v2, um humano e uma máquina contra outras duas, quatro invocadores no total.
- [x] Individual com adversário fixo, folga em quantidade ímpar, classificados aguardando e final. Contadores zerados na nova rodada, preservando mãos e campos.
- [x] Cartas dos eliminados divididas entre os baralhos dos classificados, sobras no centro e descarte permanente preservado.
- [x] Eliminados online podem assistir ou sair sem interromper a disputa dos classificados; mãos adversárias continuam privadas.
- [x] Máquinas escolhem representante disponível ou nenhum em todos os formatos.
- [x] Seletor 2v2 no lobby multiplayer e na configuração Local; quatro participantes obrigatórios, com primeira e terceira pessoas aliadas.
- [x] Nova métrica de versão: 0.005 por recurso; o changelog identifica os onze recursos desta atualização (2.405).

- [x] Botão Encerrar turno maior e destacado durante a vez, com brilho suave ao acabar as ações e respeito a movimento reduzido.

## Preparação das equipes no Local — 2.460

- [x] Quantidade inicial de cartas em cada ficha, abaixo do bônus dos humanos.
- [x] Adversárias acima das pessoas, com nome, representante e cartas; controles junto à equipe correspondente.
- [x] Máquinas aliadas completam as vagas sem humanos para manter equipes do mesmo tamanho, de um a quatro invocadores por lado.
- [x] Representantes previstos no lobby são preservados no início; mão e campo continuam individuais.
- [x] Fundo roxo escuro dos versos restaurado, mantendo o desenho atual.

As regras definitivas do co-op serão desenvolvidas com novas cartas e fazem parte
de um plano futuro da equipe. Não precisam ser resolvidas agora. O co-op online
mantém seu formato provisório; esta configuração adicional se aplica ao Local.

- [x] Campos dos eliminados removidos da área visual de batalha, preservando o histórico e as opções dos espectadores.
- [x] Campo do jogador integrado à mesa nos demais formatos, com confrontos alinhados e adversário na posição espelhada. A final mantém apenas os classificados.

- [x] Máquinas priorizam usar cartas/atacar antes de comprar e só encerram sem jogadas permitidas ou sem ações.
- [x] No máximo uma ação de compra direta por turno de cada máquina; humanos e habilidades de compra preservados.
- [x] Adaptação aos padrões públicos dos adversários e coordenação dos alvos dos aliados, com memória limitada à partida.
- [x] Limite e memória da IA persistem na retomada e são restaurados quando uma gravação falha.

## Interação e legibilidade — 2.480

- [x] Dois cliques/toques na carta da própria mão executam a jogada principal; primeiro clique seleciona para leitura.
- [x] Regras de turno, ações, auxiliares e equipamentos preservadas; cartas de oponentes e do campo continuam apenas selecionáveis pelo atalho.
- [x] Cartas da mesa completa 25% maiores, descrições contidas e painel com texto completo; assentos ajustados para evitar sobreposição.
- [x] Alternância entre foco e tabuleiro completo mais destacada e acessível no celular.
- [x] Changelog mostra versão atual e mudanças, removendo contadores e avisos de incremento.

## Leitura da mesa e Grávida dos Robôs — 2.495

- [x] Cartas do tabuleiro completo e versos aumentados em mais 25%, com assentos ajustados.
- [x] Bloco de texto das cartas na orientação normal da página, preservando posições e artes.
- [x] Grávida dos Robôs passiva ao entrar em apoio, com busca automática sem segunda ação; sem metálica, a própria auxiliar é descartada.
- [x] Busca respeita Fuleco, anulação e vínculo com criatura; não repete em turnos seguintes.

## Imagem das cartas — 2.500

- [x] Cartas do tabuleiro completo ampliadas para 120 × 200, com área de imagem de 84 pixels de altura.
- [x] Imagens inteiras, sem recorte, com campos e pilhas ajustados e leitura na orientação da página.
- [x] Foco no duelo preservado; prévia preparada para revisão.

O catálogo público consultado ainda não contém imagens cadastradas. As cartas
continuam exibindo suas iniciais até que as artes sejam adicionadas.

## Orientação e retorno da visualização — 2.510

- [x] Todos os textos dos campos na orientação da página, incluindo nomes, rótulos, botões, equipamentos e contagens.
- [x] Campos espelhados por layout; artes mantêm a orientação para o centro.
- [x] Posição da página, da arena e das mãos preservada nas atualizações.
- [x] Acompanhamento automático começa após o aviso e retorna ao ponto anterior quando a vez volta a uma pessoa.
- [x] Navegação manual tem prioridade e cancela deslocamentos pendentes; limpeza e pausa cancelam temporizadores.
- [x] No Local entre pessoas, posição de cada participante guardada separadamente e restaurada após a passagem do dispositivo.


## Turnos, arenas e iniciantes — 2.535

- [x] “É a sua vez” com OK obrigatório nos modos Local, multiplayer, co-op e treino; demais participantes mantêm o aviso de encerramento.
- [x] Identificação das arenas 2v2, sorteio inicial e ordem agrupada por arena, incluindo início por máquinas no Local.
- [x] Destaque do jogador e adversário atual no 2v2 e co-op, preservando a escolha de alvo existente.
- [x] Partida para iniciantes com dez cartas únicas, atributos reais, 13 etapas guiadas e vitória ensaiada.
- [x] Links na homepage e no início/final do tutorial; README atualizado com as inspirações das cartas.
- [x] Testes do roteiro, conservação das dez cartas, sorteio das arenas e restauração de estado.

No 2v2, a escolha de alvo existente é preservada. Regras definitivas do co-op
continuam reservadas para etapa futura.

## Ações, pilhas e eliminação — 2.560

- [x] Contador de ações junto ao nome de todos os participantes, inclusive máquinas; removido da barra global.
- [x] Compra direta pela pilha com custo de uma ação, consulta gratuita do descarte e alternativas de teclado/botões.
- [x] Eliminação voluntária apenas da criatura do próprio dono em batalha, na sua vez, com uma ação e confirmação.
- [x] Campeão soma derrota ao dono; besta não pontua; equipamentos e auxiliares vinculados descartados automaticamente.
- [x] Efeitos de morte e terceira derrota aplicam regras normais; servidor reverte a ação se a gravação falhar.
- [x] Treino com 18 etapas pratica essas interações e substitui Marie por Guss, mantendo dez cartas e vitória garantida pelo roteiro.


## Visibilidade das ações — 2.565

- [x] Indicadores maiores, números em negrito, fundo contrastante e marcadores ampliados.
- [x] Destaque dourado para o participante da vez, mantendo o contador junto ao nome.

## Selos da vez — 2.570

- [x] “Sua vez” e “Joga agora” ampliados para a mesma tipografia e altura do indicador de ações.

## Nome e cor da vez — 2.575

- [x] Nome apenas com o mesmo tamanho de fonte dos indicadores, sem fundo ou moldura.
- [x] “Sua vez” na paleta escura e dourada do contador; “Joga agora” mantém o verde.

## Pontuação legível — 2.580

- [x] “Campeões derrotados”, números, marcadores e espaçamentos ampliados em 20%, sem mudar as regras.

## Revisão do tutorial — 2.585

- [x] Conferidos controles da mesa, pilhas, eliminação, indicadores, resultados e retorno da visualização.
- [x] Incluídos OK de início de turno, treino de 18 etapas, arenas, seleção de alvos e dificuldades.
- [x] Completadas prontidão, convite, reconexão, espectadores, habilidades, estados e representantes.
- [x] Incluídos catálogo, filtros, detalhes e changelog; índice ampliado com os assuntos disponíveis.
