# Auditoria de limpeza do repositório

Data: 14/10/2026

## Critério

A auditoria foi feita sobre os arquivos rastreados pelo Git, referências em código/documentação e os pontos de entrada (`package.json`, Vite, Vercel, workflows, Supabase e Capacitor). Arquivos de runtime, migrations, testes, assets dinâmicos e geradores de marca foram preservados. Um item só é removido quando não possui referência operacional e é claramente um artefato de trabalho concluído.

## Inventário

| Item | Evidência | Decisão | Motivo |
|---|---|---|---|
| `scratch/` | 10 arquivos rastreados; scripts de auditorias e correções pontuais; nenhuma referência fora do próprio scratch | remover | Ferramentas temporárias e relatório gerado, sem participação em build, testes ou runtime |
| `frontend/scratch/` | 2 scripts rastreados; nenhuma referência em `frontend`, scripts, workflows ou docs | remover | Scripts de investigação encerrada, não são parte do produto |
| `motion-audits/fit-pro-player-2026-09-20.html` | arquivo isolado; nenhuma referência rastreada | remover | Relatório visual histórico, não necessário para desenvolvimento ou publicação |
| `assets/brand/fit-pro-player-brand-kit.zip` | nenhum consumidor; fontes reproduzíveis em `scripts/build-brand-kit.py` e assets finais versionados | manter nesta etapa | Artefato distribuível da marca; não afeta runtime e a remoção seria uma decisão de retenção, não de código morto |
| `assets/brand/concepts/` e `assets/brand/gym-concepts/` | `docs/MOBILE.md` referencia `assets/brand/gym-concepts/a-v2.svg`; scripts de marca usam os masters | manter | São fontes/referências do pipeline de identidade e há dependência documental explícita |
| `frontend/.png-overlay/` | 186 PNGs rastreados; assets são consumidos pela biblioteca de exercícios/animacões | manter | Conteúdo de produto, não lixo gerado |
| `supabase/migrations/`, `supabase/functions/`, `supabase/tests/` | referenciados pelos scripts de verificação e deploy | manter | Backend e contratos ativos |
| `assets/brand/final/web/brand-logo.svg` | asset oficial escolhido para README; também há `frontend/public/brand-logo.svg` para o app | manter | Identidade oficial atual |
| `.github/`, `.gitlab/`, `vercel.json`, `.vercelignore` | configuração de CI/deploy e proteção de arquivos | manter | Entradas de automação/publicação |

## Arquivos locais não rastreados

Há logs e saídas de build no checkout local, além de `.env` local. Eles não aparecem no Git e não serão apagados nesta limpeza, para não destruir estado de desenvolvimento do usuário. O `.gitignore`/`.vercelignore` continua sendo a barreira para que não sejam enviados ao GitHub.

## Resultado da fase de auditoria

Os únicos itens classificados como remoção segura são os diretórios de scratch e o relatório de motion audit sem referências. Não foram encontradas dependências válidas para `api/`, `web/` ou `mcp/` no conjunto rastreado atual; esses diretórios não fazem parte do conteúdo versionado atual. A documentação será atualizada para refletir a arquitetura local real: React/Vite, Supabase, Vercel e Capacitor.
