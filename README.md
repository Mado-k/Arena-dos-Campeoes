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
| `PORT` | Porta HTTP do Node; padrão `16171` |
| `DB_PORT` | Porta MySQL informada pelo Aiven; padrão local `3306` |
| `DB_SSL` | Use `true` para habilitar TLS no banco |
| `DB_SSL_CA` | Caminho do certificado CA, quando exigido pelo serviço |

Para o Aiven, use `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` e `DB_NAME` do
serviço, com `DB_SSL=true`. A validação do certificado fica ativa. Não execute o
SQL de criação de banco local sobre o serviço remoto: use o banco já provisionado.
Esta alteração foi validada com MariaDB local; o acesso ao seu Aiven depende das
credenciais e permissões configuradas no seu Codespace.

Sirva o site pelo próprio Node para usar a mesma origem. Se usar Live Server na
porta `5500`, `public/config.js` aponta para a porta Node `16171`, inclusive nos
endereços encaminhados do Codespaces. Se você mudar essa porta, ajuste `PORTA_NODE`
nesse arquivo, ou defina `window.ARENA_API` antes de carregar `config.js`. No GitHub
Pages, o endereço da API hospedada continua sendo o Render já configurado.
O servidor precisa estar acessível aos convidados; não compartilhe a porta do banco.

## Partidas online

1. Abra Multiplayer ou Co-op, informe o apelido e crie a sala.
2. Compartilhe o convite e aguarde os amigos entrarem.
3. Todos devem clicar em **Estou pronto**; o anfitrião clica em **Iniciar partida**.
4. Selecione uma carta para ler sua habilidade e ver suas ações. Use **Comprar carta**
   ou **Encerrar turno** nos controles da mesa.

O duelo tem dois jogadores. No co-op, de dois a quatro humanos compartilham uma
equipe (mão, campo, descarte e duas ações por turno) contra o computador. Todos os
integrantes veem a mão da equipe; a mão e a ordem do baralho do computador ficam
escondidas. A IA usa as ações e habilidades do mesmo motor; é um adversário básico,
sem níveis de dificuldade ou balanceamento específico de co-op.

O servidor valida turno, dono da carta, ações restantes e versão da mesa. O cliente
não pode alterar atributos nem usar as correções manuais do offline. Pedidos de
escolha de habilidade são enviados somente a quem executa a ação. O registro público
resume as ações para evitar revelar cartas compradas ou escolhidas no baralho.

Salas e partidas ficam em memória: reiniciar o servidor encerra as partidas.
Se alguém sair ou perder a conexão, a partida é encerrada sem atribuir vitória;
os restantes podem preparar uma nova partida. Não há retomada após desconexão.
Não entram novos jogadores numa partida em andamento.

## Regras mantidas e decisões pendentes

- Ataque e defesa zero em feitiços, auxiliares e equipamentos são válidos; não são
  valores faltantes que precisem ser preenchidos automaticamente.
- Mantidas as interpretações atuais das habilidades, inclusive `sonoro` e `feitiço`.
- Apoios não ganham novo ataque direto ou duração padrão. O motor continua atacando
  apenas a criatura em batalha, e efeitos específicos existentes continuam valendo.
  Luciano e os demais desenvolvedores ainda decidirão sobre dano direto e duração.
- D007 (Rei da Arena dos Campeões) conserva defesa 400 e não recebe nova habilidade.
  Os representantes não voltam a funcionar como vida dos jogadores. A condição de
  vitória permanece derrotar três campeões adversários.
- O último pedido do index foi cortado em “e por fim,”: dossiê, seção 4, item c;
  também mencionado nas seções 10 e 13. O complemento não consta do material.
  A página inicial fica em `public/index.html`, `public/index.js` e `public/style.css`.

## Validação

```bash
npm test
```

A suíte inclui os testes fornecidos no ZIP: 51 verificações de habilidades e 600
partidas aleatórias, além de testes de autoridade, privacidade, co-op/IA, configuração
de portas/TLS e conexões reais Socket.IO. Os testes Socket.IO abrem portas locais
temporárias e não usam o banco Aiven.

O site estático já tem publicação da pasta `public/` no workflow do GitHub Pages.
Para usar as partidas no site publicado, atualize também o backend no Render: o
Pages sozinho não executa Node, banco ou Socket.IO. Nenhum deploy é feito pelos
comandos de teste.
