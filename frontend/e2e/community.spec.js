import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { seed, stateFixture, USER, STUDENT } from './fixtures.test.js'
const photo = fs.readFileSync(new URL('../src/assets/avatars/avatar-80.webp', import.meta.url))
const profiles = { [USER]: { id: USER, display_name: 'Pessoa Teste', avatar_ref: 'avatar-80' }, [STUDENT]: { id: STUDENT, display_name: 'Bruno QA', avatar_ref: 'avatar-05' } }
const makePost = (id, author) => ({ id, author_id: author, author: profiles[author], image_path: `${author}/${id}.jpg`, caption: 'Treino concluído', created_at: '2026-10-23T12:00:00Z', comments_disabled: false, likes: [], comments: [] })
async function setup(page, delayImage = false) {
  const state = stateFixture(); state.profile.avatarId='avatar-80'; state.theme=delayImage ? 'dark' : 'light'
  await seed(page, { authenticated: true, state, rpc: { is_current_user_suspended: false, account_preferences: { user_id:USER, revision:1, display_unit:'kg', preferences:state } } })
  const posts = [makePost('11111111-1111-4111-8111-000000000001', STUDENT),makePost('11111111-1111-4111-8111-000000000002',USER)]
  let releaseImage
  const imageGate = new Promise(resolve => { releaseImage=resolve })
  if (!delayImage) releaseImage()
  await page.route('https://fitpp-test.supabase.co/storage/**', async route => {
    if (route.request().method()==='POST') return route.fulfill({contentType:'application/json',body:'{"Key":"uploaded"}'})
    await imageGate; await route.fulfill({ contentType:'image/webp', body:photo })
  })
  await page.route('https://fitpp-test.supabase.co/rest/v1/**', async route => {
    const url=new URL(route.request().url()), table=url.pathname.split('/').at(-1), method=route.request().method(), value=route.request().postDataJSON()
    if (!['profiles','community_posts','community_comments','community_likes','community_notifications','community_comment_likes'].includes(table)) return route.fallback()
    let result=[]
    if(table==='profiles') result=profiles[url.searchParams.get('id')?.replace('eq.','')] || profiles[USER]
    if(table==='community_posts') {
      if(method==='POST') { const post={...makePost(crypto.randomUUID(),USER),...value}; posts.unshift(post); result=post }
      else { result=posts.filter(post => ['author_id','id'].every(key=>!url.searchParams.has(key)||post[key]===url.searchParams.get(key).replace('eq.',''))); if(route.request().headers().accept?.includes('vnd.pgrst.object')) result=result[0] || null }
    }
    if(table==='community_comments' && method==='POST') {
      result={...value,id:crypto.randomUUID(),author:profiles[value.author_id],created_at:'2026-10-23T13:00:00Z',likes:[]}
      posts.find(post=>post.id===value.post_id).comments.push(result)
    }
    if(table==='community_comments' && method==='DELETE') { const id=url.searchParams.get('id').replace('eq.',''); for(const post of posts) post.comments=post.comments.filter(comment=>comment.id!==id) }
    await route.fulfill({contentType:'application/json',body:JSON.stringify(result)})
  })
  return {posts,releaseImage}
}

test('gates posts until their photo is ready and preserves identity, comments and profile navigation', async ({page}) => {
  const {releaseImage}=await setup(page,true)
  await page.goto('/#/community')
  await expect(page.locator('.community-post-gate').first()).toHaveAttribute('aria-busy','true')
  await expect(page.locator('[data-media-content]').first()).toHaveAttribute('inert','')
  releaseImage()
  const theirs=page.locator(`[data-post-id="11111111-1111-4111-8111-000000000001"]`)
  await expect(theirs).toBeVisible()
  await expect(page.locator('#corner-nav-main [aria-current="page"]')).toHaveCount(1)
  await expect(page.locator('#corner-nav-main [aria-current="page"]')).toHaveAttribute('aria-label','Comunidade')
  await theirs.getByLabel('Curtir postagem').click()
  await expect(theirs.locator('.community-liker-summary')).toContainText('Pessoa Teste curtiu')
  await expect(theirs.locator('.community-liker-summary img')).toHaveAttribute('src',/avatar-80/)
  await theirs.getByLabel('Abrir comentários').click()
  const dialog=page.getByRole('dialog',{name:'Comentários'})
  await dialog.locator('input').fill('Comentário QA')
  await dialog.getByLabel('Enviar comentário').click()
  await expect(dialog.locator('.community-comment-row')).toContainText('Pessoa Teste')
  await expect(dialog.locator('.community-comment-row img')).toHaveAttribute('src',/avatar-80/)
  await dialog.getByLabel('Fechar comentários').click()
  await expect(dialog).not.toBeVisible()
  await theirs.getByLabel('Abrir comentários').click()
  await expect(dialog).toContainText('Comentário QA')
  await dialog.getByLabel('Fechar comentários').click()
  await expect(dialog).not.toBeVisible()
  await theirs.locator('.community-author-link').click()
  await expect(page).toHaveURL(new RegExp(`/community/user/${STUDENT}`))
  await expect(page.locator('.community-post-gate')).toHaveCount(1)
  await expect(page.locator('.community-profile-heading')).toContainText('Bruno QA')
  await expect(page.locator('.community-profile-tools img')).toHaveAttribute('src',/avatar-80/)
  const actionBox = await page.locator('.community-primary-action').boundingBox()
  const profileToolsBox = await page.locator('.community-profile-tools').boundingBox()
  expect(Math.abs(profileToolsBox.y - actionBox.y)).toBeLessThanOrEqual(4)
  await page.getByRole('button',{name:'Voltar',exact:true}).click()
  await expect(page.locator('.community-post-gate')).toHaveCount(2)
  await page.screenshot({path:test.info().outputPath('community-feed.png')})
})

test('crop modes keep the preview proportions, separate caption step, and publish first', async ({page}) => {
  await setup(page)
  await page.goto('/#/community')
  await expect(page.locator('.community-post-gate').first()).toBeVisible()
  await page.locator('.community-file-input').setInputFiles({name:'treino.webp',mimeType:'image/webp',buffer:photo})
  const dialog=page.getByRole('dialog',{name:'Nova postagem'})
  await expect(dialog.locator('textarea')).toHaveCount(0)
  await dialog.getByLabel('Formato vertical').click()
  const size=await dialog.locator('.community-crop-viewport').boundingBox()
  expect(size.width/size.height).toBeCloseTo(.75,1)
  await dialog.getByLabel('Expandir editor').click()
  await expect.poll(async ()=>(await dialog.locator('.community-crop-viewport').boundingBox()).height).toBeGreaterThan(size.height)
  await page.screenshot({path:test.info().outputPath('community-crop.png')})
  await dialog.getByRole('button',{name:'OK',exact:true}).click()
  await expect(dialog.locator('.community-cropped-preview')).toBeVisible()
  const natural=await dialog.locator('.community-cropped-preview').evaluate(image=>[image.naturalWidth,image.naturalHeight])
  expect(natural[0]/natural[1]).toBeCloseTo(.75,1)
  await dialog.locator('textarea').fill('Publicação QA recortada')
  await dialog.getByRole('button',{name:'Publicar foto'}).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.locator('.community-post-gate').first()).toContainText('Publicação QA recortada')
})
