# Aplicativos móveis

O frontend também possui projetos Capacitor para Android e iOS. Nesse modo não há conta nem backend; o estado fica no dispositivo e os lembretes são notificações locais.

## Build

```powershell
Set-Location frontend
npm ci
npm run build:mobile
npx cap open android
```

Para iOS, execute `npx cap open ios` em um Mac com Xcode e selecione sua equipe de assinatura.

O identificador do aplicativo é `com.fitproplayer.app`. Após qualquer alteração web, rode `npm run build:mobile` novamente para sincronizar os projetos nativos.

## Assinatura Android

Crie seu próprio keystore e mantenha-o fora do repositório. Atualizações precisam usar sempre a mesma chave.

```powershell
keytool -genkeypair -keystore fit-pro-player.keystore -alias fit-pro-player -keyalg RSA -validity 10950
```

Arquivos `*.keystore`, `*.jks` e `frontend/android/key.properties` já estão ignorados pelo Git.

## Ícones

O mestre está em `frontend/resources/icon.png`; os ícones e splash screens gerados já estão versionados. Ao trocar o mestre, use uma versão atual e auditada do gerador Capacitor apenas durante a regeneração, revise visualmente os resultados e não mantenha a ferramenta no bundle de produção.
