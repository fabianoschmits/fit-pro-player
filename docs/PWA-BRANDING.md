# Ícones do site e do PWA

A fonte dos ícones web é o leão da apresentação: `frontend/public/brand-logo.png`.
O kit vetorial antigo de halter em `assets/brand/final` e seu gerador
`scripts/build-brand-kit.py` pertencem a outro fluxo e não geram os ícones do PWA.

Para reconstruir os arquivos do zero, instale Pillow e execute:

```powershell
python scripts/build-pwa-icons.py
python scripts/build-pwa-icons.py --check
```

O gerador exporta favicon ICO com seis resoluções, PNGs para navegador, Apple e
PWA, versões maskable com margem segura e uma prévia de compartilhamento de
1200×630. Todos usam o mesmo leão, preservado inteiro, sobre fundo preto opaco.
Também atualiza os nomes históricos para instalações que ainda os consultam.

O nome `icons/lion-<hash>` depende da imagem original e das configurações de
exportação. Ao trocar a fonte ou o enquadramento, use o novo prefixo retornado
em `frontend/index.html`, `frontend/public/manifest.json` e no ícone de notificação
em `frontend/public/sw.js`. Preserve `id`, `scope` e `start_url` do manifesto:
alterar a identidade pode criar uma segunda instalação em vez de atualizar a atual.

Os arquivos com hash têm cache imutável na Vercel. Os endereços históricos e o
manifesto exigem revalidação. O service worker busca a identidade visual pela
rede antes do cache e mantém o fallback offline sem apagar treinos ou planos.

Depois de testar, publique com `vercel --prod --yes` na raiz do repositório e
confira os bytes e cabeçalhos dos arquivos no domínio de produção.

A miniatura do painel da Vercel é um **avatar do projeto** salvo separadamente.
A Vercel detecta o favicon uma vez; novos deploys não substituem necessariamente
esse avatar. Envie o PNG de 512 px em Settings > General > Project Avatar, ou
pela API oficial de upload de avatar. O arquivo precisa ter até 1 MB.

Referências: [avatar do projeto](https://vercel.com/docs/project-configuration/general-settings#project-avatar)
e [API de upload](https://vercel.com/docs/rest-api/projects/upload-a-project-avatar).

Ícones de atalhos que já estão na tela inicial são administrados pelo navegador
e pelo sistema operacional. Desde o Chrome 144, mudanças de ícone podem aparecer
no menu do app em **Review app update / Revisar atualização do app** e depender
da confirmação do usuário. Alterar a URL do ícone no manifesto permite essa
detecção; substituir apenas os bytes da mesma URL não basta. Consulte a
[documentação do Chrome](https://developer.chrome.com/blog/improvements-to-web-app-updates).
No iOS, um atalho existente pode exigir nova adição à tela inicial para receber
outra imagem; uma publicação não controla esse cache. Consulte o
[guia de atualização de PWAs](https://web.dev/learn/pwa/update).
