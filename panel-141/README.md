# Painel 141 — Discord Automation Panel

Painel CLI interativo para envio automatizado de mensagens no Discord com suporte a múltiplos usuários simultâneos e mídia (fotos e vídeos).

## Requisitos

- Node.js 18 ou superior
- npm

## Instalação

```bash
cd panel-141
npm install
```

## Uso

```bash
npm start
```

ou diretamente:

```bash
node src/index.js
```

## Menu de Opções

| # | Opção | Descrição |
|---|-------|-----------|
| 1 | Tokens / Usuários | Adicionar, listar e validar tokens do Discord |
| 2 | Usuários Simultâneos | Definir quantos usuários rodam ao mesmo tempo (1–100) |
| 3 | ID do Servidor & Canais | Configurar o servidor alvo e selecionar canais |
| 4 | Mensagens & Mídia | Definir ratio de mídia e caminho do arquivo |
| ► | Iniciar Envio | Dispara o envio com todos os usuários configurados |

## Configuração

Ao rodar, o painel cria um arquivo `config.json` com:
```json
{
  "tokens": [],
  "serverId": "",
  "channels": [],
  "messageRatio": 10,
  "simultaneousUsers": 1,
  "mediaPath": ""
}
```

> ⚠️ O arquivo `config.json` contém seus tokens e **não é enviado ao GitHub** (está no `.gitignore`).

## Ratio de Mídia

Com `messageRatio = 10`, a cada 10 mensagens enviadas, 1 será uma mídia (foto ou vídeo). O arquivo pode ser qualquer formato suportado pelo Discord: `.jpg`, `.png`, `.gif`, `.mp4`, `.mov`, etc.

## Licença

MIT
