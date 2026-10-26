import { describe, it, expect, vi } from 'vitest'
import { createMessageRepository, mergeMessages } from './direct-messages.js'

describe('private messages', () => {
  it('rejects empty and oversized messages without a database write', async () => {
    const rpc = vi.fn()
    const repo = createMessageRepository({ rpc })
    await expect(repo.send('peer', '   ', 'nonce')).rejects.toThrow()
    await expect(repo.send('peer', 'x'.repeat(3001), 'nonce')).rejects.toThrow()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('preserves the retry identifier and surfaces database failures', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: Error('offline') })
    await expect(createMessageRepository({ rpc }).send('peer', ' oi ', 'nonce')).rejects.toThrow('offline')
    expect(rpc).toHaveBeenCalledWith('community_send_message', { p_peer: 'peer', p_body: 'oi', p_nonce: 'nonce' })
  })
  it('merges pages and refreshes without losing history or duplicating messages', () => {
    expect(mergeMessages([{ id: '1', body: 'old' }, { id: '2' }], [{ id: '2', body: 'new' }, { id: '3' }])).toEqual([{ id: '1', body: 'old' }, { id: '2', body: 'new' }, { id: '3' }])
  })
  it('routes conversation and message actions through protected RPCs', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null })
    const repo = createMessageRepository({ rpc })
    await repo.markUnread('peer')
    await repo.hideConversation('peer')
    await repo.deleteMessage('42')
    expect(rpc.mock.calls).toEqual([
      ['community_mark_conversation_unread', { p_peer: 'peer' }],
      ['community_hide_conversation', { p_peer: 'peer' }],
      ['community_delete_message', { p_message_id: '42' }],
    ])
  })
})
