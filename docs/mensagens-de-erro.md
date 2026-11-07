# Mensagens de erro do projeto

As telas usam `appErrorMessage(error, fallback)` de `frontend/src/lib/app-errors.js`. O catálogo central distingue conexão, tempo esgotado, sessão expirada, permissão, conflito de edição, duplicidade, validação, item removido, excesso de tentativas, tamanho de arquivo, armazenamento local e indisponibilidade temporária.

Exemplos em português:

| Situação | Mensagem |
| --- | --- |
| Conexão | Verifique sua conexão e tente novamente. |
| Indisponibilidade | Este recurso está temporariamente indisponível. Tente novamente em instantes. |
| Falha desconhecida | Não foi possível concluir esta ação. Tente novamente. |

Cada tipo tem uma chave de tradução, presente nos onze idiomas. `project-error-locales.js` contém as traduções compartilhadas.

```js
try {
  await repository.save(data)
} catch (cause) {
  setError(appErrorMessage(cause, 'Não foi possível salvar. Tente novamente.'))
}
```

O fallback deve ser um texto escrito pelo projeto. Nunca passe `cause.message` como fallback. Respostas arbitrárias do servidor, nomes de fornecedores, SQL, URLs e tokens não devem ser renderizados como mensagem de falha. Validações locais específicas de imagem e telefone são preservadas por uma lista explícita de textos conhecidos. As mensagens de domínio já traduzidas continuam específicas.

Os repositórios preservam código e status HTTP com `serviceError(error, status)`. O erro original permanece em `cause` para diagnóstico. Isso permite distinguir, por exemplo, uma sessão expirada (401) de um serviço indisponível (503), e uma duplicidade (`23505` com 409) de um conflito de edição. A tela deve usar o formatador, e não renderizar o erro interno.

O registro técnico de erros no console administrativo mantém seus detalhes para investigação; ele não é uma mensagem apresentada como retorno de uma ação do usuário.
