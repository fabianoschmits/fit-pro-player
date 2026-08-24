# Fit Pro Player MCP

Servidor MCP opcional e somente leitura para consultar dados de uma instalação self-hosted.

## Uso

```powershell
Set-Location mcp
npm ci
$env:FITPROPLAYER_DATA = "C:\caminho\para\data"
npm start
```

Se houver vários perfis, defina `FITPROPLAYER_UID` com o id desejado. O processo lê `db.json` e `state-<uid>.json`; ele não modifica os arquivos.

Antes de usar:

```powershell
npm test
npm run check:node-loadable
```
