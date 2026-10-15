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
- Suíte completa Vitest após a correção das duas falhas iniciais: 989 testes aprovados, sem falhas, em 125 arquivos.
- Identificação e acesso profissional: 14 testes unitários direcionados e dois testes de navegador aprovados, cobrindo desktop e celular.
- Pacotes de tradução: 11 idiomas com 1.439 chaves sincronizadas; verificação de português aprovada. Os três textos novos foram incluídos em todos os idiomas.
- Revisão independente: um problema de recuperação de erro identificado e corrigido, com testes unitários e de navegador.

## Duas falhas iniciais corrigidas

- A verificação antiga de onboarding em `Settings.auth.test.jsx` foi substituída pela cobertura da navegação atual: o teste unitário de Mais verifica a rota `/professional/profile`, e o teste de navegador confirma que o clique em **Mais → Profissional → Tornar-se profissional** abre o formulário de criação em desktop e celular.
- O teste de identidade de conta em `Settings.auth.test.jsx` agora passa sem remover suas verificações. A interface usa “Conectado à sua conta” quando o nome está vazio ou contém apenas espaços, preserva nomes preenchidos e continua identificando contas anônimas como convidadas. Foram adicionados testes de regressão para esses casos.

## Pendência de tradução preexistente, fora desta correção

`node scripts/check-source-strings.mjs --strict` ainda encontra 18 textos sem definição nos pacotes: 17 da interface de compartilhamento de treinos e `Local profile` em Mais. Nenhum dos três textos novos desta refatoração permanece sem tradução.

## Comandos dos testes de navegador

Executar a partir de `frontend`:

```powershell
node node_modules/@playwright/test/cli.js test --config=playwright.management.config.js --output=test-results/management-final
node node_modules/@playwright/test/cli.js test --config=playwright.console.config.js --output=test-results/console-final
```

A configuração profissional usa a porta 8083, preservando o servidor de desenvolvimento em 8080. Os testes usam dados locais simulados e não enviam mensagens nem modificam contas reais do banco.
