# Motion & Feedback do Fit Pro Player

O sistema estende o design system existente. Cores, superfícies, tipografia, tamanho dos controles e variantes continuam definidos pelos tokens do FPP. Não há dependência nova.

## Componentes oficiais

| Componente | Responsabilidade |
| --- | --- |
| `Button` / `FppPerformanceButton` | Ação primária, rápida ou crítica; bloqueio de repetição e feedback dentro do botão |
| `useFppAction` | Ciclo de execução, erro/nova tentativa e limpeza dos temporizadores de apresentação |
| `FppActionFeedback` | Mensagem local com texto, ícone e região de anúncio acessível |
| `FppProgress` | Progresso real, ou faixa indeterminada sem inventar porcentagens |
| `FppSpinner` | Indicador circular opcional, nunca padrão dos botões |
| `FppSkeleton` | Estrutura de listas e páginas durante leitura inicial |
| `FppToast` | Apresentação do toast existente, com tom opcional |
| `FppStatusAnimation` | Check, erro, aviso e offline; animação curta de confirmação |

Os componentes estão em `frontend/src/components`; o CSS compartilhado é `frontend/src/motion-feedback.css`. O showcase está em `#/motion-feedback`: permite alternar tema e as nove accent colors sem gravar preferências da conta. Ao sair, restaura as cores originais.

## Uso de ações

```jsx
<Button
  variant="primary"
  onAction={save}
  loadingLabel={t('Saving…')}
  successLabel={t('Saved')}
  errorLabel={t('Try again')}
>
  {t('Save')}
</Button>
```

`onAction(event)` pode ser síncrono ou retornar uma Promise. Resolução normal indica sucesso; `false` indica validação/cancelamento sem sucesso; uma exceção indica falha e permite tentar novamente. `onError(error)` pode acrescentar uma mensagem específica, e `onSuccess(result)` recebe o resultado. `onClick` mantém seu comportamento anterior e não infere sucesso de erros capturados pelo chamador. Não combine um `onAction` de gravação com o envio nativo do mesmo formulário.

Formulários nativos continuam usando `onSubmit`, com um ref para impedir submissões no mesmo instante e `state` controlado no botão. Validar antes de iniciar o estado pendente; liberar no `finally`. Ações críticas continuam usando as confirmações existentes; `intent="critical"` não cria nem substitui uma confirmação. `intent="quick"`, `Check` e `Switch` preservam a resposta local imediata. Concluir série nunca aguarda uma animação ou sincronização.

Estados aceitos: `idle`, `pressed`, `loading`, `processing`, `success`, `error`, `disabled`, `uploading`, `syncing`, `offline`, `warning`. O componente não transforma offline em erro nem inventa tentativas de rede. Estados adicionais ficam disponíveis para os fluxos que efetivamente precisarem deles.

## Regras de apresentação e segurança de execução

- Pressão de 100 ms; transições de 180–260 ms; confirmação de 480 ms. O resultado bem-sucedido permanece visível por cerca de 900 ms, com uma sustentação de 280 ms antes de callbacks de sucesso que permanecem na mesma tela.
- O bloqueio e `aria-busy` são imediatos. A faixa/texto de processamento aparece depois de 220 ms, se a operação continuar pendente. O atraso pertence à apresentação; a mutação local e o pedido de rede continuam começando no mesmo clique.
- Os rótulos reservam sua largura natural com conteúdo CSS invisível. Não duplicam o nome acessível nem texto oculto no DOM.
- Não liberar uma gravação ainda pendente por causa de um temporizador de animação. As camadas de serviço continuam responsáveis por cancelamento e timeout de suas requisições.
- Respeitar `prefers-reduced-motion` e interação por teclado. Texto e ícones continuam indicando o resultado com movimento desativado.
- Erros locais de persistência não significam falha da mutação em memória. Depois de uma inclusão/exclusão já aplicada, a nova tentativa grava a cópia local com `flushPersistence`; não repete a mutação.
- O salvamento local não é anunciado como sincronização concluída. Compartilhar por download é anunciado como imagem salva.
- `useUI.getState().toast(message)` continua válido. Para resultados explícitos: `toast(message, { tone: 'success' })`; também aceita `error`, `warning`, `offline` e `neutral`.

## Cobertura e migração gradual

Primeira onda aplicada: salvar configuração de exercício e treino, finalizar treino/resumo, concluir série, descanso, confirmações destrutivas, convites/criação/cópia/revogação, publicação/metadata de programas, perfil profissional, aceitação de convite, compartilhamento pós-treino e preparação offline. Autenticação, recuperação de sincronização, ação de notificações, toast e confirmação de medidas também usam a base. Leituras profissionais e de alunos usam skeleton. Botões, checkboxes e switches compartilhados propagam o feedback de toque às telas consumidoras.

Segunda onda aplicada: atribuições e encerramento de vínculo, dados pessoais e medidas, importação/exportação de planos, suporte e console administrativo. Essas operações preservam rascunhos, confirmação destrutiva, retry da gravação local, escopo da conta e cancelamento durante a saída da folha. Busca e filtros locais continuam imediatos. Não existem neste checkout feed social, curtidas, comentários, upload remoto de fotos ou favoritos; não foram criados para demonstrar estados.

No celular e com movimento reduzido, a navegação mantém uma única superfície de página. Isso evita que uma saída animada monte duas cópias do formulário de destino.

## Verificação

Unitários cobrem concorrência, ações rápidas sem flicker, erro/nova tentativa, cancelamento, desmontagem, formulários nativos, persistência sem repetição da mutação e compartilhamento. Playwright cobre o showcase em desktop/celular, os dois temas, nove accent colors, geometria, movimento reduzido e navegação; também verifica treino, publicação e layouts profissionais. As traduções seguem os 11 pacotes de idioma existentes.

Para executar os testes de navegador em outra porta: `FPP_E2E_PORT=8091` no ambiente antes do comando Playwright. A porta padrão continua 8080.
