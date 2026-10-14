# Repository Cleanup and README Design

## Goal

Deixar o repositório do Fit Pro Player limpo, coerente com o produto atual e documentado de forma fiel, sem remover código ou assets usados pelo frontend, Supabase, Capacitor, testes ou deploy.

## Scope

- Auditar arquivos rastreados, imports, referências de build, scripts, documentação e assets.
- Remover artefatos de experimentação, auditorias concluídas, logs versionados, scripts temporários e duplicatas comprovadamente não referenciadas.
- Preservar código de runtime, testes, migrations, assets publicados, arquivos nativos, segurança e documentação operacional necessária.
- Reescrever o README em português com a arquitetura atual, fluxo local-first/Supabase, comandos reais, testes, build, deploy e estrutura do projeto.
- Usar no topo do README o logo oficial `assets/brand/final/web/brand-logo.svg`, centralizado, sem repetir o nome da marca em texto.
- Atualizar links e descrição do site para `https://www.fitpp.com.br`.

## Safety Rules

- Não apagar por nome ou idade; cada remoção precisa ter evidência de ausência de referência em código, scripts, configuração, testes e deploy.
- Não remover migrations aplicadas, arquivos de compatibilidade, assets carregados por caminho dinâmico ou recursos Capacitor.
- Não alterar comportamento do produto como parte da limpeza.
- Não commitar `.env`, dados de usuário, builds, dependências ou logs locais.
- Quando uma funcionalidade estiver documentada e implementada, a documentação será atualizada; quando estiver apenas documentada e não existir no código, a documentação será corrigida em vez de criar a funcionalidade.

## Deliverables

1. Relatório de auditoria interno com itens removidos, mantidos e ambíguos.
2. Repositório sem artefatos comprovadamente mortos ou temporários.
3. README atualizado e compatível com o projeto atual.
4. Verificações de imports, testes, build e configuração do deploy.
5. Commits enviados para `main` e `master`.

## Verification

- `npm test`
- `npm run build`
- `npm run check:supabase`
- `npm run check:database` quando o ambiente local permitir
- busca final por referências quebradas a arquivos removidos
- inspeção final de `git status`, arquivos rastreados e README renderizável
