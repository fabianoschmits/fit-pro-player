import { describe, expect, it } from 'vitest'
import { communityNotificationDetail, communityNotificationTarget } from './community-notifications.js'

describe('community notifications', () => {
  it('keeps messages from the same sender in one accumulated notification', () => {
    expect(communityNotificationDetail({ type: 'message', message_count: 1 })).toBe('enviou uma mensagem.')
    expect(communityNotificationDetail({ type: 'message', message_count: 3 })).toBe('enviou 3 mensagens.')
    expect(communityNotificationTarget({ type: 'message', actor_id: 'peer-1' })).toBe('/community/messages/peer-1')
  })
  it('keeps post notifications routed to their original post', () => {
    expect(communityNotificationDetail({ type: 'like' })).toBe('curtiu sua postagem.')
    expect(communityNotificationDetail({ type: 'comment' })).toBe('comentou na sua postagem.')
    expect(communityNotificationTarget({ type: 'comment', post_id: 'post-1' })).toBe('/community?post=post-1')
  })
})
