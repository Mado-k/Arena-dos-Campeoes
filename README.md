# Arena-dos-Campeoes
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

Abra **Local** na página inicial e escolha **Player vs máquina** (1 a 4 pessoas,
com uma máquina por pessoa) ou **Player vs player** (2 a 4 pessoas no mesmo
dispositivo). Cada pessoa escolhe seu representante antes de começar. A cortina de
troca de vez oculta a mão até o próximo jogador confirmar. Com três ou quatro
pessoas competindo entre si, vence o último participante que não perdeu três campeões.

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

O duelo tem dois jogadores. O co-op aceita **de 1 a 4 pessoas**, com **uma máquina
por pessoa presente no lobby**. Não há seletor de formato: o anfitrião pode iniciar
sozinho ou esperar convidados. Ao entrar ou sair alguém, a contagem de máquinas é
atualizada e todos precisam confirmar prontidão novamente. Após o início, a
quantidade fica fixa; novas entradas são permitidas apenas antes da partida.

Humanos e máquinas têm **duas ações por turno**, em ordem alternada: jogador 1,
máquina 1, jogador 2, máquina 2, e assim por diante. O sistema pula eliminados e
executa automaticamente todas as máquinas consecutivas até chegar a um humano
ativo. Cada participante tem mão, campo, auxiliares, equipamentos, descarte e
baralho individuais. Mesmo os aliados não veem sua mão.

Metade das cartas únicas vai para cada equipe, dividida entre os integrantes sem
repetições. Com 40 cartas: no 1 × 1 são 20 por participante; no 2 × 2, 10; no 3 × 3,
a divisão por equipe é 7/7/6; no 4 × 4, são 5 por participante. Se a sala foi criada
com 20 cartas e chega a três pessoas, o total sobe para 30; com quatro, sobe para
40. Cada participante recebe pelo menos cinco cartas no total, incluindo as três
da mão inicial. O lobby informa o ajuste e recalcula o total quando alguém sai.
A mão inicial de cada participante inclui um campeão distinto.

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
- n001 busca a primeira metálica do baralho; n008 captura passivamente cartas
  adversárias do universo Normal em jogo, devolvendo anexos de outros universos
  à mão do dono anterior; n009 duplica passivamente os efeitos numéricos das outras
  cartas do próprio dono enquanto estiver em apoio.
- Fuleco amplia danos de habilidades, bônus, multiplicadores, quantidades e duração;
  não dobra o ataque básico, custos, recargas, intervalos nem usos únicos.
  Efeitos já aplicados conservam os valores; bônus passivos são recalculados.
- Hércules dobra cumulativamente a cada três turnos próprios. Kitsune retorna uma
  vez por partida com equipamentos e auxiliares; Dino sai junto com sua criatura;
  n025 mantém a proteção divina e Guss aplica a habilidade copiada imediatamente.
- No Local e no multiplayer, a reciclagem espera os dois baralhos vazios, reúne
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


No Local entre três ou quatro pessoas, a redistribuição espera os baralhos de todos
os participantes ativos acabarem, reúne os descartes e divide entre os sobreviventes;
o restante fica no centro. A mesma condição de impasse vale após quatro redistribuições.
A página inicial (`public/index.html`, `public/index.js` e `public/style.css`) explica
os modos atuais; o pedido antigo que chegou cortado deixou de ser uma pendência.

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
