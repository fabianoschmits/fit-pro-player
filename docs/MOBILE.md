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

O símbolo vetorial minimalista está em `assets/brand/gym-concepts/a-v2.svg`. Execute `python scripts/build-brand-kit.py` (CairoSVG e Pillow) para regenerar o mestre `frontend/resources/icon.png`, os ícones Android/iOS e as telas de abertura em seus tamanhos originais. Os ícones web minimalistas são exportados somente para `assets/brand/final/web`: o PWA e a landing preservam as imagens anteriores em `frontend/public/brand-logo.png`, `icon-180.png` e `icon-512.png`. O gerador não sobrescreve essas imagens. Revise os resultados antes de compilar os aplicativos nativos.
