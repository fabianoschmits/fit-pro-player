# Aplicação remota da migration profissional

Aplicação realizada em 2 de outubro de 2026, com autorização explícita do usuário, no projeto **Fpp** (`bgqavxoxwgheloeubbpf`), região `sa-east-1`. O destino foi conferido contra as configurações de backend e frontend.

## Migration aplicada

- Arquivo: `supabase/migrations/202610020014_professional_readiness.sql`.
- Versão registrada: `202610020014`.
- Supabase CLI: `2.119.0`.
- SHA-256 do arquivo aplicado: `F27BCD1EDE3A114558204343381FBFAA7D6B21C9328FAB8A9ACB7A165CB67E2E`.

O dry run identificou apenas essa migration pendente. A aplicação usou `db push` com atualização de Vault desabilitada, sem seeds ou roles adicionais. As credenciais foram lidas do `.env` e não foram incluídas no Git nem neste registro.

## Verificação anterior

As referências existentes foram conferidas antes de criar as constraints: zero atribuições inconsistentes, zero execuções inconsistentes e zero alunos com múltiplas atribuições ativas.

## Verificação posterior

Dez verificações no catálogo do banco remoto passaram:

1. Migration presente no histórico oficial.
2. Gravações diretas profissionais revogadas para `anon` e `authenticated`.
3. RLS habilitada nas quatro tabelas profissionais.
4. Dez RPCs com privilégios, `security definer` e `search_path` esperados.
5. Oito constraints de propriedade/referência/histórico presentes e validadas.
6. Índice único parcial de atribuição ativa por aluno válido.
7. Policies antigas de escrita removidas.
8. Coluna de snapshot da prescrição presente.
9. Lock por usuário presente na função de gravação de snapshots.
10. Trigger de revogação de vínculo presente e habilitada.

O cache de schema do PostgREST foi recarregado. Uma chamada anônima ao RPC de criação de programa foi recusada pela API com código PostgreSQL `42501`, conforme esperado, sem criar registros de teste.

A conferência final mostrou 14 migrations registradas, nenhuma migration pendente e projeto em estado `ACTIVE_HEALTHY`. Esta validação remota complementa os testes SQL locais; a aceitação funcional com contas reais e dispositivos permanece descrita em [PROFESSIONAL_READINESS.md](PROFESSIONAL_READINESS.md).
