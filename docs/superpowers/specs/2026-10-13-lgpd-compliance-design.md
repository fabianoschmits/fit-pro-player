# Sistema LGPD — Especificação de Design

## Objetivo

Dar ao Fit Pro Player um fluxo de privacidade implementável e verificável: transparência pública, consentimentos versionados, exercício autenticado de direitos do titular, exportação, correção, exclusão, retenção e controles de segurança sem inventar a identidade jurídica do controlador.

## Limites legais

O produto trata dados cadastrais e dados de treino, medidas corporais e objetivos de saúde potencialmente sensíveis. A aplicação não declara conformidade jurídica automática; o conteúdo final deve ser revisado pelo controlador/encarregado. Nome, contato, endereço, operadores, transferências e prazos serão valores configuráveis obrigatórios antes da publicação.

## Decisões

- O controlador será configurado em `frontend/src/lib/privacy-config.js`; valores ausentes aparecem como aviso de configuração incompleta, nunca como identidade inventada.
- O Aviso de Privacidade e os Termos serão páginas públicas e terão versão/d data de publicação.
- Consentimentos obrigatórios e opcionais serão separados, versionados e persistidos por usuário; revogação de opcionais não apaga dados automaticamente.
- Solicitações LGPD serão autenticadas, terão protocolo, status, tipo, data e resposta; o backend nunca aceitará o `user_id` vindo do cliente.
- Exportação será gerada apenas para o próprio titular e incluirá dados pessoais e metadados de origem em JSON estruturado.
- Exclusão seguirá o fluxo já existente de exclusão autenticada, acrescentando confirmação, pendências e informação sobre retenções legais.
- Profissionais só verão dados de alunos dentro dos vínculos e finalidades atuais; o sistema não adicionará medidas corporais pessoais às projeções profissionais sem consentimento específico.
- Nenhum analytics ou cookie não essencial será ativado sem consentimento separado.

## Superfícies

- Público: `/privacy`, `/terms`, `/data-rights` e links no rodapé/landing/login.
- Autenticado: `/settings` com “Privacidade e dados”, consentimentos, exportação, solicitações e exclusão.
- Cadastro: aceite obrigatório com links e versões dos documentos; opcionais separados.
- Backend: tabelas de documentos/consentimentos/solicitações, RPCs caller-only, RLS, auditoria mínima e migração de retenção.

## Critérios de aceitação

1. Uma pessoa consegue localizar o Aviso de Privacidade antes do cadastro e dentro do produto.
2. O cadastro não conclui sem aceitar Termos e Aviso de Privacidade vigentes.
3. Consentimentos opcionais podem ser concedidos e revogados separadamente.
4. Um titular autenticado pode confirmar/acessar, corrigir, exportar, solicitar eliminação e consultar o status de cada pedido.
5. Outro usuário não consegue ler, criar ou alterar solicitações, consentimentos ou exportações alheias.
6. Exclusão bem-sucedida remove os dados operacionais previstos e comunica retenções excepcionais; falha preserva os dados e informa o usuário.
7. O sistema identifica configuração jurídica incompleta sem bloquear o modo demo/local.
8. Testes de frontend, RPC/RLS e build comprovam os fluxos principais.

## Dependências externas

Antes da publicação, preencher controlador, encarregado/canal, operadores, transferências internacionais, retenções e bases legais com revisão jurídica. A implementação não substitui essa revisão.
