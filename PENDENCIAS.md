# O que falta verificar

Esta lista separa as regras que Luciano ainda vai confirmar com os demais
desenvolvedores das verificações práticas do jogo. As interpretações atuais continuam
valendo até uma decisão nova; não é necessário inventar valores para cartas de apoio.

## Decisões de regras

- [ ] **Bestas e auxiliares:** a morte de uma besta também deve eliminar os auxiliares?
  A regra confirmada e implementada por enquanto vale para o campeão e para os
  auxiliares do mesmo dono. Os auxiliares dos aliados no co-op permanecem em jogo.
- [ ] **Ataque direto aos apoios ou duração:** decidir se auxiliares podem receber
  ataques de campeões/bestas ou se terão limite de turnos. Hoje não são alvos de
  ataques normais, não têm uma duração padrão e saem se o campeão morrer. Efeitos
  específicos das cartas continuam podendo removê-los antes disso.
- [ ] **Nova habilidade do D007:** ainda em avaliação. Hoje tem defesa 400, sem
  habilidade adicional; isso não restaura a vida dos jogadores do sistema antigo.
- [ ] **Interpretações das habilidades:** aprovar ou corrigir os casos abaixo e os
  demais descritos na seção 8 do dossiê original.

| Carta | Implementação atual a conferir |
| --- | --- |
| n001 | A carta comprada fica na mão se for metálica; senão vai ao descarte. |
| n008 — Heimdall | Devolve os outros auxiliares do universo normal à mão; ele fica em apoio. |
| n009 — Fuleco | Dobra o ataque da sua criatura até o fim do turno. O texto fala em dobrar os “efeitos do time”, portanto precisa dessa confirmação. |
| n013 — Hércules | Dobra o ataque base a cada três turnos próprios em batalha, de forma cumulativa. |
| n019 — Kitsune | Pode voltar uma vez à mão, como exceção à regra de não retirar criaturas da batalha. |
| n022 — Dino | Dá +4 de ataque por três turnos próprios e depois vai ao descarte. Também sai antes disso se seu campeão morrer. |
| n025 | Em apoio, bloqueia dano e efeitos de cartas divinas contra seu dono. |
| n034 — Guss | Executa imediatamente uma habilidade ativa copiada ou mantém a passiva copiada enquanto estiver em batalha. |

- [ ] **Categorias:** confirmar se `sonoro` e `feitiço` permanecem; existem nas cartas
  e no jogo, embora não constassem daquela lista inicial de regras.
- [ ] **Reciclagem e vitória:** hoje, ao acabar o baralho, o descarte do dono é
  embaralhado para comprar novamente. Cada derrota de campeão conta, mesmo quando
  a carta já foi usada antes. Confirmar se essa é a regra desejada.
- [ ] **Impasses:** definir o resultado quando ninguém consegue vencer, por exemplo
  em combinações de imunidades. Hoje não existe empate automático por estagnação.
  Algumas simulações atingiram o limite de turnos do teste sem uma vitória.

## Balanceamento do co-op

- [ ] Jogar partidas completas nos formatos 2 humanos × 1 máquina e 4 × 2.
- [ ] Avaliar duas ações por humano e quatro por máquina.
- [ ] Avaliar a mão inicial com um campeão garantido para cada participante.
- [ ] Conferir a divisão de metade das cartas para cada equipe e os baralhos
  individuais pequenos no formato 4 × 2. Com 40 cartas, cada humano tem 5 e cada
  máquina tem 10; com quatro humanos, 20 cartas não são oferecidas.
- [ ] Conferir a eliminação após três campeões perdidos por participante e a vitória
  somente após derrotar todas as máquinas. Um humano eliminado acompanha os aliados.

## Verificação prática no Render

- [ ] Confirmar que “Comprar carta” chama atenção quando está disponível e fica
  desativado ao gastar as ações ou durante o turno de outro jogador.
- [ ] Derrubar um campeão por ataque, contra-ataque, habilidade e dano de efeito;
  verificar que seus auxiliares vão ao descarte e os dos demais participantes ficam.
- [ ] Conferir que mãos e baralhos continuam privados, inclusive entre aliados.
- [ ] Conferir os avisos de turno, a seleção de máquina alvo e os danos no registro.
- [ ] Fazer uma partida com quatro pessoas em dispositivos diferentes, incluindo
  celular. A validação automatizada em navegador local já passou.

## Melhorias opcionais

- Retomar a partida após uma queda de conexão. Hoje uma saída ou desconexão encerra
  a partida, e um reinício do servidor perde as salas em memória.
- Criar níveis de dificuldade depois de avaliar o balanceamento da IA.

**Já resolvido:** ataque/defesa zero nas cartas de apoio são valores válidos, a
distribuição não duplica cartas entre participantes e não há ajustes manuais no jogo.
O complemento do pedido antigo do index ficou perdido; a decisão foi manter a página
até Luciano trazer um pedido novo.
