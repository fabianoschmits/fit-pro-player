// @vitest-environment happy-dom
import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import CommunityComments from './CommunityComments.jsx'

const ownIdentity = { id: 'viewer', display_name: 'Ana Atleta', avatar_ref: 'avatar-7' }
const otherIdentity = { id: 'author', display_name: 'Bruno Treinador', avatar_ref: 'avatar-12' }
const comment = (id, body, author = otherIdentity, parent = null) => ({ id, post_id: 'post-1', author_id: author.id, author, body, parent_comment_id: parent, created_at: '2026-10-23T12:00:00Z', likes: [] })
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
const Avatar = ({ profile }) => <img src={`/avatars/${profile.avatar_ref}.png`} alt={profile.display_name} />
let root, container, currentPost, changePost
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true })
afterEach(async () => { await act(async () => root?.unmount()); container?.remove(); vi.restoreAllMocks() })

function mockClient(result = { error: null }) {
  const writes = []
  return {
    writes,
    from(table) {
      const entry = { table, filters: [] }; writes.push(entry)
      const query = { delete() { entry.operation = 'delete'; return query }, update(value) { entry.operation = 'update'; entry.value = value; return query }, insert(value) { entry.operation = 'insert'; entry.value = value; return query }, eq(key, value) { entry.filters.push([key, value]); return query }, match(value) { entry.filters.push(...Object.entries(value)); return query }, select() { return query }, then(yes, no) { return Promise.resolve(typeof result === 'function' ? result(entry) : result).then(yes, no) } }
      return query
    }
  }
}
async function mount({ comments = [], onSubmit = async (_post, body, parent) => ({ comment: comment('saved', body, ownIdentity, parent) }), client = mockClient(), onOpenUser, onReport, highlightCommentId = null } = {}) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  function Harness() {
    const [post, setPost] = useState({ id: 'post-1', comments })
    const [open, setOpen] = useState(true)
    currentPost = post; changePost = setPost
    return <><output>{post.comments.length}</output><button data-reopen onClick={() => setOpen(true)}>Reabrir</button>{open && <CommunityComments post={post} client={client} userId="viewer" ownIdentity={ownIdentity} AvatarComponent={Avatar} onClose={() => setOpen(false)} onSubmit={onSubmit} onCommentsChange={(id, updater) => setPost(previous => previous.id === id ? { ...previous, comments: updater(previous.comments) } : previous)} onOpenUser={onOpenUser} onReport={onReport} highlightCommentId={highlightCommentId} />}</>
  }
  await act(async () => root.render(<Harness />))
}
const byText = text => [...container.querySelectorAll('button')].find(button => button.textContent.trim() === text)
const row = id => container.querySelector(`[data-community-comment-id="${id}"]`)
const click = async target => { await act(async () => target.click()) }

it('shows ten comments per page and resets pagination when reopened', async () => {
  await mount({ comments: Array.from({length:23},(_,i)=>comment(`page-${i}`,`Comentário ${i}`)) })
  expect(container.querySelectorAll('[data-community-comment-id]')).toHaveLength(10)
  await click(byText('Carregar mais comentários'))
  expect(container.querySelectorAll('[data-community-comment-id]')).toHaveLength(20)
  await click(byText('Carregar mais comentários'))
  expect(container.querySelectorAll('[data-community-comment-id]')).toHaveLength(23)
  expect(byText('Carregar mais comentários')).toBeUndefined()
  await click(container.querySelector('[aria-label="Fechar comentários"]')); await click(container.querySelector('[data-reopen]'))
  expect(container.querySelectorAll('[data-community-comment-id]')).toHaveLength(10)
})

it('locks the background and restores its previous position and styles on close', async () => {
  vi.spyOn(window,'scrollY','get').mockReturnValue(420)
  const scroll=vi.spyOn(window,'scrollTo').mockImplementation(()=>{})
  document.body.style.overflow='auto'
  await mount()
  expect(document.body.style.position).toBe('fixed')
  expect(document.body.style.top).toBe('-420px')
  await click(container.querySelector('[aria-label="Fechar comentários"]'))
  expect(document.body.style.position).toBe('')
  expect(document.body.style.overflow).toBe('auto')
  expect(scroll).toHaveBeenLastCalledWith(0,420)
  document.body.style.overflow=''
})

it('paginates replies and keeps a newly submitted comment visible', async () => {
  await mount({ comments:[...Array.from({length:12},(_,i)=>comment(`root-${i}`,`Raiz ${i}`)),...Array.from({length:15},(_,i)=>comment(`reply-${i}`,`Resposta ${i}`,otherIdentity,'root-0'))] })
  await click(byText('Ver 15 respostas'))
  expect(container.querySelectorAll('.community-comment-thread--nested')).toHaveLength(10)
  await click(byText('Carregar mais respostas'))
  expect(container.querySelectorAll('.community-comment-thread--nested')).toHaveLength(15)
  await type('Meu novo comentário'); await act(async()=>submit())
  expect(row('saved')?.textContent).toContain('Meu novo comentário')
})

it('does not send an opposite like while the first request is pending across reopening', async () => {
  const request = deferred(), client = mockClient(() => request.promise)
  await mount({ comments: [comment('liked', 'Treino')], client })
  await click(row('liked').querySelector('.community-comment-actions button'))
  await click(container.querySelector('[aria-label="Fechar comentários"]'))
  await click(container.querySelector('[data-reopen]'))
  await click(row('liked').querySelector('.community-comment-actions button'))
  expect(client.writes).toHaveLength(1)
  await act(async () => request.resolve({ error: null }))
})
async function type(value) {
  await act(async () => {
    const field = container.querySelector('textarea, input');
    const proto = field.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  })
}
function submit() { container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }

it('keeps a new comment and its author/avatar in the feed after closing and reopening', async () => {
  const request = deferred(); await mount({ onSubmit: () => request.promise })
  await type('Treino concluído!'); act(submit)
  expect(currentPost.comments).toHaveLength(1)
  expect(container.textContent).toContain('Ana Atleta')
  expect(container.querySelector('.community-comment-row img').getAttribute('src')).toBe('/avatars/avatar-7.png')
  await act(async () => request.resolve({ comment: comment('saved', 'Treino concluído!', ownIdentity) }))
  await click(container.querySelector('[aria-label="Fechar comentários"]'))
  await click(container.querySelector('[data-reopen]'))
  expect(row('saved').textContent).toContain('Treino concluído!')
  expect(row('saved').textContent).toContain('Ana Atleta')
  expect(container.querySelector('output').textContent).toBe('1')
})

it('prevents duplicate sends, rolls back an unsuccessful comment and retains the draft', async () => {
  const request = deferred(); let sends = 0
  await mount({ onSubmit: () => { sends++; return request.promise } }); await type('Texto para tentar novamente')
  act(() => { submit(); submit() })
  expect(sends).toBe(1)
  await act(async () => request.resolve({ error: new Error('Sem conexão') }))
  expect(currentPost.comments).toHaveLength(0)
  expect(container.querySelector('textarea, input').value).toBe('Texto para tentar novamente')
  expect(container.querySelector('[role="alert"]').textContent).toContain('Sem conexão')
})

it('updates edits in shared state and preserves an unsuccessful edit for retry', async () => {
  let fail = true
  await mount({ comments: [comment('mine', 'Texto antigo', ownIdentity)], client: mockClient(() => fail ? { error: { message: 'Edição recusada' } } : { error: null }) })
  await click(row('mine').querySelector('[aria-label="Opções do comentário"]')); await click(byText('Editar')); await type('Texto atualizado')
  await act(async () => submit())
  expect(currentPost.comments[0].body).toBe('Texto antigo')
  expect(container.querySelector('textarea, input').value).toBe('Texto atualizado')
  fail = false; await act(async () => submit())
  expect(currentPost.comments[0].body).toBe('Texto atualizado')
  expect(container.querySelector('textarea, input').value).toBe('')
})

it('removes all descendant replies from the count when deleting their parent', async () => {
  await mount({ comments: [comment('root', 'Meu comentário', ownIdentity), comment('child', 'Resposta', otherIdentity, 'root'), comment('grandchild', 'Outra resposta', ownIdentity, 'child'), comment('unrelated', 'Permanece')] })
  await click(row('root').querySelector('[aria-label="Opções do comentário"]')); await click(byText('Excluir'))
  expect(currentPost.comments.map(item => item.id)).toEqual(['unrelated'])
  expect(container.querySelector('output').textContent).toBe('1')
})

it('updates comment likes immediately and only rolls back the failed like', async () => {
  const request = deferred(); await mount({ comments: [comment('one', 'Um'), comment('two', 'Dois')], client: mockClient(() => request.promise) })
  act(() => row('one').querySelector('.community-comment-actions button').click())
  expect(currentPost.comments[0].likes).toEqual([{ user_id: 'viewer' }])
  await act(async () => changePost(previous => ({ ...previous, comments: [...previous.comments.map(item => item.id === 'one' ? { ...item, likes: [...item.likes, { user_id: 'another-reader' }] } : item), comment('external', 'Chegou agora')] })))
  await act(async () => request.resolve({ error: { message: 'Curtida recusada' } }))
  expect(currentPost.comments.find(item => item.id === 'one').likes).toEqual([{ user_id: 'another-reader' }])
  expect(currentPost.comments.find(item => item.id === 'external')?.body).toBe('Chegou agora')
})

it('starts replies collapsed on each open and supports replying to a reply with immediate input focus', async () => {
  let sentParent
  await mount({ comments: [comment('root', 'Principal'), comment('child', 'Resposta existente', otherIdentity, 'root')], onSubmit: async (_post, text, parent) => { sentParent = parent; return { comment: comment('nested', text, ownIdentity, parent) } } })
  expect(row('child')).toBeNull()
  await click(byText('Ver 1 resposta'))
  const replyButton = [...row('child').querySelectorAll('button')].find(button => button.textContent === 'Responder')
  act(() => replyButton.click())
  expect(document.activeElement).toBe(container.querySelector('textarea, input'))
  await type('Minha resposta'); await act(async () => submit())
  expect(sentParent).toBe('child')
  expect(row('nested').textContent).toContain('Minha resposta')
  await click(container.querySelector('[aria-label="Fechar comentários"]')); await click(container.querySelector('[data-reopen]'))
  expect(row('child')).toBeNull(); expect(row('nested')).toBeNull()
})

it('opens every ancestor and highlights the exact reported reply from a report link', async () => {
  const scrollIntoView = vi.fn()
  const previous = Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, 'scrollIntoView')
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })
  try {
    await mount({ comments: [comment('root', 'Comentário principal'), comment('reply', 'Resposta intermediária', otherIdentity, 'root'), comment('reported', 'Comentário denunciado', otherIdentity, 'reply')], highlightCommentId: 'reported' })
    expect(row('root')).not.toBeNull()
    expect(row('reply')).not.toBeNull()
    expect(row('reported')).not.toBeNull()
    expect(row('reported').classList.contains('is-reply-target')).toBe(true)
    expect(scrollIntoView).toHaveBeenCalled()
  } finally {
    if (previous) Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', previous)
    else delete window.HTMLElement.prototype.scrollIntoView
  }
})

it('reflects incoming comments while open and opens the clicked author profile', async () => {
  const open = vi.fn(); await mount({ onOpenUser: open })
  await act(async () => changePost(previous => ({ ...previous, comments: [comment('external', 'Comentário novo')] })))
  expect(row('external').textContent).toContain('Comentário novo')
  await click(row('external').querySelector('.community-comment-name-link'))
  expect(open).toHaveBeenCalledWith('author')
})

it('offers reporting only on another person’s comment and includes the reply target', async () => {
  const report = vi.fn()
  await mount({ comments: [comment('mine', 'Meu comentário', ownIdentity), comment('reply', 'Resposta de Bruno')], onReport: report })
  expect(row('mine').querySelector('[aria-label="Opções do comentário"]')).not.toBeNull()
  await click(row('reply').querySelector('[aria-label="Opções do comentário"]'))
  await click(byText('Denunciar'))
  expect(report).toHaveBeenCalledWith(expect.objectContaining({ id: 'reply', post_id: 'post-1', author_id: 'author' }), expect.any(HTMLButtonElement))
})

it('keeps the composer context stable while a comment is being sent', async () => {
  const request = deferred()
  await mount({ comments: [comment('mine', 'Comentário anterior', ownIdentity), comment('other', 'Outra conversa')], onSubmit: () => request.promise })
  await type('Enviando meu comentário'); act(submit)
  await click([...row('other').querySelectorAll('button')].find(button => button.textContent === 'Responder'))
  await click(row('mine').querySelector('[aria-label="Opções do comentário"]'))
  if (byText('Editar')) await click(byText('Editar'))
  expect(container.querySelector('textarea, input').value).toBe('Enviando meu comentário')
  expect(container.querySelector('.community-replying')).toBeNull()
  await act(async () => request.resolve({ comment: comment('saved', 'Enviando meu comentário', ownIdentity) }))
  expect(currentPost.comments.find(item => item.id === 'mine').body).toBe('Comentário anterior')
  expect(container.querySelector('textarea, input').value).toBe('')
})

it('does not cancel the edit context while its save is pending', async () => {
  const request = deferred()
  await mount({ comments: [comment('mine', 'Comentário anterior', ownIdentity)], client: mockClient(() => request.promise) })
  await click(row('mine').querySelector('[aria-label="Opções do comentário"]')); await click(byText('Editar')); await type('Editando o comentário'); act(submit)
  await click(byText('Cancelar'))
  expect(container.querySelector('.community-replying')?.textContent).toContain('Editando')
  expect(container.querySelector('textarea, input').value).toBe('Editando o comentário')
  await act(async () => request.resolve({ error: { message: 'Não foi salvo' } }))
  expect(container.querySelector('textarea, input').value).toBe('Editando o comentário')
})

it('clears an edit target when deleting its ancestor removes the reply too', async () => {
  await mount({ comments: [comment('root', 'Principal', ownIdentity), comment('child', 'Minha resposta', ownIdentity, 'root')] })
  await click(byText('Ver 1 resposta'))
  await click(row('child').querySelector('[aria-label="Opções do comentário"]')); await click(byText('Editar'))
  await click(row('root').querySelector('[aria-label="Opções do comentário"]')); await click(byText('Excluir'))
  expect(currentPost.comments).toHaveLength(0)
  expect(container.querySelector('.community-replying')).toBeNull()
  expect(container.querySelector('[aria-label="Salvar comentário"]')).toBeNull()
})

it('invalidates a reply or edit target removed by another session before it can be submitted', async () => {
  const client = mockClient()
  await mount({ comments: [comment('mine', 'Comentário anterior', ownIdentity)], client })
  await click(row('mine').querySelector('[aria-label="Opções do comentário"]')); await click(byText('Editar')); await type('Texto que não pode ser salvo no excluído')
  await act(async () => changePost(previous => ({ ...previous, comments: [] })))
  expect(container.querySelector('[aria-label="Salvar comentário"]')).toBeNull()
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('excluído')
  expect(client.writes).toHaveLength(0)
})

it('moves focus into the sheet and restores it to the trigger when closed', async () => {
  const trigger = document.createElement('button'); trigger.textContent = 'Abrir comentários'; document.body.append(trigger); trigger.focus()
  await mount()
  expect(document.activeElement).toBe(container.querySelector('[aria-label="Fechar comentários"]'))
  await click(container.querySelector('[aria-label="Fechar comentários"]'))
  expect(document.activeElement).toBe(trigger)
  trigger.remove()
})
