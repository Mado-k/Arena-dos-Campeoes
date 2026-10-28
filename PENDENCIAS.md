# Regras confirmadas e o que falta verificar

Atualizado com as respostas de Luciano e os esclarecimentos enviados no chat.
Ataque/defesa zero nos apoios são válidos; não há ajustes manuais.

## Confirmado e implementado

- [x] Escolha do representante antes da partida nos três modos. No offline, fica na
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
| n001 | Busca a primeira metálica a partir do topo do baralho. Não descarta as cartas ignoradas nem muda sua ordem. |
| n008 — Heimdall | Passiva: captura para a sua mão as cartas do universo Normal já em jogo ou jogadas posteriormente pelo adversário. Inclui criaturas, auxiliares e equipamentos. Anexos de outros universos voltam à mão do dono anterior. Capturar não conta como derrotar; proteções e anulações continuam valendo. Não acessa cartas escondidas. |
| n009 — Fuleco | Passiva enquanto estiver em apoio: duplica os efeitos numéricos das outras cartas do próprio dono. Não beneficia o adversário. |
| n013 — Hércules | Multiplica cumulativamente o ataque base por 2 a cada três turnos próprios em batalha: 7 → 14 → 28. |
| n019 — Kitsune | Retorna à mão com os itens, armas e auxiliares vinculados, recuperando os atributos. Uma utilização da habilidade por partida, inclusive quando copiada. |
| n022 — Dino | +4 de ataque por três turnos próprios; vai ao descarte antes do prazo se a criatura vinculada morrer, inclusive besta. |
| n025 | Mantida a proteção contra dano e efeitos divinos enquanto estiver em apoio, conforme confirmação do item anterior. |
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

### Redistribuição no offline e no multiplayer

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

O resultado empatado oferece jogar novamente ou encerrar. No online, todos precisam
aceitar a revanche; se alguém encerrar, a partida termina. Uma revanche volta à mesma
sala, para conferir representantes e confirmar prontidão antes de iniciar novamente.
No offline, reiniciar volta à configuração.

## Ainda falta definir

- [ ] **Critério de empate por impasse:** falta estabelecer quando a estagnação ou
  uma combinação de imunidades deve produzir empate. Não foi inventado um número
  de turnos nem uma regra automática. O resultado empatado já tem o fluxo acima.
- [ ] **Co-op:** regras específicas, balanceamento, distribuição, reciclagem,
  condições de vitória e habilidades de equipe ficam para uma etapa futura.
  O protótipo 2 humanos × 1 máquina / 4 × 2 foi preservado sem torná-lo definitivo.
  A redistribuição de dois jogadores não foi aplicada ao co-op; por enquanto cada
  participante continua reciclando seu próprio descarte.

## Verificação prática no Render

Os cinco “sim” de Luciano foram associados, na ordem, aos itens da lista anterior:

- [x] Comprar carta destacado e desativado conforme ações/turno.
- [x] Auxiliares descartados com o campeão e preservação dos demais participantes.
- [x] Privacidade de mãos e baralhos, inclusive entre aliados.
- [x] Avisos de turno, seleção de alvo e danos no registro.
- [x] Partida com quatro pessoas, incluindo celular.

Após o próximo deploy, conferir as novidades desta revisão:

- [ ] Selecionar D007 antes da partida e observar a recuperação no turno do dono.
- [ ] Derrubar uma besta e conferir o descarte dos auxiliares vinculados.
- [ ] Conferir captura de cartas Normais e retorno dos anexos dos outros universos.
- [ ] Conferir Fuleco com dano, paralisia e bônus de defesa.
- [ ] Esgotar os dois baralhos e conferir a redistribuição e a sobra central.

## Melhorias opcionais

- Retomar partidas após desconexão ou reinício do servidor. Hoje as salas ficam em
  memória e uma desconexão encerra a partida.
- Definir níveis de dificuldade quando o co-op voltar à etapa de especificação.
- O complemento antigo do pedido do index continua desconhecido; manter a página
  atual até Luciano trazer uma alteração nova.
