// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ client: null, user: { id: 'alice' }, profile: { name: 'Alice', avatarId: 'avatar-80' }, crop: vi.fn() }))
vi.mock('framer-motion', () => ({ AnimatePresence: ({ children }) => children, motion: {
  div: ({ initial, animate, exit, ...props }) => <div {...props} />,
  form: ({ initial, animate, exit, ...props }) => <form {...props} />,
} }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => ({ user: mocks.user }) }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => mocks.client }))
vi.mock('../store/useStore.js', () => { const useStore = selector => selector({ S: { profile: mocks.profile } }); useStore.getState = () => ({ getActiveLocalScope: () => ({ userId: mocks.user.id }) }); return { useStore } })
vi.mock('../components/community/CommunityPostMedia.jsx', () => ({
  default: ({ children, post }) => children(<img className="test-photo" src={post.image_path} />),
  CommunityImage: ({ post }) => <img src={post.image_path} />, CommunityPostSkeleton: () => <div>Skeleton</div>, communityStoragePath: path => path,
}))
vi.mock('../components/community/CommunityComposerMedia.jsx', () => ({
  default: ({ onConfirm }) => <button type="button" onClick={onConfirm}>OK</button>,
  cropCommunityImage: (...args) => mocks.crop(...args), useFilePreview: file => file ? 'blob:test' : '',
}))
import Community from './Community.jsx'
const alice = { id: 'alice', display_name: 'Alice saved', avatar_ref: 'avatar-27' }
const bob = { id: 'bob', display_name: 'Bruno', avatar_ref: 'avatar-05' }
const makePost = (id, author) => ({ id, author_id: author.id, author, image_path: `${author.id}/${id}.jpg`, caption: id, created_at: '2026-10-23T12:00:00Z', comments: [], likes: [] })
let root, container, writes, rows, notificationRows, failure, missingProfile, missingOwnProfile, navigate
function client() {
  return { rpc: vi.fn(async () => ({ data: 'ticket-1', error: null })), storage: { from: () => ({ upload: vi.fn(async () => ({ error: null })), remove: vi.fn(async () => ({ error: null })) }) }, from(table) {
    const query = { table, filters: [], operation: 'select', select(fields) { if (fields?.includes('avatar_id')) throw Error('Invalid public column'); return this }, eq(key,value) { this.filters.push([key,value]); return this }, order() { return this }, limit() { return this }, or() { return this }, in() { return this }, is() { return this }, maybeSingle() { this.singleResult = true; return this }, single() { this.singleResult = true; return this }, match(value) { this.filters.push(...Object.entries(value)); return this }, insert(value) { this.operation = 'insert'; this.value = value; return this }, update(value) { this.operation = 'update'; this.value = value; return this }, delete() { this.operation = 'delete'; return this }, then(resolve,reject) {
      return Promise.resolve().then(() => {
        if (this.operation !== 'select') {
          writes.push({ table, operation: this.operation, value: this.value, filters: this.filters })
          if (failure) return { error: { message: failure } }
          if (table === 'community_comments' && this.operation === 'insert') return { data: { id: 'new-comment', ...this.value, author: alice, created_at: '2026-10-23T13:00:00Z', likes: [] } }
          if (table === 'community_posts' && this.operation === 'insert') { const post = { ...makePost('new-post', alice), ...this.value }; rows.unshift(post); return { data: post } }
          return { error: null }
        }
        if (table === 'profiles') return { data: (missingProfile && this.filters[0]?.[1] === 'missing') || (missingOwnProfile && this.filters[0]?.[1] === 'alice') ? null : this.filters[0]?.[1] === 'bob' ? bob : alice }
        if (table === 'community_notifications') return { data: notificationRows }
        let data = table === 'community_posts' ? rows.filter(row => this.filters.every(([key,value]) => row[key] === value)) : []
        return { data: this.singleResult ? data[0] || null : data }
      }).then(resolve,reject)
    } }; return query
  } }
}
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; mocks.user = { id: 'alice' }; mocks.profile = { name: 'Alice', avatarId: 'avatar-80' }; writes = []; rows = [makePost('mine',alice),makePost('theirs',bob)]; notificationRows = []; failure = ''; missingProfile = false; missingOwnProfile = false; mocks.client = client(); mocks.crop.mockReset(); window.scrollTo = vi.fn(); window.requestAnimationFrame = callback => { callback(); return 1 }; window.cancelAnimationFrame = vi.fn(); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks() })
async function mount(path='/community') { function Page() { navigate = useNavigate(); return <Community /> }; await act(async () => root.render(<MemoryRouter initialEntries={[path]}><Page /></MemoryRouter>)) }
const click = async button => act(async () => button.click())
const textButton = text => [...container.querySelectorAll('button')].find(button => button.textContent.trim() === text)
async function type(selector,value) { const element = container.querySelector(selector); await act(async () => { Object.getOwnPropertyDescriptor(element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,'value').set.call(element,value); element.dispatchEvent(new Event('input',{bubbles:true})) }) }

it('keeps current identity on own post, own likes and comments while visiting another profile', async () => {
  await mount('/community/user/bob')
  expect(container.querySelectorAll('article')).toHaveLength(1)
  expect(container.querySelector('article .community-author-link').textContent).toContain('Bruno')
  await click(container.querySelector('[aria-label="Curtir postagem"]'))
  expect(container.querySelector('.community-liker-summary').textContent).toContain('Alice curtiu')
  expect(container.querySelector('.community-liker-summary img').src).toContain('avatar-80')
  await click(container.querySelector('[aria-label="Abrir comentários"]')); await type('.community-comment-form input','Comentário meu')
  await click(container.querySelector('[aria-label="Enviar comentário"]'))
  expect(container.querySelector('.community-comment-row').textContent).toContain('Alice')
  expect(container.querySelector('.community-comment-row img').src).toContain('avatar-80')
  expect(writes.find(write => write.table==='community_comments').value.author_id).toBe('alice')
})
it('preserves feed contents and scroll when returning from a profile', async () => {
  await mount(); Object.defineProperty(window,'scrollY',{value:720,configurable:true})
  await click(container.querySelector('article[data-post-id="theirs"] .community-author-link'))
  expect(container.querySelectorAll('article')).toHaveLength(1)
  await click(textButton('Voltar'))
  expect(container.querySelectorAll('article')).toHaveLength(2)
  expect(window.scrollTo).toHaveBeenLastCalledWith(0,720)
})
it('rolls back an unsuccessful like rather than appending another page', async () => {
  await mount(); failure='Offline'
  await click(container.querySelector('[aria-label="Curtir postagem"]'))
  expect(container.querySelector('.community-liker-summary')).toBeNull()
  expect(container.querySelector('[role="alert"]').textContent).toContain('Offline')
})

it('shows a report action in another author’s menu and sends its post context', async () => {
  await mount()
  const post = container.querySelector('article[data-post-id="theirs"]')
  await click(post.querySelector('[aria-label="Mais opções"]'))
  await click([...post.querySelectorAll('button')].find(button => button.textContent === 'Denunciar'))
  expect(container.querySelector('[role="dialog"]').textContent).toContain('Denunciar conteúdo')
  await click(container.querySelector('input[value="spam"]'))
  await click([...container.querySelectorAll('button')].find(button => button.textContent === 'Enviar denúncia'))
  expect(mocks.client.rpc).toHaveBeenCalledWith('community_report_content', expect.objectContaining({ p_target_kind: 'post', p_post_id: 'theirs', p_comment_id: null, p_reason: 'spam' }))
})
it('closes comment sheets before navigating to the clicked author', async () => {
  rows[0].comments=[{id:'comment',post_id:'mine',author_id:'bob',author:bob,body:'Oi',created_at:'2026-10-23T12:00:00Z',likes:[]}]
  await mount(); await click(container.querySelector('[data-post-id="mine"] [aria-label="Abrir comentários"]'))
  await click(container.querySelector('.community-comments-sheet .community-comment-name-link'))
  expect(container.querySelector('[aria-label="Comentários"]')).toBeNull()
  expect(container.querySelectorAll('article')).toHaveLength(1)
})
it('publishes the confirmed crop only once, pins it for its author and uses the current avatar', async () => {
  await mount(); const original=new File(['original'],'foto.png',{type:'image/png'}), cropped=new File(['cropped'],'treino.jpg',{type:'image/jpeg'})
  mocks.crop.mockResolvedValue(cropped)
  const input=container.querySelector('input[type=file]'); Object.defineProperty(input,'files',{value:[original],configurable:true})
  await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})))
  expect(container.querySelector('textarea')).toBeNull(); await click(textButton('OK'))
  expect(container.querySelector('.community-cropped-preview')).not.toBeNull()
  await type('textarea','Foto nova'); await click(textButton('Publicar foto'))
  expect(mocks.crop).toHaveBeenCalledTimes(1)
  expect(container.querySelector('article').dataset.postId).toBe('new-post')
  expect(container.querySelector('article .community-avatar').src).toContain('avatar-80')
})

it('discards private composer state when the authenticated account changes', async () => {
  const render = () => <MemoryRouter><Community /></MemoryRouter>
  await act(async () => root.render(render()))
  const input = container.querySelector('input[type=file]')
  Object.defineProperty(input, 'files', { value: [new File(['private'], 'foto.png', { type: 'image/png' })], configurable: true })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
  expect(container.querySelector('[aria-label="Nova postagem"]')).not.toBeNull()
  mocks.user = { id: 'bob' }; mocks.profile = { name: 'Bruno', avatarId: 'avatar-05' }
  await act(async () => root.render(render()))
  expect(container.querySelector('[aria-label="Nova postagem"]')).toBeNull()
  expect(container.querySelector('.community-profile-tools img').src).toContain('avatar-05')
})

it('exposes truthful interaction states', async () => {
  await mount()
  const like = container.querySelector('[aria-label="Curtir postagem"]')
  expect(like.getAttribute('aria-pressed')).toBe('false')
  await click(like)
  expect(like.getAttribute('aria-pressed')).toBe('true')
  await click(container.querySelector('[aria-label="Mais opções"]'))
  expect(container.querySelector('[aria-label="Mais opções"]').getAttribute('aria-expanded')).toBe('true')
})

it('shows an unavailable state for a missing community profile', async () => {
  missingProfile = true
  await mount('/community/user/missing')
  expect(container.textContent).toContain('Este perfil não está disponível.')
  expect(container.textContent).not.toContain('Carregando perfil…')
})

it('keeps the own profile available when its public profile lookup is missing', async () => {
  missingOwnProfile = true
  await mount('/community/profile')
  expect(container.textContent).toContain('Seu perfil')
  expect(container.textContent).not.toContain('Este perfil não está disponível.')
})

it('presents a social feed header, composer invitation and own profile summary', async () => {
  await mount()
  expect(container.querySelector('h1')?.textContent).toBe('Comunidade')
  expect(container.querySelector('[data-community-composer]')?.textContent).toContain('Compartilhe seu treino')
  expect(container.querySelector('[data-community-feed-context]')?.textContent).toBe('Recentes')
  expect(container.querySelector('[data-community-profile-summary]')?.textContent).toContain('Suas postagens')
  expect(container.querySelector('[data-community-profile-summary]')?.textContent).toContain('Mensagens')
})
