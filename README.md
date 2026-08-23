# Royli

<div align="center">

### ⚔️ Clash Royale dentro do Discord

Consulte um jogador e veja as principais informações em um painel interativo, limpo e organizado.

[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Discord.js 14](https://img.shields.io/badge/Discord.js-v14-5865F2?logo=discord&logoColor=white)](https://discord.js.org/)
[![Status](https://img.shields.io/badge/status-estudo%20e%20desenvolvimento-orange)](#objetivo-do-projeto)
[![Direitos autorais](https://img.shields.io/badge/licença-direitos%20reservados-red)](./LICENSE)

</div>

## Sobre

Royli é um bot de Discord criado por **SiriusXofc** como projeto de estudo. O desenvolvimento explora comandos slash, componentes interativos, cache, atualização automática, integração entre serviços e organização de um projeto Node.js para publicação no GitHub.

O bot não é afiliado à Supercell, não altera contas e não acessa informações privadas. Ele exibe somente os dados públicos disponibilizados pelo serviço de dados configurado pelo administrador da instalação.

O projeto também possui um serviço interno em Go para ambientes de produção. Ele é um componente privado da instalação do Royli, não uma API pública para terceiros; detalhes operacionais e credenciais não são publicados.

## O comando

```text
/jogador tag:#TAGDOPLAYER
```

O parâmetro deve ser a tag do jogador. A consulta por nome não é suportada porque nomes não são identificadores únicos.

## O painel

Após a consulta, o bot responde com uma mensagem ephemeral e um painel Components V2. O select menu troca as seções na mesma mensagem:

| Seção | Conteúdo |
| --- | --- |
| **Resumo** | Nome, tag, nível, troféus, melhor marca, arena, win rate e desempenho |
| **Cartas** | Coleção, níveis, cópias e imagens das cartas disponíveis |
| **Batalhas** | Até 10 batalhas recentes, resultado, coroas, tipo e adversário |
| **Clã** | Nome, tag, membros, pontuação e cargo do jogador |

O resumo também apresenta o deck atual em uma galeria de imagens. O layout foi pensado para concentrar a consulta em uma única interação, sem espalhar as informações em várias mensagens.

## Atualização automática

O bot possui um gerenciador de painéis que pode atualizar mensagens não ephemeral em intervalos configuráveis. As respostas ephemeral são mantidas privadas e, por isso, não entram no ciclo de atualização contínua.

## Privacidade e limites

- O bot não recebe senha, e-mail, token de conta ou credencial do jogador.
- Não há login de conta do Clash Royale.
- Não há alteração de deck, cartas, clã ou qualquer dado do jogo.
- O histórico exibido depende dos dados recentes disponibilizados para o jogador.
- Indisponibilidade, limite de requisições ou mudança no formato dos dados pode impedir uma consulta.
- Imagens são exibidas a partir das referências recebidas; o Royli não mantém uma biblioteca própria de imagens.

## Instalação

### Requisitos

- Node.js `20.18+`;
- Redis em produção, preferencialmente com TLS;
- aplicação criada no [Discord Developer Portal](https://discord.com/developers/applications);
- credenciais do serviço de dados configurado pelo administrador.

### Executar localmente

```bash
git clone https://github.com/SiriusXofc/royli-clash-bot.git
cd royli-clash-bot
copy .env.example .env
npm install
npm run register
npm start
```

No Linux/macOS, use `cp .env.example .env` no lugar de `copy`.

Preencha o `.env` com os valores do seu ambiente. Ele é ignorado pelo Git e nunca deve ser publicado.

### Instalação no Discord

O comando foi preparado para instalação em servidor e instalação por usuário, conforme os contextos configurados na aplicação. O link de instalação deve ser gerado no [Discord Developer Portal](https://discord.com/developers/applications).

Documentação oficial:

- [Aplicações instaláveis por usuário](https://docs.discord.com/developers/tutorials/developing-a-user-installable-app);
- [Application Commands](https://docs.discord.com/developers/interactions/application-commands).

## Configuração

O arquivo [`.env.example`](./.env.example) serve como referência para o ambiente. Ele inclui as configurações do Discord, cache, TLS, atualização automática e conexão com o serviço de dados utilizado pela instalação.

Nunca copie credenciais reais para o README, código, issues, screenshots ou commits. Antes de publicar alterações, revise:

```bash
git diff --cached --name-only
git diff --cached
```

## Organização do código

```text
src/
├─ commands.js              definição do comando /jogador
├─ config.js                validação das variáveis de ambiente
├─ deploy-commands.js       registro dos comandos
├─ index.js                 eventos e interações do bot
├─ panelManager.js          atualização automática dos painéis
├─ registerCommands.js      registro automático ao iniciar
├─ services/
│  ├─ clashRoyale.js        carregamento e cache dos dados
│  ├─ redis.js               cache, locks e namespace
└─ ui/
   ├─ errorPanel.js          painel de erro
   └─ playerPanel.js         resumo, cartas, batalhas e clã

relay/
└─ main.go                   serviço interno de dados em Go
```

## Objetivo do projeto

Royli é um projeto educacional e experimental. Ele foi criado para estudar:

- desenvolvimento de bots com `discord.js`;
- Components V2 e select menus;
- respostas ephemeral e interações assíncronas;
- cache e locks distribuídos;
- atualização automática de mensagens;
- validação de configuração com `zod`;
- separação entre código público e credenciais privadas;
- publicação responsável de projetos no GitHub.

Sugestões e melhorias são bem-vindas, desde que não incluam credenciais, dados privados ou alterações que violem os termos das plataformas utilizadas.

## Direitos autorais

Copyright © 2026 SiriusXofc. Todos os direitos reservados.

Este repositório é público para estudo e inspeção. Não é concedida licença de uso, cópia, modificação, redistribuição ou exploração comercial sem autorização expressa do autor. Consulte [`LICENSE`](./LICENSE).

## Autor

Desenvolvido e mantido por [SiriusXofc](https://github.com/SiriusXofc).
