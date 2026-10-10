import { expect, it } from 'vitest'
import professionalEnglish from './professional-english.js'
const packs = import.meta.glob('../locales/*.js', { eager: true, import: 'default' })
const keys = ['Foto profissional', 'Sua foto aparece para você, convidados e alunos.', 'JPG, PNG ou WebP, até 5 MB.', 'Adicionar foto', 'Trocar foto', 'Remover foto', 'Salvando foto…', 'Foto atualizada.', 'Foto removida.', 'Escolha uma imagem JPG, PNG ou WebP.', 'A imagem deve ter até 5 MB.', 'Não foi possível atualizar a foto. Tente novamente.']
it('provides professional photo copy for English and every shipped language', () => {
  expect(professionalEnglish['Foto profissional']).toBe('Professional photo')
  for (const [file, pack] of Object.entries(packs)) {
    for (const key of keys) {
      expect(pack[key], `${file}: ${key}`).toBeTruthy()
      if (!file.endsWith('/pt.js')) expect(pack[key], file).not.toBe(key)
    }
  }
})
