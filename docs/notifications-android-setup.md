# AtivaÃ§Ã£o futura do Android

O APK contÃ©m o plugin Capacitor Push Notifications, a ponte de registro/contexto por conta e o dispatcher FCM HTTP v1. O serviÃ§o remoto nativo permanece desativado enquanto nÃ£o existe configuraÃ§Ã£o Firebase. Alertas de descanso/sÃ©rie usam Local Notifications no aparelho e nÃ£o precisam do Firebase nem do Supabase.

## Dados necessÃ¡rios quando o projeto existir

1. Criar o app Android no Firebase com package **com.fitproplayer.app**, baixar google-services.json e colocar em frontend/android/app/.
2. Habilitar Firebase Cloud Messaging HTTP v1. Criar conta de serviÃ§o autorizada a enviar mensagens no projeto. Guardar seu JSON somente como secret Supabase **FIREBASE_SERVICE_ACCOUNT**; nunca em arquivos do frontend, Git ou Vercel pÃºblica.
3. O JSON aceito contÃ©m project_id, client_email e private_key RSA de pelo menos 2048 bits. Hosts OAuth/FCM sÃ£o fixos no dispatcher, sem aceitar URLs da credencial como destino de rede.
4. Confirmar VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no build mobile. Sem elas o APK sÃ³ permite uso local. Executar `npm --prefix frontend run build:mobile`, que compila e sincroniza os plugins Capacitor.
5. Reimplantar push-dispatch, verificar a importaÃ§Ã£o da credencial e testar envio real para uma instalaÃ§Ã£o Android. Somente com configuraÃ§Ã£o comprovada habilitar, por conexÃ£o administrativa: `update public.notification_settings set native_ready=true where singleton;`.
6. Preparar assinatura Android, versionCode, App Links/certificados e AAB para a loja conforme o processo de release. Isso Ã© separado da configuraÃ§Ã£o de notificaÃ§Ãµes.

NÃ£o ativar native_ready sÃ³ por ter criado um projeto: APK e worker precisam apontar para o mesmo Firebase. Para pausar avisos remotos nativos, desativar esse flag; Web Push permanece disponÃ­vel.

## Testes no aparelho

- Conceder permissÃ£o Android de notificaÃ§Ãµes. Inspecionar acesso a alarmes exatos nas configuraÃ§Ãµes do aparelho; o app nÃ£o abre essa tela automaticamente ao iniciar descanso.
- Testar descanso e sÃ©rie cronometrada: iniciar, Â±15s, pular, conclusÃ£o natural, som desligado, segundo plano e tela bloqueada. Alarmes inexatos/Doze podem sofrer atraso.
- Ativar avisos importantes na central e testar lembrete de treino/evento profissional real com app aberto, minimizado e encerrado. APK usa FCM; Web Push Ã© para o PWA.
- Conferir toque no alerta, expiraÃ§Ã£o, dedupe, logout e troca de conta; avisos da conta anterior devem ser rejeitados.
- Firebase ausente/invÃ¡lido deve deixar o transporte remoto nativo indisponÃ­vel, sem prompt de registro nem chamadas de envio.

ReferÃªncias: [Capacitor Push Notifications v7](https://capacitorjs.com/docs/v7/apis/push-notifications), [Local Notifications v7](https://capacitorjs.com/docs/v7/apis/local-notifications), [FCM HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api).

## Validação da preparação

Testes automatizados cobrem a ponte FCM, isolamento de conta, envio assinado e alarmes locais simulados. O bundle mobile e a sincronização Capacitor passaram. A tentativa de gerar APK debug neste Windows parou numa falha de comunicação local do Gradle/JDK antes da compilação; geração de APK e entrega física permanecem pendentes para o lançamento. Essa falha de ambiente não é validada pelo build web.

Preservar o par VAPID e o segredo existentes ao ativar Firebase; essa etapa acrescenta a credencial FCM e não deve substituir as chaves das inscrições Web Push em uso.
