import { describe, expect, it } from 'vitest'
import { hydrateCommunityPost, resolveCommunityIdentity } from './community-identity.js'

describe('community identities', () => {
  const authUser = { id: 'actor', user_metadata: { display_name: 'Ana' } }
  const localProfile = { name: 'Ana Silva', avatarId: 'avatar-42' }

  it('keeps the current chosen avatar over stale public data immediately and after loading', () => {
    expect(resolveCommunityIdentity({ userId: 'actor', authUser, localProfile, publicProfile: { id: 'actor', display_name: 'Old', avatar_ref: 'avatar-27' } })).toEqual({ id: 'actor', display_name: 'Ana Silva', avatar_ref: 'avatar-42' })
  })

  it('never uses the visited profile as the acting identity', () => {
    expect(resolveCommunityIdentity({ userId: 'actor', authUser, localProfile, publicProfile: { id: 'other', display_name: 'Other', avatar_ref: 'avatar-02' } })).toEqual({ id: 'actor', display_name: 'Ana Silva', avatar_ref: 'avatar-42' })
  })

  it('never applies local account data to another user', () => {
    expect(resolveCommunityIdentity({ userId: 'other', authUser, localProfile, publicProfile: { id: 'other', display_name: 'Bia', avatar_ref: 'avatar-02' } })).toEqual({ id: 'other', display_name: 'Bia', avatar_ref: 'avatar-02' })
  })

  it('does not overwrite a saved avatar with an empty bootstrap profile', () => {
    expect(resolveCommunityIdentity({ userId: 'actor', authUser, localProfile: { name: '', avatarId: 'avatar-27' }, publicProfile: { id: 'actor', display_name: 'Ana', avatar_ref: 'avatar-42' } }).avatar_ref).toBe('avatar-42')
  })

  it('uses the same identity for own posts, comments, and likes while preserving other authors', () => {
    const identity = resolveCommunityIdentity({ userId: 'actor', authUser, localProfile })
    const other = { id: 'other', display_name: 'Bia', avatar_ref: 'avatar-02' }
    const post = hydrateCommunityPost({ author_id: 'actor', author: null, likes: [{ user_id: 'actor', user: other }, { user_id: 'other', user: other }], comments: [{ author_id: 'actor', author: null }, { author_id: 'other', author: other }] }, identity)
    expect(post.author).toEqual(identity)
    expect(post.likes[0].user).toEqual(identity)
    expect(post.comments[0].author).toEqual(identity)
    expect(post.likes[1].user).toEqual(other)
    expect(post.comments[1].author).toEqual(other)
  })

  it('rejects mismatched embedded identities instead of attributing an action to someone else', () => {
    const post = hydrateCommunityPost({ author_id: 'other', author: { id: 'third', display_name: 'Wrong' }, comments: [], likes: [] }, { id: 'actor', display_name: 'Ana', avatar_ref: 'avatar-42' })
    expect(post.author).toEqual({ id: 'other', display_name: 'Usuário', avatar_ref: null })
  })
})
