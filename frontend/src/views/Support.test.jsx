// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { validateSupportForm } from './Support.jsx'

describe('support form validation', () => {
  it('requires category, subject and message without trimming away the draft', () => {
    expect(validateSupportForm({ category: '', subject: '  ', body: '  ' })).toEqual({ category: 'Selecione uma categoria.', subject: 'Informe um assunto.', body: 'Escreva sua mensagem.' })
  })

  it('accepts a complete support form', () => {
    expect(validateSupportForm({ category: 'question', subject: 'Dúvida', body: 'Como começo?' })).toEqual({})
  })
})
