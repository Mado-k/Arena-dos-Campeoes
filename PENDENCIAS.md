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
| n001 | Busca a primeira metálica a partir do topo do baralho. Não descarta as cartas ignoradas nem muda sua ordem. |
| n008 — Heimdall | Passiva: captura para a sua mão as cartas do universo Normal já em jogo ou jogadas posteriormente pelo adversário. Inclui criaturas, auxiliares e equipamentos. Anexos de outros universos voltam à mão do dono anterior. Capturar não conta como derrotar; proteções e anulações continuam valendo. Não acessa cartas escondidas. |
| n009 — Fuleco | Passiva enquanto estiver em apoio: duplica os efeitos numéricos das outras cartas do próprio dono. Não beneficia o adversário. |
| n013 — Hércules | Multiplica cumulativamente o ataque base por 2 a cada três turnos próprios em batalha: 7 → 14 → 28. |
| n019 — Kitsune | Retorna à mão com os itens, armas e auxiliares vinculados, recuperando os atributos. Uma utilização da habilidade por partida, inclusive quando copiada. |
| n022 — Dino | +4 de ataque por três turnos próprios; vai ao descarte antes do prazo se a criatura vinculada morrer, inclusive besta. |
| n025 | Mantida a proteção contra dano e efeitos divinos enquanto estiver em apoio, conforme confirmação do item anterior. |
| n033 — Oni Zumbi | Dobra o ataque base quando equipa item; bestas continuam sem poder equipar armas. |
| n034 — Guss | Executa imediatamente a habilidade ativa copiada; uma passiva copiada passa a valer imediatamente, incluindo gatilhos de presença. |

### Alcance dos efeitos do Fuleco

Duplica danos de habilidades, bônus de ataque/defesa, multiplicadores, quantidade de
cartas obtidas/removidas e duração dos efeitos. Exemplos: veneno 2 → 4, queimadura
7 → 14, paralisia 1 → 2 turnos, defesa de equipamento 11 → 22, Dino +4/3 turnos →
+8/6 turnos e recuperação do D007 1 → 2. O ataque básico da criatura não dobra.
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
No Local, reiniciar volta à configuração. Entre três ou quatro pessoas, a
redistribuição espera todos os baralhos ativos vazios e divide os descartes entre
os sobreviventes, reservando no centro as cartas que sobrarem.

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
- [x] No Local entre três ou quatro pessoas, todos contra todos: perde quem tiver
  três campeões derrotados; vence o último participante. Eliminados não jogam mais.
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
