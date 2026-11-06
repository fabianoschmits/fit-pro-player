# Comparador fotográfico — plano de implementação

Objetivo: implementar o escopo fornecido pelo usuário diretamente neste checkout, preservando medidas e sincronização existentes.

Arquitetura: seção Fotos carregada sob demanda dentro de Comparar; repositório próprio com escopo autenticado; imagens privadas no Storage; processamento e pose locais; somente transformações uniformes persistidas. Nenhuma imagem ou landmark entra no estado global.

- [x] Testar processamento, geometria, isolamento de conta e interação acessível.
- [x] Implementar processamento com validação de assinatura, orientação pelo decoder e canvas sem EXIF; MediaPipe em worker com assets locais sob demanda.
- [x] Criar tabela, bucket, RLS, transformações limitadas e bloqueio de exclusão de conta com objetos pendentes.
- [x] Implementar repositório e Edge Function de remoção idempotente, incluindo limpeza da conta por API Storage.
- [x] Implementar upload, histórico, seleção por ângulo, divisor e ajustes independentes; integrar sem mudar medidas.
- [x] Executar testes direcionados, lint, build e revisar segurança. Entregar instruções de implantação sem executar migrations remotas.

Riscos a verificar: troca de conta durante upload; falha entre Storage e banco; seleção de ângulos distintos; detecção parcial e enquadramento; pointer capture e scroll; indisponibilidade da rede; modelo sem suporte no dispositivo.

Decisões: execução direta autorizada pelo escopo; sem alterações nos domínios de sincronização. Reserva de upload no banco e trava da reserva na inserção de Storage evitam corridas com limpeza. Limpeza de interrompidos preserva envios com menos de uma hora; exclusão individual é imediata. Exclusão da conta remove também objetos recentes sem referência, sem apagar reservas concorrentes; guarda SQL exige ausência de arquivos antes da exclusão de auth.users. Tokens de exclusão são vinculados à identidade inicial.

Verificações: 193 arquivos / 1.671 testes da suíte completa passaram; após os ajustes finais, 50 testes direcionados passaram. Quatro testes Node cobrem limpeza, falha parcial e concorrência. Dois E2E Chromium (desktop/mobile) cobrem upload, medidas vazias, ajuste independente, recarga, divisor e exclusão. SQL de segurança executado contra todas as migrations em PostgreSQL/WASM local. Detector real encontrou 33 pontos em Chromium, inclusive build de produção com CSP. Lint, typecheck e build passaram. A suíte SQL integral via PostgreSQL nativo não pôde iniciar: instalação local sem postgres.bki. Nenhuma migration ou função foi publicada no Supabase remoto.
