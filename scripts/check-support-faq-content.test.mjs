import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('FAQ content covers the product journeys and is idempotent', () => {
  const sql = fs.readFileSync(new URL('../supabase/migrations/202610150023_support_faq_content.sql', import.meta.url), 'utf8')
  for (const token of ['insert into public.support_faq_articles', 'on conflict', 'Como criar e organizar um plano de treino?', 'Como enviar uma dúvida, crítica ou sugestão?', 'Como meus dados são protegidos?', 'is_published']) {
    assert.match(sql, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), token)
  }
})
