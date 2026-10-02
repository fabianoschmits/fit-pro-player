# Operação da versão profissional

## Banco e publicação

Esta versão depende da migration `202610020014_professional_readiness.sql`. Ela centraliza mutações profissionais em RPCs, valida proprietário/vínculo/versão, permite apenas uma atribuição ativa por aluno e protege a revisão de snapshots contra gravações simultâneas. Antes de publicar o frontend, aplique migrations no ambiente de teste e execute os testes SQL. O workflow de qualidade verifica um Supabase local descartável; não modifica o banco remoto.

Execute `supabase start`, `supabase db reset` e `npm run check:database`. O runner usa `psql`; `DATABASE_TEST_URL` deve apontar para localhost/127.0.0.1. Os guards de código também executam com `npm run check:supabase`. Nenhuma chave privada deve entrar no bundle Vite.

## Sincronização e recuperação

O dispositivo mantém uma cópia isolada por conta. A gravação remota usa a revisão lida anteriormente, e gravações concorrentes produzem conflito em vez de sobrescrever dados. Configurações permite exportar as duas cópias e escolher qual usar; a cópia descartada é arquivada localmente. Alterações feitas durante uma gravação permanecem pendentes para a próxima sincronização.

Erros de armazenamento aparecem na interface com opção de tentar salvar novamente. Exporte um backup antes de limpar o dispositivo. **Limpar dados deste dispositivo** retorna à entrada sem excluir a conta; **excluir conta permanentemente** usa a RPC autenticada e remove a identidade e seus dados. Histórico de outros alunos pode permanecer com a prescrição desvinculada do profissional excluído.

Eventos de início/conclusão/abandono profissional ficam em uma fila local e usam IDs estáveis para reenvio idempotente. Falhas de conexão são tentadas na autenticação/reconexão; recusas definitivas ficam sinalizadas, sem apagar o treino salvo. Rascunhos profissionais ficam no dispositivo da conta, separados dos snapshots da nuvem.

## Offline e atualizações

No PWA, abra Configurações e escolha baixar o plano para uso offline enquanto há conexão. O aplicativo prepara rotas e mídias dos exercícios do plano e informa falhas; convites, autenticação e mudanças profissionais exigem conexão. O cache de plano substitui mídias de planos anteriores; o cache de navegação mantém até duas versões e limita imagens de uso ocasional.

Atualizações do aplicativo aguardam o fim do treino ativo antes de recarregar. O aplicativo nativo embute arquivos e usa também uma cópia no diretório privado. A compilação web móvel é validada no CI; geração de APK/IPA, assinatura e teste em dispositivos reais exigem Android SDK/Xcode e não são substituídos por essa validação.

## Diagnóstico

Configurações permite exportar/limpar um diagnóstico local com categorias de falhas e medidas numéricas. O registro limita-se a 50 entradas; não inclui mensagens de exceção, URLs, nomes, prescrições ou tokens e não é enviado a serviços externos.

## Testes e limites

`npm test` verifica lógica e componentes; `check:i18n` verifica cobertura/placeholder/português; `test:e2e` usa Chromium desktop/celular com respostas Supabase controladas; `test:e2e:pwa` usa o build real com service worker e recarregamento offline. Os testes SQL exercitam permissões e contratos com usuários autenticados. As respostas controladas do navegador não substituem um teste de aceitação no projeto Supabase de homologação.

Antes de liberar, teste em homologação convite → aceite → publicação → atribuição → treino → acompanhamento, revogação e exclusão de contas. Confirme também restauração de backup, conflito entre dois dispositivos, armazenamento cheio e execução em Android/iOS reais. Esses passos externos não são executados pelo push Git.

As fontes PNG permanecem no repositório para regeneração. O bundle importa WebP; `python scripts/optimize-app-media.py` (Pillow) recria esses derivados.
