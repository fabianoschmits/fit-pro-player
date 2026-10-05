# Central de notificações: PWA e Android

## Escopo aprovado

Central em Configurações para alertas locais, lembretes antecipados de treino, registros corporais opcionais e atualizações profissionais. Descanso e séries cronometradas são exclusivamente locais: nenhuma tabela, job, RPC ou chamada de notificações ao Supabase por timer. O usuário autorizou implementação, migrations, commit/push master e produção. Firebase ainda não existe; preparar a integração Android e deixar sua ativação pendente.

## Categorias

- Descanso e série cronometrada: ligados inicialmente, sujeitos à permissão do aparelho. Preservar Play → concluir série → descanso → próximo Play manual.
- Treino planejado: opcional, horário 18:00, antecedência inicial 120 minutos; opções 0/15/30/60/120/180/360. Respeitar dias sem treino, substituições por data, treino iniciado/concluído e fuso.
- Peso e medidas: opcionais semanais; suprimir quando o registro daquela semana já existe.
- Profissional: programa atualizado/removido, vínculo aceito/encerrado, treino de aluno concluído/interrompido e verificação alterada. Emitir somente eventos persistidos e autorizados no banco. Substituição de programa não gera falsa remoção.
- Período silencioso opcional para avisos remotos, inicialmente 22:00–07:00, desligado. Timers seguem os controles locais e de som.

Texto de tela bloqueada genérico, sem prescrição, peso, medidas, nomes de alunos ou códigos de convite. Controles traduzidos nos 11 idiomas existentes.

## Entrega local

PWA conserva o mecanismo existente: som/toast visível e Notification/service-worker notification quando o navegador permite executar a página oculta. PWA no iPhone ou Android pode suspender JavaScript; não há garantia de alerta local no instante do prazo enquanto minimizado. Sem envio remoto de descanso, essa limitação permanece explícita.

APK Android utiliza Capacitor Local Notifications e alarmes do sistema com prazo absoluto, IDs 2001/2002, canais audível/silencioso e proteção contra respostas atrasadas. Ajuste reagenda; pular, encerrar, desligar categoria ou sair cancela. Conclusão natural conserva o alarme do sistema, inclusive em primeiro plano, evitando a corrida de cancelamento contra o som. Permissão de notificação e acesso a alarmes exatos são inspecionados; iniciar descanso não abre as configurações do Android. Doze e ausência de acesso exato podem atrasar a entrega. Alertas semanais antigos 100..106 são retirados no boot.

Lembretes de calendário também têm agendamento local de uma única execução quando a página está visível e o dispositivo não usa avisos remotos. Visitantes podem configurar alertas locais.

## Entrega remota importante

Web Push autenticado para PWA; FCM HTTP v1 preparado para APK. Consentimento por dispositivo/conta. Presença visível de 65 segundos, renovada a cada 45 segundos somente quando há categorias remotas habilitadas; página oculta não faz polling. A página consome os jobs devidos e apresenta o feedback local existente. IDs, claims, validade e tentativas limitadas controlam duplicatas e retries.

Preferências locais de timer ficam fora do DTO remoto. Sem lembrete de calendário habilitado, alterações de séries não mudam o fingerprint remoto. Com lembretes habilitados, somente as informações mínimas do calendário e da conclusão alteram o DTO.

SQL verifica a fila a cada 5 segundos; somente trabalho elegível gera chamada Edge, com admissão mínima de 10 segundos. Fila ociosa gera zero chamadas HTTP. Claims exclusivos duram 120 segundos, lote máximo 25, concorrência de envio máxima 4. Expansão de calendário em SQL, manutenção horária com escrita somente na mudança do dia local. Retenção de jobs de 7 dias e logs Cron de 3 dias.

## Segurança e configuração

Tabelas privadas com RLS. Mutações autenticadas verificam dono; RPCs de claim/confirmação exclusivos do service role. Rebinding exige prova da instalação/chaves da inscrição; device_key estrangeiro é rejeitado. Logout desassocia dispositivo e limpa o contexto local; respostas atrasadas não reativam a conta anterior.

Web Push permite somente endpoints HTTPS de serviços conhecidos sem redirecionamento. VAPID e segredo exclusivo do dispatcher ficam no servidor/Vault. FCM usa conta de serviço e OAuth RS256 com hosts fixos; credenciais privadas nunca entram no frontend. Readiness nativo exige tanto configuração válida do worker quanto native_ready no banco. Sem Firebase, não registrar tokens nem invocar a Edge para jobs exclusivamente nativos.

Separar schema portátil da instalação administrativa Cron/pg_net/Vault. Integração Android futura: docs/notifications-android-setup.md.

## Validação

Cobrir calendário/fuso/DST, quiet hours, registros semanais, consumo local, isolamento de conta, corridas de cancelamento/registro, token/assinatura/criptografia, erros e retry de provedores, autorização SQL real e operação ociosa. Verificar interface 320/390 px em claro/escuro, i18n, builds web/mobile, E2E e PWA offline. Recepção física com celular bloqueado e APK instalado exige teste no aparelho; mocks não confirmam entrega do provedor.
