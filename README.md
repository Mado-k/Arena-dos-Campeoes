# Arena-dos-Campeoes

🎮 **[Jogue Arena dos Campeões](https://arena-dos-campeoes.onrender.com/)**

Arena dos Campeões é um jogo de cartas, desenvolvido por um grupo movido por mim e mais 2 amigos do Ensino Médio.
Arena dos Campeões is a card game, made by me and a group of more 2 friends of mine at highschool.

Nós usamos a linguagem MySQL para armazenar as cartas do nosso jogo e JavaScript, para executar o nosso jogo com fluidez em uma aplicação web.

We used MySQL language to storage the cards of our game and JavaScript, to execute our game clean at a web application.

## Desenvolvimento no Codespaces

Use Node.js 22 ou superior e MySQL/MariaDB. Aproveite o checkout existente.

```bash
npm ci
[ -e .env ] || cp .env.example .env
```

Preencha `.env` somente no seu ambiente. `SENHA_ADMIN` é a senha do cadastro.
O arquivo de exemplo contém os nomes das variáveis; não envie senhas pelo chat nem
versione `.env`.

Para um banco **local novo**, importe `cartas/cards.sql` com seu cliente MySQL.
Em banco existente, preserve as cartas: o servidor, o seed e o exportador aceitam
tanto `ataque/defesa` quanto as colunas antigas `dano/vida`. Não é necessário apagar
tabela ou renomear colunas para usar esta versão. Valores zero são válidos.

```bash
node --env-file=.env seed.js
npm start
```

O seed ignora códigos já cadastrados. As portas são independentes:

| Variável | Uso |
| --- | --- |
| `PORT` | Porta HTTP do Node; padrão `3000` |
| `DB_PORT` | Porta MySQL informada pelo Aiven; padrão local `3306` |
| `DB_SSL` | Use `true` para habilitar TLS no banco |
| `DB_SSL_CA` | Caminho do certificado CA, quando exigido pelo serviço |

Para o Aiven, use `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` e `DB_NAME` do
serviço, com `DB_SSL=true`. As variáveis `DB_CA_FILE` e `DB_CA_CERT` já usadas no Render também são aceitas.
A validação do certificado fica ativa. Não execute o
SQL de criação de banco local sobre o serviço remoto: use o banco já provisionado.
Esta alteração foi validada com MariaDB local; o acesso ao seu Aiven depende das
credenciais e permissões configuradas no seu Codespace.

Sirva o site pelo próprio Node para usar a mesma origem. Se usar Live Server na
porta `5500` ou `5501`, `public/config.js` aponta para a porta Node `3000`, inclusive nos
endereços encaminhados do Codespaces. Se você mudar essa porta, ajuste `PORTA_NODE`
nesse arquivo, ou defina `window.ARENA_API` antes de carregar `config.js`. No GitHub
Pages, preencha `API_HOSPEDADA` em `public/config.js` com o endereço do backend no Render.
O servidor precisa estar acessível aos convidados; não compartilhe a porta do banco.

## Modo Local

Abra **Local** e escolha **Player vs máquina** ou **Player vs player**. No
individual solo, selecione de uma a quatro máquinas; no 2v2 solo, você e uma
máquina enfrentam outras duas. Em Equipe contra máquinas, escolha de uma a quatro adversárias e quantas
pessoas jogarão no dispositivo. Cada equipe tem o mesmo tamanho; as vagas
restantes do lado humano são preenchidas por máquinas aliadas ao iniciar. Entre pessoas no mesmo aparelho,
escolha individual com duas a quatro ou 2v2 com quatro. Cada humano escolhe seu
representante antes de começar. A cortina de troca de vez protege a próxima mão.
O individual com mais de dois participantes usa mata-mata e final.

O Local usa a cópia embutida das cartas quando o servidor está indisponível.
O endereço antigo `offline.html` redireciona para `local.html`. O controlador
compartilhado fica em `public/partida.js`, o motor em `public/motor.js` e a IA em
`public/ia.js`; `partida.js` na raiz exporta esse controlador para o servidor.

Antes de jogar contra máquinas, escolha **Fácil**, **Normal** ou **Difícil**, tanto
no Local quanto ao criar o co-op. Fácil varia as jogadas legais, Normal avalia o
ganho imediato e Difícil também considera a exposição da criatura aos ataques
adversários. Todos mantêm os mesmos atributos e duas ações por turno; a IA não
consulta mãos ou baralhos adversários.

## Partidas online

1. Abra Multiplayer ou Co-op, informe o apelido, escolha o total de cartas e crie a sala.
2. Compartilhe o convite e aguarde os amigos entrarem.
3. Cada pessoa escolhe seu representante na sala e clica em **Estou pronto**; o
   anfitrião clica em **Iniciar partida**. Trocar a escolha desmarca a prontidão. A
   opção de jogar sem representante continua disponível.
4. Selecione uma carta para ler sua habilidade e ver suas ações. Use **Comprar carta**
   ou **Encerrar turno** nos controles da mesa.

O total é dividido igualmente no início, sem repetir cartas entre os lados: 40 = 20 para cada
lado; 30 = 15; 20 = 10. As três cartas da mão inicial já fazem parte dessa metade.
Essa distribuição vale também no Local entre duas pessoas. Uma partida só começa se houver cartas
jogáveis distintas suficientes para o tamanho escolhido.

Ao começar, o lobby fica com `hidden` e a mesa ocupa seu lugar na mesma página.
Use **Sair da partida** para retornar à entrada; sair durante o jogo encerra a partida para os demais.
Depois da segunda ação, uma janela central avisa que as ações acabaram e oferece
**Encerrar turno**. Ao confirmar, os dois lados recebem um aviso central de quem
encerrou e de quem joga em seguida. No Local, a cortina de troca também mostra
essa informação.

Vitória e derrota abrem uma janela central de resultado no Local, multiplayer e
co-op, com **Ver tabuleiro**, **Voltar ao lobby** e **Jogar novamente**. Consultar o tabuleiro mantém as
cartas e o registro disponíveis, sem permitir novas jogadas; **Ver resultado**
reabre a janela. No Local, voltar ao lobby retorna à configuração. No online,
retorna à entrada de salas e preserva o tabuleiro dos demais participantes que
ainda quiserem consultá-lo. Empates oferecem as mesmas três opções.

**Jogar novamente** inicia uma nova partida Local contra máquinas com a mesma
configuração. Entre pessoas no mesmo dispositivo, cada jogador confirma a revanche.
No multiplayer e co-op online, todos os humanos precisam aceitar; então o grupo
volta à mesma sala para conferir representantes e prontidão. Enquanto aguarda,
o tabuleiro final continua disponível. Se alguém sair, prepare outra sala.

**O co-op permanece um protótipo:** o formato abaixo foi solicitado como solução
provisória até a equipe definir as regras finais.

O multiplayer aceita **de 2 a 4 pessoas**: duelo com duas, todos contra todos com
três ou quatro, com rivais fixos e espelhados, semifinal e final. Há também 2v2
com exatamente quatro humanos, nas equipes `[0, 1, 0, 1]`. O co-op aceita **de 1 a 4 pessoas**, com **uma máquina
por pessoa presente no lobby**. Não há seletor de formato: o anfitrião pode iniciar
sozinho ou esperar convidados. Ao entrar ou sair alguém, a contagem de máquinas é
atualizada e todos precisam confirmar prontidão novamente. Após o início, a
quantidade fica fixa; novas entradas são permitidas apenas antes da partida.

Humanos e máquinas têm **duas ações por turno**, em ordem alternada: jogador 1,
máquina 1, jogador 2, máquina 2, e assim por diante. O sistema pula eliminados e
executa automaticamente todas as máquinas consecutivas até chegar a um humano
ativo. Cada participante tem mão, campo, auxiliares, equipamentos, descarte e
baralho individuais. Mesmo os aliados não veem sua mão.

No Local contra máquinas, o seletor de formato oferece: individual com um humano
contra uma a quatro máquinas; 2v2 com um humano e uma máquina contra outras duas;
e o co-op provisório com uma a quatro pessoas. No Local entre pessoas, escolha
individual com duas a quatro pessoas ou 2v2 com quatro. Cada máquina sorteia um
representante disponível ou a opção sem representante antes da distribuição.

No lobby Local de Equipe contra máquinas, as adversárias aparecem acima das
pessoas. Os controles ficam junto à respectiva equipe, e cada ficha mostra o total
inicial de cartas. Pessoas veem a quantidade abaixo do bônus do representante;
as máquinas exibem nome, representante e quantidade. Se houver uma pessoa e três
adversárias, duas máquinas aliadas completam o 3 × 3. Aumentar o número de pessoas
acima do tamanho escolhido aumenta a equipe automaticamente; reduzir pessoas
preserva o tamanho da equipe e libera vagas para máquinas aliadas. Os representantes
das máquinas são sorteados no lobby e enviados ao controlador, sem novo sorteio
no início. Nomes e escolhas humanos são preservados ao ajustar as quantidades.

`Partida` aceita `vagasEquipe` e `representantesMaquinas` para essa configuração
Local. Sem essas opções, o co-op online mantém uma máquina por humano. As regras
definitivas do co-op são um plano futuro da equipe, ligado à criação de novas
cartas; não são uma pendência a resolver nesta atualização.

No mata-mata, com quatro invocadores, os confrontos são `0 × 2` e `1 × 3`.
Quantidade ímpar gera folga. O vencedor de um confronto aguarda, com seus turnos
pulados, até os outros confrontos terminarem. Na rodada seguinte os classificados
mantêm mãos, campos e equipamentos, zeram os campeões derrotados e recebem nos
baralhos de compra uma divisão igual das cartas recolhidas dos eliminados. Sobras
ficam no centro; descartes permanentes não retornam. A reciclagem durante cada
duelo usa só os descartes daquele confronto e não depende do baralho do outro.
O estado do chaveamento é salvo junto com a partida para retomada após reinício.
Eliminados online recebem a opção de assistir ou sair ao iniciar a próxima rodada;
sua saída/desconexão não pausa nem encerra a disputa entre os classificados.

A mesa de quatro usa posições voltadas ao centro; no 2v2, as duplas ficam frente
a frente. No celular, o foco no duelo mantém os detalhes acessíveis e a opção
Mesa completa permite explorar o tabuleiro. O verso azul escuro e dourado é
compartilhado por mãos ocultas, pilhas e animações, sem revelar identidades.

O anfitrião escolhe 20, 30 ou 40 cartas **dentro do lobby**. O total é arredondado
para cima até permitir a mesma quantidade inteira para cada participante,
incluindo máquinas, e no mínimo cinco cartas para cada um. Por exemplo, 20 cartas
para três pessoas vira 21 (7 por pessoa); 30 para quatro vira 32 (8 por pessoa).
Cada participante recebe três cartas na mão; o restante fica em seu baralho de
compra. A escolha do anfitrião e o total efetivo aparecem separados, e entradas
ou saídas recalculam a divisão a partir da escolha original. Alterar o total ou
a composição da sala cancela a prontidão de todos.

No co-op, cada equipe recebe metade do total, e todos os integrantes começam com
a mesma quantidade. Com três humanos e três máquinas, a escolha de 20 sobe para
30 (5 por participante); a escolha de 40 exige 42 (7 por participante). O catálogo
atual tem 40 cartas jogáveis distintas: neste último caso o lobby avisa para
escolher um total menor. O servidor recusa catálogos insuficientes, sem duplicar
cartas nem reduzir silenciosamente a escolha. A distribuição real só ocorre no
início da partida; o lobby mostra apenas a prévia. Em grupos de três ou quatro
humanos e no co-op, cada mão inicial inclui um campeão distinto.

Os humanos escolhem a máquina alvo antes de atacar ou usar uma habilidade ofensiva.
As habilidades voltadas ao adversário se aplicam à máquina escolhida; efeitos de
presença consideram os inimigos em jogo, e Pandora afeta todas as criaturas em batalha, inclusive as aliadas e do invocador. Equipamentos,
auxiliares e recuperações beneficiam o dono da carta; Heimdall pode transferir
cartas adversárias do universo Normal conforme sua habilidade.

Cada participante é eliminado ao perder três campeões. Seu turno passa a ser
pulado, mas ele pode acompanhar a equipe. A vitória exige eliminar todas as máquinas;
a derrota só ocorre quando todos os humanos são eliminados. A IA considera seus
próprios recursos e os campos públicos, sem consultar mãos ou baralhos humanos.
A reciclagem individual e as condições de vitória do protótipo continuam provisórias;
a regra de empate do duelo não foi aplicada ao co-op.

O servidor valida turno, dono da carta, ações restantes e versão da mesa. O cliente
não oferece ajustes manuais de atributos, descartes ou ações extras. Pedidos de
escolha de habilidade são enviados somente a quem executa a ação. O registro público
resume as ações para evitar revelar cartas compradas ou escolhidas no baralho.
Nos combates, o registro mostra os danos do ataque e do contra-ataque e a defesa
restante das duas criaturas. Se uma criatura for derrotada, mostra zero de defesa;
se não houver contra-ataque, mostra dano zero e o motivo. O detalhamento aparece
para ambos os jogadores, no Local e também nos ataques do computador.

A mesa online usa a mesma apresentação do Local: adversário acima, barra de
ações ao centro, seu campo e sua mão abaixo, e painel lateral com a carta selecionada
e o registro. As cartas mostram arte (ou inicial), atributos e habilidade, com a
descrição completa no painel. O layout se reorganiza em uma coluna no celular.
Os ajustes manuais foram removidos também do Local; as alterações de jogo passam
somente pelas regras e habilidades automáticas.

Uma desconexão inesperada pausa a partida por até **10 minutos**. A mesma aba
retoma automaticamente; depois de fechar a aba, use **Retomar partida** no mesmo
navegador e modo. A mão, as ações e o turno são preservados. Todos precisam voltar
para a partida continuar. Sair pelo botão continua sendo abandono explícito.
Não entram novos jogadores numa partida em andamento.

As sessões são salvas no MySQL/Aiven, na tabela `arena_sessoes`, criada automaticamente
na inicialização. O usuário do banco precisa poder criar essa tabela e consultar,
inserir, atualizar e excluir suas linhas; a tabela de cartas não é alterada.
O servidor só confirma uma ação depois de salvar o estado. Ao reiniciar, recupera
as sessões e abre uma nova janela de reconexão; registros sem atividade há mais de
24 horas são descartados. A retomada depende da disponibilidade desse banco.
O identificador privado de retomada fica no navegador; somente seu hash é salvo
no servidor e ele não aparece no convite nem nos estados enviados aos adversários.

As decisões que ainda precisam de confirmação e a lista de verificações estão em
[PENDENCIAS.md](PENDENCIAS.md).

## Regras confirmadas

- Ataque e defesa zero nos apoios são válidos; `sonoro` e `feitiço` permanecem.
- Quando um campeão ou uma besta morre, seus auxiliares vinculados vão para o
  descarte, por qualquer causa e nos três modos. Auxiliares não recebem ataques
  diretos, mas podem ser removidos ou anulados por habilidades.
- D007 recupera 1 ponto de defesa da criatura no início de cada turno do dono, até
  o máximo. Sua defesa continua 400; os jogadores não voltam a ter vida própria.
- n001 busca automaticamente a primeira metálica do baralho ao entrar em apoio,
  sem ação adicional; se não houver metálica, a própria auxiliar vai ao descarte;
  n008 captura passivamente cartas
  adversárias do universo Normal em jogo, devolvendo anexos de outros universos
  à mão do dono anterior; n009 duplica passivamente os efeitos numéricos das outras
  cartas do próprio dono enquanto estiver em apoio.
- Fuleco amplia danos de habilidades, bônus, multiplicadores, quantidades e duração;
  não dobra o ataque básico, custos, recargas, intervalos nem usos únicos.
  Efeitos já aplicados conservam os valores; bônus passivos são recalculados.
- Hércules dobra cumulativamente a cada três turnos próprios. Kitsune retorna uma
  vez por partida com equipamentos e auxiliares; Dino sai junto com sua criatura;
  n025 mantém a proteção divina e Guss aplica a habilidade copiada imediatamente.
- No Local e no multiplayer, a reciclagem espera os baralhos do confronto vazios, reúne
  os descartes e divide igualmente. Uma sobra fica no centro para a redistribuição
  seguinte. Cartas não são duplicadas; a posse pode mudar durante a partida.
  O co-op conserva sua reciclagem individual provisória.
- Um empate oferece reiniciar ou encerrar. A revanche online exige concordância
  de todos e volta à sala para confirmar representantes e prontidão. No Local e
  no multiplayer, após pelo menos quatro redistribuições, todas as cartas nos
  descartes ou na reserva central causam empate antes de embaralhar novamente.
  Não pode restar carta em mão ou em jogo. A quarta redistribuição é permitida;
  não existe uma contagem adicional de três turnos pulados. O co-op continua
  aguardando a definição das suas regras específicas.
- Oni Zumbi dobra o ataque base com **item** equipado; bestas continuam sem poder
  equipar armas.
- Caixa de Pandora causa 10 de dano no início do turno do dono de cada campeão ou
  besta em batalha, inclusive os do invocador e aliados. Não causa dano ao lançar.
  O efeito acaba quando qualquer criatura em batalha morre, por qualquer causa.
  Pode ser usada três vezes por partida, recuperando-a do descarte entre os usos;
  após o terceiro uso permanece no descarte, excluída de recuperações e reciclagens.
  Não acumula enquanto ativa. Auxiliares não possuem vida nem recebem dano;
  os vinculados a uma criatura derrotada são descartados. Só campeões derrotados
  contam para a vitória.
- Zord Fenrir reserva +100 de defesa para o próximo campeão do dono ao ser derrotado.
  Invocar uma besta não consome a herança. O bônus aumenta a defesa atual e máxima
  do campeão; a reserva e sua aplicação aparecem na mesa e no registro.


No mata-mata Local e online, a redistribuição durante uma rodada espera os dois
baralhos daquele confronto acabarem e usa os descartes desse duelo; a sobra fica
no centro. Ao passar de rodada, as cartas dos eliminados vão aos classificados. A mesma condição de impasse vale após quatro redistribuições.
A página inicial (`public/index.html`, `public/index.js` e `public/style.css`) apresenta
os modos atuais, e `public/tutorial.html` reúne todas as instruções; o pedido antigo que chegou cortado deixou de ser uma pendência.

As decisões completas, exemplos de amplificação e os testes a conferir no Render
estão em [PENDENCIAS.md](PENDENCIAS.md).

## Validação

```bash
npm test
```

A suíte inclui os testes fornecidos no ZIP: 51 verificações de habilidades e 600
partidas aleatórias, além de testes de autoridade, privacidade, co-op/IA, configuração
de portas/TLS e conexões reais Socket.IO. Os testes Socket.IO abrem portas locais
temporárias e não usam o banco Aiven.
Os testes de distribuição verificam os três tamanhos, unicidade entre jogadores,
tratamento de duplicatas no catálogo e conservação das cartas durante as jogadas.
Os testes de co-op cobrem de dois a oito participantes, mãos privadas, turnos, alvos,
eliminações, vitória em equipe e simulações completas com as cartas reais.
Os testes de combate cobrem dano com bônus, imunidade, derrota no ataque e no
contra-ataque, defesa restaurada no descarte e registro compartilhado entre os jogadores.

Também há testes de Local com duas a quatro pessoas, mínimo de cinco cartas por
participante, níveis de dificuldade, restauração após reinício, autenticação da
retomada, expiração e reversão de ação quando a gravação falha. A persistência foi
exercitada em MariaDB local; isso não confirma permissões no Aiven de produção.

O site estático já tem publicação da pasta `public/` no workflow do GitHub Pages.
Para usar as partidas no site publicado, atualize também o backend no Render: o
Pages sozinho não executa Node, banco ou Socket.IO. Nenhum deploy é feito pelos
comandos de teste.

## Changelog público e versões

O histórico fica em `public/changelog.html`, com estilos em `public/changelog.css`
e animação em `public/changelog.js`. A versão 1.0 consolida o que já estava entregue;
a versão 1.1 introduz o histórico. Cada versão começa recolhida e funciona também
sem JavaScript. A preferência por movimento reduzido desativa a animação.

Em cada atualização publicada, adicione uma entrada no início do histórico, sem
códigos de commit e com descrições voltadas aos jogadores. Inclua no título um
comentário curto sobre o tema, visível mesmo quando a versão estiver recolhida,
como “Versão 1.0: Modos de jogo e revisão das cartas”. A versão 1.2 introduz esses
resumos. Avance a versão pública
em **0.1** para uma atualização pequena, **0.5** para média ou **1.0** para grande,
sempre a partir da última versão publicada (por exemplo, 1.1 → 1.6 para uma média).
A numeração pública do histórico é independente da versão técnica do pacote npm.

## Tutorial

O guia Como jogar fica em `public/tutorial.html`, compartilhando os estilos do site.
Atualize essa página ao mudar regras, controles ou preparação dos modos. Os links
Como jogar em todos os menus apontam ao tutorial; o index mantém os modos e o catálogo.
Os atalhos de elementos levam ao index com `?elemento=...#cartas` para abrir o
catálogo filtrado. Endereços antigos `index.html#como-jogar` e `index.html#cj-...`
são encaminhados pelo index para a seção correspondente no tutorial.

## Mesa e animações (versão 1.9)

`public/online.js` é a mesa compartilhada pelo Local, multiplayer e co-op.
`public/movimentos.js` compara as visões recebidas e anima cartas entre mão, campo,
apoio e descarte. Os movimentos usam versos genéricos; nenhum dado de mãos inimigas
é solicitado ao servidor. A mão adversária mostra um verso por carta, com rolagem
horizontal quando necessário. Compra e descarte ficam junto à mão; pilhas vazias
mantêm a posição, sem desenho de cartas. O botão de compra fica acima da pilha.
Em telas pequenas, as duas pilhas ficam abaixo da fileira da mão, nas extremidades.
Movimento reduzido desativa os voos; limpar a mesa cancela animações pendentes.

## Ajustes da mesa e IA (versão 2.1)

Esta revisão usa o incremento de 0.2 solicitado por Luciano. O lado adversário
espelha mão, pilhas, apoio e batalha, com a descrição acima da imagem nas cartas.
Compra, versos e cartas da mão compartilham dimensões por tamanho de tela.
Desde a versão 2.25 (+0.05), as cartas das pilhas de compra e descarte usam 85%
da largura e altura das cartas da mão, em ambos os lados. A mão mantém seu tamanho.
Auxiliares exigem um campeão ou besta em batalha, validado pelo motor e pela interface.

`Partida.passoComputador()` aplica uma única jogada ou encerra o turno da máquina.
O Local agenda esses passos com pausas de 2 a 2,25 segundos; o co-op online agenda
um passo a cada 2 segundos, salvando e publicando cada estado antes de continuar.
A primeira jogada aguarda 4,5 segundos, depois do aviso de turno de 4 segundos.
Desconexões pausam a sequência; a retomada continua do último passo salvo. Timers
são cancelados ao encerrar a sala/servidor. `jogarComputador()` continua disponível
sem pausas para testes e simulações. Animações duram cerca de 760 ms e respeitam
movimento reduzido.

## Dino do Google (versão 2.2)

A passiva n022 causa 4 de dano à criatura do adversário selecionado no fim de cada
um dos três turnos do dono (o turno de entrada já conta). Não exige botão nem ação
extra e não aumenta o ataque da criatura. Após a terceira execução, Dino é descartado.
Sem alvo ou quando anulado, não há dano, mas o prazo passa. A derrota da criatura
vinculada descarta Dino imediatamente. O efeito respeita proteções e pontua campeões.
Fuleco amplia a aplicação para 8 de dano por 6 turnos, conservando esses valores.
O registro público mostra dano, defesa restante, prazo e descarte nos três modos.

## Rolagem e ritmo (versão 2.35)

A mesa preserva a rolagem durante seleção, compra, jogadas e animações. O único
foco automático durante a partida ocorre ao trocar para o turno de uma máquina,
mostrando seu campo; suas ações seguintes não reposicionam a câmera.
`public/ritmo.js` compartilha os tempos: aviso de turno de 4 segundos, primeira
jogada após 4,5 segundos e pausas seguintes de 2 segundos (até 250 ms adicionais
no Local). O servidor oferece `tempoIA` e `tempoAvisoIA` para testes com prazos
curtos; o prazo inicial é preservado durante pausa e retomada na mesma instância.

## Diagnóstico de criação de salas

Socket.IO pode conectar mesmo que a recuperação de sessões no banco tenha falhado.
A inicialização das salas responde aos pedidos com erro e código explícitos; após
uma falha, um novo pedido tenta recuperar as sessões novamente. Se a recuperação
exceder seis segundos, o pedido é recusado sem criar sala tardiamente. Aguarde a
recuperação terminar e tente novamente. Uma sessão salva com conteúdo inválido
é ignorada e registrada no log, sem impedir as demais nem apagar o registro original.

Se a criação falhar no Render, procure `Não foi possível recuperar as sessões:`
ou `Falha na sala:` nos Logs. `ER_TABLEACCESS_DENIED_ERROR` indica permissões na
tabela `arena_sessoes`; `ETIMEDOUT` indica conexão com o banco. A rota `/cartas`
pode funcionar normalmente enquanto a tabela de sessões falha. Não é necessário
apagar cartas, sessões ou o banco para aplicar a correção do tratamento desses erros.

## Versões do jogo

A partir da versão 2.405, o changelog usa incrementos de 0.005 por recurso
identificado na atualização. A versão 2.405 reúne onze recursos (+0.055 sobre a
2.35), incluindo as correções de salas e distribuição que estavam em rascunho.
O changelog descreve o comportamento para os jogadores, sem códigos de commit.

### Campos ativos na arena

A mesa compartilhada mantém o campo do jogador no mesmo espaço dos demais,
organizado por confrontos. O adversário fica na posição espelhada, acima do jogador.
No individual de quatro, a organização ao redor do centro é preservada; nos outros
formatos, os confrontos ficam lado a lado. A final reúne apenas os classificados.
Campos dos eliminados deixam de ser renderizados, sem remover seus registros do
estado da partida, do histórico ou da persistência. Espectadores veem apenas os
campos ativos e continuam sem acesso às mãos dos classificados. A opção de foco
no duelo permanece disponível para telas menores.

### Comportamento e adaptação das máquinas

A IA prioriza usar cartas ou atacar antes de comprar e não escolhe encerrar se
houver uma ação permitida. Cada máquina pode gastar no máximo uma ação de compra
direta por turno; habilidades que compram cartas mantêm seus efeitos. Quando não
há outra jogada após a compra, o turno avança mesmo que reste uma ação, respeitando
o limite. Ataques e outras jogadas podem ser repetidos quando forem úteis.
Os humanos mantêm as duas ações normais, inclusive a possibilidade de comprar duas vezes.

`public/ia.js` usa as últimas 16 ações públicas de cada participante para adaptar
as pontuações: reforça a defesa contra adversários que atacam frequentemente e
favorece o alvo atacado recentemente por um aliado. Fácil mantém escolhas mais
variadas; Normal e Difícil ponderam a adaptação ao avaliar jogadas legais.
A memória contém apenas tipos de ação, alvos públicos e turnos; não contém
identidades de cartas compradas nem consulta mãos/baralhos de adversários ou aliados.
`padroesIA` e o contador individual `iaTurno` ficam no estado interno, fora da visão
dos clientes. São persistidos e revertidos junto à ação se a gravação falhar.
A adaptação pertence à partida e reinicia na revanche; não há treino externo nem
mudança de atributos ou ações para beneficiar as máquinas.

### Dois cliques/toques e apresentação das cartas (2.480)

Um clique ou toque seleciona a carta para leitura. Dois consecutivos na mesma
carta da própria mão executam sua jogada principal: invocar criatura, colocar
auxiliar, equipar item/arma ou lançar um feitiço. As validações de turno, ações,
vínculo e equipamento continuam no controlador/motor. Cartas de outros jogadores
e cartas já em campo continuam disponíveis para inspeção; o atalho não dispara
ataques ou habilidades nelas. Os botões do painel permanecem disponíveis.

Na versão 2.480, as cartas do tabuleiro completo passaram de 54 × 78
para 67,5 × 97,5, com texto contido e descrição completa no painel. Mãos ocultas,
pilhas e espaços do campo acompanham o aumento, e os assentos reservam mais espaço
para evitar sobreposição. O foco no duelo preserva as dimensões anteriores.
O botão que alterna as visualizações tem tamanho e destaque maiores, incluindo
largura completa no celular. O changelog mostra a versão atual e as descrições
das mudanças, sem contagem de recursos ou avisos do valor de incremento.

### Leitura da mesa e Grávida dos Robôs (2.495)

Um novo aumento de 25% leva as cartas do tabuleiro completo a 84,375 × 121,875
pixels. Pilhas passam a 75 × 109,375; o foco no duelo mantém 110 × 170 e pilhas
48 × 70. Assentos e arena acomodam o novo tamanho. O bloco de texto compensa
a rotação do assento: nomes, atributos e descrições seguem a orientação da página,
mantendo a posição das cartas e a orientação das artes voltada para o centro.

A Grávida dos Robôs (n001) tem habilidade passiva de entrada em apoio. Colocá-la
consome uma ação e dispara a busca, sem botão ou segundo custo. Busca a primeira
metálica a partir do topo, preservando a ordem das demais cartas. Fuleco permite
buscar até duas; se houver só uma, ela é suficiente para a Grávida permanecer.
Sem nenhuma metálica no baralho de compra, a própria Grávida é descartada. Continua
exigindo uma criatura vinculada e espaço em apoio. Anulação impede a habilidade
de entrada; remover a anulação depois não dispara a busca retroativamente.
