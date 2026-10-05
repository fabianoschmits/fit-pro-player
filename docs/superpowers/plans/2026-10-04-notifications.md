# Plano de implementaÃ§Ã£o de notificaÃ§Ãµes

**Objetivo:** central configurÃ¡vel, timers exclusivamente locais e avisos importantes via Web Push/FCM opcional.

**Spec:** docs/superpowers/specs/2026-10-04-notifications-design.md

**Tecnologias:** React/Zustand, Capacitor, Supabase Postgres/RPC/Cron/pg_net/Vault, Edge Web Push e FCM HTTP v1.

## RestriÃ§Ãµes

- Nenhuma operaÃ§Ã£o de notificaÃ§Ãµes no Supabase por descanso/sÃ©rie cronometrada.
- Preservar execuÃ§Ã£o e inÃ­cio manual da prÃ³xima sÃ©rie.
- Consentimento e isolamento por conta/dispositivo, conteÃºdo genÃ©rico e entrega de fundo sujeita ao sistema.
- Fila ociosa sem invocaÃ§Ã£o Edge; credenciais privadas somente no servidor.
- Firebase nÃ£o fornecido: implementaÃ§Ã£o pronta, transporte nativo remoto desativado atÃ© configuraÃ§Ã£o futura.

## ImplementaÃ§Ã£o

- [x] MigraÃ§Ã£o portÃ¡til com dispositivos, jobs importantes, eventos, configuraÃ§Ã£o e RPCs privados/autenticados.
- [x] CalendÃ¡rio, eventos profissionais reais, quiet hours, revisions/claims, retry e testes PostgreSQL reais.
- [x] InstalaÃ§Ã£o operacional Cron/Vault com retenÃ§Ã£o, admissÃ£o e ativaÃ§Ã£o transacional.
- [x] Dispatcher Web Push e FCM opcional, assinaturas, payloads seguros e testes de provedores.
- [x] Central de notificaÃ§Ãµes, normalizaÃ§Ã£o de preferÃªncias/calendÃ¡rio e traduÃ§Ãµes.
- [x] Coordenador de inscriÃ§Ã£o/presenÃ§a econÃ´mica, logout/troca de conta e consumo local.
- [x] Service worker com contexto durÃ¡vel, dedupe e navegaÃ§Ã£o segura.
- [x] Android Push bridge, alarmes locais de timers e retirada de lembretes mÃ³veis legados.
- [x] Interface verificada em 320/390 px, claro/escuro.

## Release

- [ ] VerificaÃ§Ã£o final completa de testes, banco, i18n, builds, E2E/PWA e revisÃ£o independente.
- [ ] Aplicar migration, instalar secrets/worker/Cron e verificar autorizaÃ§Ã£o e zero HTTP ocioso.
- Publicação: commit/push master, publicar Vercel e verificar SHA exato e CI.

## IntegraÃ§Ã£o futura explicitamente adiada

- [ ] Receber Firebase Android (com.fitproplayer.app) e conta de serviÃ§o de envio.
- [ ] Configurar app/servidor, validar assinatura/configuraÃ§Ã£o e sÃ³ entÃ£o habilitar native_ready.
- [ ] Instalar APK e validar alarmes locais/FCM com app aberto, minimizado e celular bloqueado.
- [ ] Validar Web Push em iPhone PWA instalado e Android PWA com permissÃµes concedidas.
