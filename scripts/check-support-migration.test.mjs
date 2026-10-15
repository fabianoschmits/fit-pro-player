import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const path = new URL('../supabase/migrations/202610150022_support_center.sql', import.meta.url)

test('support migration defines secured support model and operations', () => {
  const sql = fs.readFileSync(path, 'utf8')
  for (const token of [
    'support_ticket_status', 'support_ticket_priority', 'support_author_kind',
    'support_categories', 'support_faq_articles', 'support_tickets',
    'support_messages', 'support_ticket_events', 'enable row level security',
    'support_create_ticket', 'support_add_user_message', 'support_list_my_tickets',
    'ops_support_overview', 'ops_support_list_tickets', 'ops_support_reply',
    'ops_support_update_ticket', 'ops_support_mark_read', 'ops_require_admin',
    'question', 'technical', 'feature_request', 'privacy', 'archived',
  ]) assert.match(sql, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), token)
})
