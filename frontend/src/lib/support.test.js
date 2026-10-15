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
