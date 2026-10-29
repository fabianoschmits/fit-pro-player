import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { seed, stateFixture, USER, STUDENT } from './fixtures.test.js'
const photo = fs.readFileSync(new URL('../src/assets/avatars/avatar-80.webp', import.meta.url))
const profiles = { [USER]: { id: USER, display_name: 'Pessoa Teste', avatar_ref: 'avatar-80' }, [STUDENT]: { id: STUDENT, display_name: 'Bruno QA', avatar_ref: 'avatar-05' } }
const makePost = (id, author) => ({ id, author_id: author, author: profiles[author], image_path: `${author}/${id}.jpg`, caption: 'Treino concluído', created_at: '2026-10-23T12:00:00Z', comments_disabled: false, likes: [], comments: [] })
async function setup(page, delayImage = false) {
  const state = stateFixture(); state.profile.avatarId='avatar-80'; state.theme=delayImage ? 'dark' : 'light'
  const reports=[]
  await seed(page, { authenticated: true, state, rpc: { is_current_user_suspended: false, account_preferences: { user_id:USER, revision:1, display_unit:'kg', preferences:state }, community_report_content: args => { reports.push(args); return '99999999-9999-4999-8999-999999999999' } } })
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
  return {posts,releaseImage,reports}
}

test('community and user profiles use one status-bar inset and keep profile actions inside the right edge', async ({page}, testInfo) => {
  await setup(page)
  await page.setViewportSize({width:390,height:844})
  for (const route of ['/community', `/community/user/${STUDENT}`, '/community/profile']) {
    await page.goto(`/#${route}`)
    await expect(page.locator('.community-topbar')).toBeVisible()
    await page.evaluate(()=>{document.documentElement.dataset.pwaViewport='ios'; window.scrollTo(0,0)})
    const header = await page.locator('.community-topbar').boundingBox()
    expect(header.y).toBeGreaterThanOrEqual(64)
    expect(header.y).toBeLessThanOrEqual(84)
    if (route.includes('/user/')) {
      const card = page.locator('.community-profile-heading')
      const back = card.getByRole('button',{name:'Voltar',exact:true})
      const message = card.getByRole('button',{name:'Enviar mensagem'})
      const bounds = await card.boundingBox(), backBox = await back.boundingBox(), messageBox = await message.boundingBox()
      expect(messageBox.x + messageBox.width).toBeLessThanOrEqual(bounds.x + bounds.width - 10)
      expect(messageBox.x + messageBox.width).toBeGreaterThan(bounds.x + bounds.width - 20)
      expect(backBox.x).toBeGreaterThan(bounds.x + bounds.width / 2)
      await page.screenshot({path:testInfo.outputPath('community-profile-spacing.png')})
    } else if (route === '/community') await page.screenshot({path:testInfo.outputPath('community-spacing.png')})
    await page.evaluate(()=>window.scrollTo(0,200))
    expect((await page.locator('.community-topbar').boundingBox()).y).toBeGreaterThanOrEqual(64)
  }
})

test('post photos suppress save menus and double taps like without undoing an existing like', async ({page}, testInfo) => {
  await setup(page)
  await page.goto('/#/community')
  const post = page.locator('[data-post-id="11111111-1111-4111-8111-000000000001"]')
  const photo = post.locator('.community-media-slot.is-ready img')
  const heart = post.getByRole('button',{name:'Curtir postagem'})
  await expect(photo).toBeVisible()
  expect(await photo.evaluate(el=>el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true})))).toBe(false)
  expect(await photo.evaluate(el=>el.draggable)).toBe(false)
  await photo.click()
  await expect(heart).toHaveAttribute('aria-pressed','false')
  await photo.dblclick()
  await expect(heart).toHaveAttribute('aria-pressed','true')
  await photo.dblclick()
  await expect(heart).toHaveAttribute('aria-pressed','true')
  await heart.click()
  await expect(heart).toHaveAttribute('aria-pressed','false')
  if (testInfo.project.use.hasTouch) {
    await photo.scrollIntoViewIfNeeded()
    const box=await photo.boundingBox()
    await page.touchscreen.tap(box.x+box.width/2,box.y+40)
    await page.touchscreen.tap(box.x+box.width/2,box.y+40)
  } else await photo.dblclick()
  await expect(heart).toHaveAttribute('aria-pressed','true')
  await expect(post.locator('.community-liker-summary')).toContainText('Pessoa Teste curtiu')
})

test('comments paginate by ten while the background stays fixed and restores on close', async ({page}) => {
  const {posts}=await setup(page)
  posts[0].comments=Array.from({length:23},(_,index)=>({id:`comment-${index}`,post_id:posts[0].id,author_id:STUDENT,author:profiles[STUDENT],body:`Comentário ${index}`,created_at:'2026-10-23T12:00:00Z',parent_comment_id:null,likes:[]}))
  await page.goto('/#/community')
  const post=page.locator(`[data-post-id="${posts[0].id}"]`)
  const trigger=post.getByRole('button',{name:'Abrir comentários'})
  await trigger.scrollIntoViewIfNeeded()
  const scrollY=await page.evaluate(()=>window.scrollY)
  const postTop=(await post.boundingBox()).y
  await trigger.click()
  const dialog=page.getByRole('dialog',{name:'Comentários'})
  await expect(dialog.locator('[data-community-comment-id]')).toHaveCount(10)
  await expect.poll(()=>page.evaluate(()=>document.body.style.position)).toBe('fixed')
  await dialog.getByRole('button',{name:'Carregar mais comentários'}).click()
  await expect(dialog.locator('[data-community-comment-id]')).toHaveCount(20)
  await dialog.getByRole('button',{name:'Carregar mais comentários'}).click()
  await expect(dialog.locator('[data-community-comment-id]')).toHaveCount(23)
  await expect(dialog.getByRole('button',{name:'Carregar mais comentários'})).toHaveCount(0)
  const list=dialog.locator('.community-comments-scroll')
  await list.evaluate(el=>{el.scrollTop=el.scrollHeight})
  await list.hover(); await page.mouse.wheel(0,1000)
  expect(Math.abs((await post.boundingBox()).y-postTop)).toBeLessThan(2)
  await dialog.getByRole('button',{name:'Fechar comentários'}).click()
  await expect(dialog).toHaveCount(0)
  await expect.poll(()=>page.evaluate(()=>document.body.style.position)).toBe('')
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(scrollY)
})

test('keeps social feed actions available while post photos load and preserves identity, comments and profile navigation', async ({page}) => {
  const {releaseImage}=await setup(page,true)
  await page.goto('/#/community')
  await expect(page.locator('.community-post-gate').first()).toHaveAttribute('aria-busy','true')
  await expect(page.getByRole('heading',{name:'Comunidade'})).toBeVisible()
  await expect(page.locator('[data-community-composer]')).toBeVisible()
  await expect(page.locator('[data-community-feed-context]')).toHaveText('Recentes')
  const theirs=page.locator(`[data-post-id="11111111-1111-4111-8111-000000000001"]`)
  await expect(theirs.locator('> .community-post-head')).toBeVisible()
  await expect(theirs.getByLabel('Curtir postagem')).toHaveAttribute('aria-pressed','false')
  releaseImage()
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

test('reports another author’s publication through the social menu with its canonical target', async ({page}) => {
  const { reports } = await setup(page)
  await page.goto('/#/community')
  const theirs=page.locator(`[data-post-id="11111111-1111-4111-8111-000000000001"]`)
  await theirs.getByLabel('Mais opções').click()
  await theirs.getByRole('button',{name:'Denunciar',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Denunciar conteúdo'})
  await dialog.getByLabel('Spam ou atividade suspeita').click()
  await dialog.getByRole('button',{name:'Enviar denúncia',exact:true}).click()
  await expect.poll(() => reports.length).toBe(1)
  expect(reports[0]).toMatchObject({p_target_kind:'post',p_post_id:'11111111-1111-4111-8111-000000000001',p_comment_id:null,p_reason:'spam'})
})
