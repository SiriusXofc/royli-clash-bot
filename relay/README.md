# Serviço interno de dados

Esta pasta contém um serviço auxiliar em Go usado pelo Royli em ambientes de produção. Ele existe para separar o bot Discord do serviço que fornece os dados necessários ao painel.

## Objetivo

O serviço interno:

- encaminha consultas feitas pelo bot;
- mantém credenciais somente no ambiente privado de execução;
- aplica validações e limites antes de consultar o serviço upstream;
- utiliza cache temporário para reduzir consultas repetidas;
- aplica timeouts e limites de tamanho para controlar consumo de recursos;
- não altera contas, jogadores, clãs ou dados do jogo.

## Segurança de publicação

Este arquivo é propositalmente conceitual. Não documente aqui, em issues ou em commits públicos:

- endereço do ambiente de produção;
- rotas ou formatos de requisição;
- mecanismo de autenticação entre serviços;
- nomes ou valores de credenciais;
- IPs de saída, certificados ou configurações da hospedagem.

Os valores sensíveis devem existir somente nas variáveis privadas do ambiente de deploy. Nunca copie segredos para o código, README, logs, screenshots ou histórico Git.

## Desenvolvimento

```bash
go test ./...
go run .
```

O serviço é uma dependência interna do Royli, não uma API pública oferecida a terceiros. Quem desejar uma integração própria deve construir e operar seu próprio serviço, respeitando os termos das plataformas utilizadas.
