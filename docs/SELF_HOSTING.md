# Self-hosting do Fit Pro Player

## Docker local

```powershell
Copy-Item .env.example .env
docker compose up -d --build
```

Acesse `http://localhost:8080` e confira:

```powershell
docker compose ps
Invoke-RestMethod http://localhost:8080/api/health
```

Os mapas musculares e as sequências SVG selecionadas do Workout Guide já estão incluídos no app. Nenhum servidor de imagens ou volume de mídia externo é necessário. Contas, estados, segredo de sessão, chaves de push e auditoria ficam em `./data`.

## HTTPS e passkeys

Passkeys são vinculadas ao hostname exato e exigem HTTPS, exceto em `localhost`. Para um domínio como `fit.example.com`:

```dotenv
RP_ID=fit.example.com
ORIGIN=https://fit.example.com
RP_NAME=Fit Pro Player
```

Use Caddy, nginx, Traefik, Cloudflare Tunnel ou outro proxy TLS e encaminhe para a porta `WEB_PORT` (8080 por padrão). Escolha o domínio antes de cadastrar passkeys; trocar `RP_ID` invalida as credenciais existentes.

## Fechar o cadastro público

Depois de criar seu perfil, encontre seu id em `data/db.json` e ajuste:

```dotenv
ADMIN_UIDS=seu-id
INVITE_ONLY=1
ALLOW_GUEST=0
SESSION_DAYS=30
```

Reinicie os containers. Gere convites pelo painel administrativo.

## Backup e restauração

Pare novas gravações ou desligue os containers antes de copiar `./data`. Um backup íntegro dessa pasta restaura contas, passkeys públicas, treinos, segredo de sessão, push e auditoria.

```powershell
docker compose stop
Compress-Archive -Path data -DestinationPath "fit-pro-player-data.zip"
docker compose start
```

Guarde o arquivo cifrado. Restaurar o mesmo `secret` mantém cookies ainda válidos; gere um segredo novo se quiser encerrar todas as sessões.

## Atualização

```powershell
git pull --ff-only
docker compose build --pull
docker compose up -d
```

Confira `docker compose ps`, `/api/health` e os logs antes de remover backups anteriores.
