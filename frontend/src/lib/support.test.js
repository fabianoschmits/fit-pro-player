import { describe, expect, it, vi } from 'vitest'
import { createSupportRepository } from './support.js'

function clientWith(data) {
  return { rpc: vi.fn().mockResolvedValue({ data, error: null }) }
}

describe('support repository', () => {
  it('maps user ticket creation to the protected RPC', async () => {
    const client = clientWith('ticket-1')
    const repo = createSupportRepository({ client })
    await expect(repo.createTicket({ categorySlug: 'question', subject: 'Ajuda', body: 'Como faço?' })).resolves.toBe('ticket-1')
    expect(client.rpc).toHaveBeenCalledWith('support_create_ticket', { p_category_slug: 'question', p_subject: 'Ajuda', p_body: 'Como faço?' })
  })

  it('sends structured community reports to the dedicated RPC', async () => {
    const client = clientWith('report-ticket-1')
    const repo = createSupportRepository({ client })
    await expect(repo.reportCommunityContent({ targetKind: 'comment', postId: 'post-1', commentId: 'comment-1', reason: 'other', description: 'Contexto adicional' })).resolves.toBe('report-ticket-1')
    expect(client.rpc).toHaveBeenCalledWith('community_report_content', { p_target_kind: 'comment', p_post_id: 'post-1', p_comment_id: 'comment-1', p_reason: 'other', p_description: 'Contexto adicional' })
  })

  it('maps report context from an administrative ticket detail', async () => {
    const client = clientWith({ ticket: { id: 'report-ticket-1' }, category: { slug: 'community_report', label: 'Denúncia de comunidade' }, messages: [], events: [], report_context: { target_kind: 'comment', post_id: 'post-1', comment_id: 'comment-1', reported_user_id: 'author-1', reason: 'spam', description: null, content_excerpt: 'Texto denunciado', verification_link: '/community?post=post-1' } })
    await expect(createSupportRepository({ client }).adminTicketDetail('report-ticket-1')).resolves.toEqual(expect.objectContaining({ reportContext: { targetKind: 'comment', postId: 'post-1', commentId: 'comment-1', reportedUserId: 'author-1', reason: 'spam', description: null, contentExcerpt: 'Texto denunciado', verificationLink: '/community?post=post-1' } }))
  })

  it('normalizes ticket rows to the frontend contract', async () => {
    const client = clientWith([{ ticket_id: 't1', category_slug: 'technical', category_label: 'Problema técnico', status: 'pending', priority: 'high', last_message_at: 'now' }])
    const repo = createSupportRepository({ client })
    await expect(repo.listMyTickets()).resolves.toEqual([expect.objectContaining({ ticketId: 't1', categorySlug: 'technical', categoryLabel: 'Problema técnico', status: 'pending', priority: 'high', lastMessageAt: 'now' })])
  })

  it('surfaces Supabase errors', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: new Error('offline') }) }
    await expect(createSupportRepository({ client }).listCategories()).rejects.toThrow('offline')
  })
})
