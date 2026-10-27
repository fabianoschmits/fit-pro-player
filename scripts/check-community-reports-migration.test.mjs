import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const path = new URL('../supabase/migrations/20261026120000_community_reports.sql', import.meta.url)

test('community reporting migration defines a secured report context and RPC', () => {
  const sql = fs.readFileSync(path, 'utf8')
  for (const token of [
    'community_report', 'community_report_context', 'enable row level security',
    'community_report_content', 'ops_support_ticket_detail', 'security definer',
    'set search_path=public,auth,pg_temp', 'verification_link', 'content_excerpt',
    'Você não pode denunciar seu próprio conteúdo', 'Conteúdo indisponível',
  ]) assert.match(sql, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), token)
})
