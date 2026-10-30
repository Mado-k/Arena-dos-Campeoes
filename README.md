# Arena-dos-Campeoes

🎮 **[Jogue Arena dos Campeões](https://arena-dos-campeoes.onrender.com/)**

Arena dos Campeões é um jogo de cartas, desenvolvido por um grupo movido por mim e mais 2 amigos do Ensino Médio.
Arena dos Campeões is a card game, made by me and a group of more 2 friends of mine at highschool.

As cartas são inspiradas em memes em geral, nacionalidades e culturas, críticas
sociais relacionadas ao meio ambiente e mitologias. Esses temas orientam a criação
de personagens, nomes, artes e habilidades do jogo.

The cards draw inspiration from memes, nationalities and cultures, social commentary
on environmental issues, and mythologies.

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
resumos. Todas as versões do projeto estão em fase BETA.
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

O lado adversário espelha mão, pilhas, apoio e batalha, com a descrição acima da
imagem nas cartas.
Compra, versos e cartas da mão compartilham dimensões por tamanho de tela.
Desde a versão 2.25, as cartas das pilhas de compra e descarte usam 85%
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

Todas as versões são identificadas como BETA. O histórico apresenta as mudanças
e a data registrada para cada lançamento, com descrições voltadas aos jogadores.

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
das mudanças.

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

### Imagem das cartas no tabuleiro completo (2.500)

As cartas da mesa completa passam a 120 × 200 pixels, com área de imagem de
84 pixels de altura (antes, 27,5). Imagens cadastradas são exibidas inteiras,
sem recorte; cartas sem imagem continuam mostrando sua inicial. Os campos,
mãos, espaços vazios e pilhas acompanham o tamanho, com assentos de 400 × 1000
pixels. Pilhas têm 90 × 150 pixels. A orientação normal dos textos é preservada,
inclusive nas laterais, e o foco no duelo mantém suas dimensões anteriores.

### Orientação completa e retorno da visualização (2.510)

Todos os textos dos campos seguem a orientação normal da página: nomes,
representantes, pontuação, zonas, mãos, botões, equipamentos e contagens.
Os campos são espelhados pela organização das zonas, sem girar o painel inteiro.
Nas quatro posições individuais, os campos laterais se organizam horizontalmente
em direção ao centro. Só as artes das cartas acompanham a posição do participante.

A visualização guarda a rolagem da página, da janela da arena e das fileiras das
mãos durante seleções, jogadas, atualizações e abertura/fechamento de diálogos.
Ao passar a vez para uma máquina, espera o aviso desaparecer e acompanha seu
campo. Depois da sequência de máquinas, restaura a posição anterior quando a vez
volta a uma pessoa, ou quando a partida termina. Se o usuário navegar manualmente,
o acompanhamento e o retorno pendentes são cancelados. Pausa, saída e nova partida
também cancelam os temporizadores. Atualizações que apenas repetem o estado de
presença não apagam a posição guardada. Posições são limitadas naturalmente à
área disponível se a remoção de campos eliminados reduzir o tabuleiro.
No Local com passagem do dispositivo, cada humano guarda sua posição de
visualização separadamente e a retoma após confirmar sua vez. A mesa privada
continua oculta durante a passagem; sair ou começar outra partida limpa as posições.

### Confirmação de turno, arenas e iniciantes (2.535)

Em todos os modos, cada nova vez humana abre “É a sua vez”. O aviso só fecha em
OK; Escape e a passagem do tempo não confirmam. Enquanto ele estiver aberto, a
mesa não envia ações do jogador. Os demais clientes recebem o aviso temporário de
encerramento. A confirmação é local à interface e não altera a revisão da partida.

No 2v2, Arena 1 contém os participantes 0 e 1; Arena 2 contém 2 e 3. Os aliados
continuam sendo 0/2 e 1/3. O sorteio escolhe uma das arenas e seu primeiro
participante; os dois de cada arena jogam em sequência antes da próxima. Ordem,
arena inicial e identificadores ficam no estado compartilhado e persistido. O Local
também inicia corretamente se a primeira vez sorteada for de uma máquina.
O adversário espelhado é o alvo inicial; a escolha de outro adversário continua
permitida. Os destaques refletem quem joga e o alvo atual, inclusive no co-op,
sem acrescentar regras definitivas a esse modo.

`iniciantes.html` oferece uma partida ensaiada com cinco cartas únicas por lado,
incluindo três na mão inicial. O jogador recebe Marie Curie Zumbi, Fuleco,
Batsopra Bolha, Cobertor e Zord Fenrir; a máquina começa com Gaiamon, Hércules e
Doce Hera na mão, e tem duas cartas de reserva. São atributos reais do catálogo.
O roteiro ensina invocação, apoio, compra, combinação de defesa, arma, ataque e
vitória por três campeões em 13 passos curtos. A máquina faz jogadas ensaiadas
legais; o jogador não pode gastar ações fora da etapa sugerida. Seguir o roteiro
garante sua vitória sem alterar atributos ou inventar cartas. Não há ranking,
persistência ou efeito sobre partidas normais. O mínimo e os totais dos lobbies
normais continuam iguais; o conjunto de dez cartas é exclusivo do treino.

O destaque indica a carta ou botão da etapa. “Mostrar onde clicar” é uma navegação
solicitada pelo jogador; os demais deslocamentos mantêm as regras de retorno.
Jogar novamente reinicia o roteiro. O treino é acessível na homepage e nas duas
extremidades do tutorial. As inspirações temáticas do jogo estão descritas no
início deste README.

### Ações no campo, pilhas e eliminação voluntária (2.560)

O contador fica imediatamente ao lado do nome em cada campo. Mostra as ações
restantes do participante da vez e zero disponíveis para quem aguarda, mantendo
o total por turno no indicador. O contador global foi removido da barra superior.
As próprias pilhas são botões acessíveis por clique, toque e teclado: compra
despacha a ação normal `comprar`; descarte abre a consulta pública sem ação, mesmo
vazio. Pilhas adversárias de compra continuam sem interação e sem identidades.
Os botões Comprar carta e Ver descarte continuam como alternativas.

`eliminar` usa `Motor.eliminarCarta`, custa uma ação e aceita somente a criatura
do próprio dono em batalha durante sua vez. O cliente pede confirmação; cancelar
não gasta ação. A morte aplica descarte de equipamentos e auxiliares vinculados,
fim de Pandora e heranças normais, com pontuação e encerramento automáticos.
Campeão soma uma derrota ao próprio dono; besta não pontua. A terceira derrota
pode eliminar o dono, encerrar o duelo ou avançar o mata-mata. A ação é validada,
publicada e persistida pelo controlador como as demais. A IA normal não recebe
uma nova preferência por eliminar suas criaturas.

O treino agora tem 18 etapas e usa Guss Deus do Design no lugar de Fenrir como
reserva. Ensina compra clicando na pilha, contador junto ao nome, eliminação da
própria Marie Curie, consulta gratuita de seus quatro descartes e entrada de Guss.
Termina com dois ataques e uma vitória real por três campeões adversários, com
uma derrota própria. Continua com dez cartas únicas e atributos reais. A etapa
de consulta é uma confirmação local do guia, sem mudar ações ou revisão do jogo.

No ajuste visual 2.565, o indicador junto ao nome tem fonte maior e em negrito,
fundo e borda contrastantes e marcadores de 12 pixels. O participante da vez recebe
fundo e borda dourados; marcadores preenchidos indicam ações restantes e os vazados,
ações gastas. As regras e a contagem permanecem iguais em todos os modos.
No ajuste 2.570, os selos de vez e confronto compartilham a mesma fonte, peso,
altura mínima e espaçamento interno do contador de ações, preservando suas cores.
No ajuste 2.575, o nome usa o mesmo tamanho de fonte, sem fundo ou moldura, e o
selo de vez passa à paleta escura e dourada do contador da vez. “Joga agora” mantém
o verde e o tamanho padronizado.
No ajuste 2.580, texto, números, marcadores e espaçamentos do indicador de
campeões derrotados foram ampliados proporcionalmente em 20%. A contagem não mudou.

### Tutorial revisado (2.585)

O tutorial foi conferido com os controles das páginas de jogo e organizado por
assunto no índice. Abrange turno com OK, treino de 18 etapas, modos e lobby,
representantes, ações e pilhas, combate e eliminação, arenas e alvos, habilidades
e estados, máquinas e dificuldades, mata-mata e espectadores, retomada e
visualização, catálogo, changelog e resultados/revanche. As habilidades completas
de cada carta continuam disponíveis pelo catálogo e pelo painel da partida.

### Confusão e paralisia (2.595)

Irineu publica o autoataque de início de turno, incluindo dano e defesa restante.
A confusão permanece na carta durante a vez afetada e só diminui no encerramento.
Thor Circuito publica a aplicação da paralisia contra universo Game, ou informa
quando causa apenas dano contra outro universo. Paralisia também impede
contra-ataques; o painel desabilita atacar e explica as ações ainda possíveis.
As etiquetas mostram duração e reaplicar Thor não encurta uma paralisia maior.
Os valores do catálogo e a amplificação pelo Fuleco foram mantidos.

### Avisos do treino (2.600)

A partida para iniciantes apresenta o HUD de início de turno somente na explicação
inicial, com destaque no OK. Nas próximas vezes humanas, o guia continua sem nova
confirmação. A conclusão usa o próprio guia, sem modal ou botão de resultado
redundante; Jogar novamente reinicia o treino e Jogar no Local abre o modo normal.
As partidas normais preservam a confirmação de cada turno e o resultado completo.

### Partida TUTORIAL e orientação visual (2.620)

A homepage prioriza Jogar Partida TUTORIAL e mantém Jogar agora ao lado.
O modo guiado usa o nome Partida TUTORIAL em seus acessos. O guia tem fonte maior,
barra de etapas e Mostrar onde clicar em destaque. Setas animadas apontam para
cartas, ações e confirmações, acompanhando rolagem e redimensionamento sem bloquear
cliques. Alvos fora da área visível podem ser encontrados pelo botão de ajuda.
Depois de 15 segundos sem avançar, uma segunda seta lembra desse botão; o lembrete
reinicia por etapa e é suspenso na vez da máquina e em confirmações modais.
A preferência por movimento reduzido mantém setas estáticas. A partida continua
com dez cartas, 18 etapas e o mesmo roteiro de regras.


### Habilidades em pixel art (2.720 — BETA)

O Dino do Google é invocado por uma abertura na própria carta, corre, salta sobre
seu alvo e volta à carta. O dano permanece o definido no motor (incluindo Fuleco,
proteções e limite de turnos). Kappa e Toxic Ran usam a mesma abertura com avatares
próprios, seguida de veneno ou água. Fogo e veneno têm oito quadros de animação
cada e aparecem abaixo do nome da criatura afetada. Outros efeitos identificam
ataques, raios, confusão, cura, defesa, busca, captura e reciclagem.

A câmera acompanha a invocação e restaura a visualização anterior ao terminar.
Rolagem, toque ou teclado têm prioridade e interrompem esse acompanhamento. As
atualizações chegam normalmente do servidor e são apresentadas em ordem, sem
permitir outra ação durante o efeito. Os avisos, o descarte e a vitória aparecem
após a animação. Filas muito atrasadas recuperam o estado recente, sem reproduzir
um histórico longo. Reconexão, pausa, troca de pessoa no dispositivo e movimento
reduzido não repetem ataques visuais nem alteram dano ou pontuação.

Os botões de compra/descarte ficaram menores, mantendo a área de toque. O
Tabuleiro completo (disposição linear) preserva a ampliação proporcional de 25%;
a outra visão mantém suas medidas. Um toque seleciona e leva à descrição após
0,8 s; dois toques em até 0,6 s jogam a carta da própria mão ou ativam uma habilidade
ativa própria em campo. Passivas e cartas do adversário não executam ações por
esse atalho. As classes aparecem na própria carta.

A Partida TUTORIAL agora tem 20 etapas, incluindo a alternância de visão, aguarda
os efeitos e termina com Jogar novamente, Voltar ao menu e Jogar no Local.
Os [créditos e fontes dos sprites](public/assets/efeitos/README.md) acompanham os
recursos. Os efeitos usam CSS, SVG e o navegador, sem nova biblioteca de execução.

Validação desta versão: `npm test` passou com 301 testes, 51 verificações de
habilidades e 600 partidas aleatórias. A conferência no Chromium percorreu as
20 etapas do tutorial em desktop e celular, os efeitos no multiplayer/co-op/2v2,
a câmera manual e automática, pausa, saída e sincronização em segundo plano.


### Invocações completas e ritmo (2.970)

`public/sprites.js` centraliza 46 perfis visuais: personagens, armas, itens,
feitiços e representantes, incluindo o sprite oficial do Dino. A Grávida dos
Robôs permanece sem novo personagem até Luciano enviar seu design. Cada efeito
usa o evento verdadeiro do motor: origem, alvo público, valor e zona apropriada.
O perfil n036 foi corrigido para Toxic Ran; não existe carta Leviatã no catálogo
atual. A habilidade remove os apoios/equipamentos de água adversários e não causa
dano ao campeão. Pandora indica todas as criaturas atingidas pelo efeito, sem
dano no lançamento; peixes e bolhas distinguem as duas armas de anulação.

A duração é orçada por ação, com cenas simultâneas para vários alvos, retorno de
câmera de 280 ms e voo de cartas de 1.050 ms, mantendo o conjunto entre um e cinco
segundos. Cópia usa o efeito realmente copiado; Kitsune retorna ao lado próprio;
herança indica reserva para o próximo campeão; o último uso do Dino mostra o
cacto. As regras numéricas não foram rebalanceadas. As máquinas aguardam 3,8 segundos
entre passos (com pequena variação no Local), dando tempo para os efeitos
terminarem sem acumular uma longa fila de animações.

Os sprites também servem de ilustração provisória quando uma carta não tem imagem
cadastrada. Artes fornecidas depois têm prioridade. Fogo e veneno têm uma nova
versão mais pixelada. Indicadores sob o nome incluem ainda paralisia, confusão,
zumbificação e anulação. As quatro páginas de partida carregam o mesmo módulo.

Validação 2.970: 311 testes, 51 verificações de habilidades e 600 partidas
aleatórias. Chromium confirmou as 20 etapas do tutorial em desktop/celular,
12 cenas com ações reais por formato de tela, os 46 modelos e as proteções de
câmera manual, pausa, saída, reconexão e segundo plano.


### Estados e cartas persistentes (3.970 — BETA)

Alterações solicitadas por Luciano. A autorização posterior inclui commit e push
deste conjunto junto aos ajustes do Dino na versão 3.990.

Thor Circuito mantém a condição de atingir universo Game e passa a paralisar por
três oportunidades de ação do dono: duas no primeiro turno e a primeira do
seguinte. Suspende ataques, contra-ataques, habilidades da criatura e dos apoios
vinculados; não impede comprar, equipar, lançar cartas da mão ou eliminar a própria
criatura. Ações recusadas não consomem tempo. Encerrar um turno faz as oportunidades
não utilizadas passarem. Fuleco amplia para seis oportunidades; o efeito fica na
criatura, sem paralisar globalmente o invocador. `st.paralisia` agora conta ações,
com migração de salvamentos antigos em `Partida.restaurar`.

Irineu provoca autoataque em dois turnos próprios do alvo (quatro com Fuleco),
preservando recarga de três. Benito recusa qualquer auxiliar/equipamento vinculado,
sem imunidade geral: novos anexos são recusados sem custo; se a passiva passar a
valer por cópia, os anexos existentes vão ao descarte.

Pandora permanece na zona pública `j.feiticos`, à esquerda do tabuleiro e no centro
vertical, enquanto o efeito estiver ativo. O dano continua no início do turno do
dono de cada criatura, até uma delas morrer. Os projéteis visuais partem da carta
persistente. Ao terminar, ela é descartada depois da criatura e dos anexos;
continua limitada a três usos, com descarte permanente depois do terceiro.
Não integra a reciclagem enquanto ativa. As visões, o salvamento/restauração e as
verificações de conservação incluem a nova zona, sem duplicar instâncias.

Eventos públicos de lançamento revelam apenas o feitiço efetivamente usado. Ele
sai da mão para o centro, revela sua face e libera o efeito; a câmera acompanha
e restaura a visualização anterior, respeitando navegação manual. O descarte ou
o movimento para a zona persistente parte do centro. As outras cartas da mão
adversária continuam ocultas. Os dois descartes exibem sua carta do topo.

O atlas original `estados-extra.svg` contém doze estados com quatro quadros de
16×16 px: paralisia, confusão, zumbi, peixe, bolha, canto/anulação, cópia, escudo,
amplificação, recarga, Dino e recusa. O gerador é `scripts/gerar-estados.js`.
Os modelos aprovados de Toxic Kappa e Toxic Ran não foram alterados.

Validação 3.970: 331 testes, 52 verificações de habilidades e 600 partidas
aleatórias. Chromium conferiu os lançamentos/estados em desktop e celular,
Pandora no co-op/2v2/mata-mata, pausa/saída/reconexão/segundo plano, movimento
reduzido e as vinte etapas da Partida TUTORIAL nos dois formatos de tela.


### Dino e encerramento de turno (3.990 — BETA)

O Dino executa três ataques, no fim do 2º, 4º e 6º turnos do dono. Turnos de outros
participantes não avançam o prazo. Fuleco amplia para 8 de dano e seis execuções
em doze turnos próprios, mantendo o intervalo de dois. Anulação, proteção ou
falta de alvo consomem a execução; a morte da criatura vinculada o descarta antes.
No último ataque, o Dino corre até o cacto sobre o descarte do próprio dono,
colide e desaparece antes do voo da carta para a pilha. O mesmo encerramento
visual ocorre ao esgotar o prazo sem alvo. A câmera acompanha e respeita navegação
manual. O controlador migra uma única vez os prazos dos salvamentos antigos.

O botão Encerrar turno fica abaixo da pilha de compra da própria pessoa em todos
os modos e nas duas visões. O aviso de ações esgotadas mantém seu atalho, e as
setas da Partida TUTORIAL usam a posição nova.

Validação 3.990: 333 testes, 52 verificações de habilidades e 600 partidas
aleatórias. Chromium confirmou a posição da compra/encerramento, o cacto sobre
o descarte do dono, a colisão antes do voo da carta, os ataques nos turnos 2/4/6
e o fim sem alvo no desktop e celular, incluindo multiplayer, Local 2v2 e co-op.
As vinte etapas da Partida TUTORIAL passaram nas duas telas.

### Câmera mais suave (3.995)

O acompanhamento amortece a velocidade e limita o deslocamento a 750 pixels por
segundo em cada eixo. Uma faixa livre no enquadramento evita pequenas correções
contínuas, e a rolagem da arena é descontada antes de ajustar a página. O retorno
à posição anterior dura 650 ms, com aceleração e desaceleração graduais. O intervalo
entre ações da IA passa a 4,2 segundos para acomodar o retorno; as ações visuais
continuam dentro do orçamento de cinco segundos. Navegação manual, pausa e
movimento reduzido mantêm suas proteções.

Luciano aprovou os sprites. O personagem da Grávida dos Robôs fica adiado por sua
orientação, sem bloquear o desenvolvimento.

### Pixel arts no catálogo e no banco (4.000)

Os 46 desenhos aprovados têm arquivos SVG independentes em `public/assets/cartas`,
incluindo o Dino com seus pixels originais incorporados. O banco guarda o caminho
em `cartas.imagem`, e catálogo, detalhes e mesa exibem esse mesmo arquivo. Imagens
já cadastradas são preservadas; Grávida dos Robôs continua sem novo personagem.
A cópia offline inclui os caminhos e resolve os arquivos locais sem precisar da API.

O servidor atualiza as imagens vazias ao preparar a tabela, antes de liberar as
consultas de cartas. A atualização usa uma transação e pode ser repetida; não
altera atributos, habilidades nem sessões. Também pode ser aplicada separadamente
ao banco configurado no `.env` com `npm run pixelarts:banco`, sem executar o seed.
O seed atribui as imagens a cartas novas. Para reexportar os desenhos após uma
alteração em `public/sprites.js`, use `npm run pixelarts:gerar`.

Validação desta entrega: suíte completa aprovada, mais o teste de recuperação da
preparação após falha temporária; 52 verificações de habilidades e 600 partidas
aleatórias. O banco local recebeu 46 caminhos, preservando atributos e artes
existentes; repetir a atualização não modifica nenhuma linha. Chromium conferiu
câmera, retorno, navegação manual, pausa e movimento reduzido, além das 46 imagens
do catálogo e dos detalhes em desktop/celular, com API e cópia offline. O servidor
real também entregou as 46 ilustrações após preparar o banco.

### Zumbificação e avisos de ações inválidas (4.010)

Gorro Verde recusa criaturas do universo zumbi e criaturas já transformadas, antes
de modificar a defesa. A recusa não gasta ações, não altera a defesa máxima e não
publica efeitos; o bloqueio de reaplicação permanece após salvar e retomar a partida.
Fuleco não permite transformar uma criatura naturalmente zumbi.

Na mesa compartilhada dos modos Local, multiplayer, co-op e tutorial, os avisos
de erro ficam abaixo do controle ou da carta que originou a tentativa, com as
cores e a tipografia existentes. No painel o aviso reserva espaço; na arena ele
acompanha a rolagem sem ser cortado pelas fileiras. Respostas atrasadas mantêm a
origem correta, e escolhas/confirmações conservam o controle que abriu o diálogo.
Uma nova seleção, ação, turno, pausa ou saída limpa o aviso. A proteção de etapas
do tutorial mantém sua própria apresentação, posicionada abaixo do controle usado.

Validação 4.010: 352 testes, 52 verificações de habilidades e 600 partidas
aleatórias. Chromium conferiu os quatro modos em desktop e celular: botões,
pilhas, dois toques, escolhas, confirmações, respostas atrasadas, encerramento
dentro do modal, rolagem e limpeza dos avisos. A página real do tutorial também
foi conferida nos dois tamanhos de tela.

### Câmera sincronizada às ações (BETA 4.020)

A câmera usa os prazos da própria animação para enquadrar a origem, o impacto e
o retorno, antecipando o alvo antes de o efeito acontecer. A distância define
a velocidade necessária em cada trecho. Feitiços são enquadrados antes de sua
revelação, e o Dino chega ao descarte com o cacto visível antes da colisão.
O retorno à vista anterior mantém 500 ms. Navegação manual, pausa e movimento
reduzido conservam suas proteções, sem acrescentar espera às ações.

O changelog identifica todas as versões como BETA e apresenta as datas dos
primeiros registros no histórico Git. Os rodapés das páginas mostram BETA 4.020
à direita. A revisão permanece incluída na BETA 4.020.

Validação: 352 testes, 52 verificações de habilidades e 600 partidas aleatórias.
Chromium conferiu impacto, revelação de feitiços e colisão do Dino em desktop e
celular, incluindo a área ocupada pelo guia do tutorial. Retorno, pausa,
navegação manual e movimento reduzido foram preservados. Também foram conferidos
os 34 registros BETA com datas e a versão nos sete rodapés.
