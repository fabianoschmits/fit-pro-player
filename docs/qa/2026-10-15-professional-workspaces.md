# Refatoração das áreas profissionais

## Escopo entregue

- Meus profissionais, materiais, convites recebidos e detalhes de profissionais.
- Área profissional, alunos, vínculos, histórico, convites e programas com seus editores.
- Perfil profissional e formulário de criação/edição.
- Seções transparentes sem cards, listas compactas e navegação por texto, sem fundo ou marcações coloridas na página ativa.
- Layout mobile-first, controles de toque de 44 px, temas claro/escuro e uso das cores e fontes do projeto.
- Programa e próximo treino priorizados para o aluno; dados do programa e organização de dias recolhíveis no editor.
- Entradas profissionais visíveis em Mais, inclusive criação do perfil para contas sem acesso profissional.
- Recuperação de erro ao mudar de rota, sem desmontar formulários saudáveis do workspace.

Não houve alteração de banco, permissões, vínculo, prescrição ou sincronização de dados. As migrações existentes continuam suficientes para esta alteração visual.

## Verificação em 15/10/2026

- Build web de produção: aprovado (`node node_modules/vite/bin/vite.js build --logLevel=warn`).
- Build web do aplicativo mobile: aprovado (`node node_modules/vite/bin/vite.js build --mode=mobile --logLevel=warn`). Não é uma compilação de binários Android/iOS.
- Matriz e fluxos profissionais: 34 testes de navegador aprovados; 14 entradas ignoradas intencionalmente por repetirem a matriz de viewports no segundo projeto do Playwright.
- Matriz: 20 rotas em 320, 360, 390, 1280 e 1440 px, nos temas claro e escuro, verificando overflow, navegação ativa visível e ausência de fundo/sombra na navegação.
- Após o ajuste final de recuperação de erros: 11 testes de navegador aprovados, incluindo publicação/envio, materiais, criação de programas, layout de 320 px e recuperação com Voltar, em desktop e celular; uma repetição da matriz ignorada intencionalmente.
- Regressão da Central da plataforma: quatro testes de navegador aprovados.
- Suíte completa Vitest: 984 testes aprovados e duas falhas preexistentes, descritas abaixo.
- Pacotes de tradução: 11 idiomas com 1.439 chaves sincronizadas; verificação de português aprovada. Os três textos novos foram incluídos em todos os idiomas.
- Revisão independente: um problema de recuperação de erro identificado e corrigido, com testes unitários e de navegador.

## Pendências preexistentes, fora do escopo visual

`frontend/src/views/Settings.auth.test.jsx`:

- `offers professional onboarding to an authenticated account without the professional capability`: espera uma entrada de onboarding dentro de Configurações. A entrada profissional atual fica em Mais.
- `uses the Supabase email as the account identity without exposing legacy admin UI`: espera também o texto “Conectado à sua conta”, além do e-mail exibido atualmente em Mais.

`node scripts/check-source-strings.mjs --strict` ainda encontra 18 textos sem definição nos pacotes: 17 da interface de compartilhamento de treinos e `Local profile` em Mais. Nenhum dos três textos novos desta refatoração permanece sem tradução.

## Comandos dos testes de navegador

Executar a partir de `frontend`:

```powershell
node node_modules/@playwright/test/cli.js test --config=playwright.management.config.js --output=test-results/management-final
node node_modules/@playwright/test/cli.js test --config=playwright.console.config.js --output=test-results/console-final
```

A configuração profissional usa a porta 8083, preservando o servidor de desenvolvimento em 8080. Os testes usam dados locais simulados e não enviam mensagens nem modificam contas reais do banco.
