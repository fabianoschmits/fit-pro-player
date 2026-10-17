# Home Glass — teste de design

Página experimental: `/#/tests/home-glass`.
Acesso pelo admin: **Testes → Home Glass**.

`HomeGlass.jsx` reutiliza a home atual, incluindo os dados reais e suas ações.
O teste altera a apresentação; registrar peso ou iniciar um treino continua
usando o estado normal da conta. Não há uma cópia dos dados.

Todo o visual do experimento fica em `home-glass.css`. Os seletores exigem
`.home-glass-experiment` no documento, inclusive para cabeçalho, navegação e
janelas. Ao sair da página, esse marcador desaparece e os estilos deixam de
se aplicar. A home original e sua folha de estilos não são modificadas.

O visual acompanha o tema claro/escuro. Os botões **Admin** e **Home atual**
permitem sair do teste e comparar as versões.

Integrações externas a esta pasta: registro lazy da rota e cabeçalho em
`App.jsx`, indicação da aba Início em `TabBar.jsx` e link no grupo Testes de
`ConsoleLayout.jsx`.

Validação do experimento, executada a partir de `frontend` (PowerShell):

```powershell
$env:FPP_E2E_PORT = '8092'
npx playwright test --config src/experiments/home-glass/playwright.config.mjs
```

Os testes usam dados fictícios locais. As capturas e resultados ficam em
`frontend/test-results/home-glass/`, ignorado pelo Git.
