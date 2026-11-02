import {test,expect} from '@playwright/test'
import {seed,USER,STUDENT,openMainNavigation} from './fixtures.test.js'
const TICKET='99999999-9999-4999-8999-999999999999'
const BLOCK='88888888-8888-4888-8888-888888888888'
const reporter='33333333-3333-4333-8333-333333333333'
function moderationState(){
 let restriction=null
 const history=[]
 const active=()=>restriction&&!restriction.revoked_at&&Date.parse(restriction.ends_at)>Date.now()?restriction:null
 const denied=()=>({__error:{status:403,body:{code:'42501',message:'community-access-restricted'}}})
 const rpc={
  community_access_status:(_args,{userId})=>({active:userId===STUDENT?active():null}),
  community_acknowledge_restriction:({p_id})=>{expect(p_id).toBe(BLOCK);restriction.acknowledged_at=new Date().toISOString();return true},
  ops_community_restriction_status:()=>({active:active(),history}),
  ops_community_restrict_user:args=>{
   expect(args.p_user_id).toBe(STUDENT);expect(args.p_source_ticket_id).toBe(TICKET);expect(args.p_duration).toBe('24h')
   restriction={id:BLOCK,user_id:STUDENT,reason:args.p_reason,admin_message:args.p_admin_message,restriction_type:'temporary',starts_at:new Date().toISOString(),created_at:new Date().toISOString(),ends_at:new Date(Date.now()+86400000).toISOString(),source_ticket_id:TICKET,acknowledged_at:null,status:'active'}
   history.push(restriction);return restriction
  },
  ops_community_unrestrict_user:args=>{expect(args.p_user_id).toBe(STUDENT);restriction.revoked_at=new Date().toISOString();restriction.revoke_reason=args.p_reason;restriction.status='revoked';return true},
  ops_support_mark_read:null,
  ops_support_ticket_detail:()=>({ticket:{id:TICKET,user_id:reporter,subject:'Denúncia de spam',status:'pending',priority:'normal'},messages:[],events:[],report_context:{target_kind:'post',post_id:'post-1',reported_user_id:STUDENT,reason:'spam',content_excerpt:'Spam denunciado'}}),
  ops_user_detail:args=>[{user_id:args.p_user_id,display_name:args.p_user_id===STUDENT?'Pessoa denunciada':'Pessoa denunciante',roles:[]}],
  community_posts:()=>active()?denied():[],
  community_send_message:(_args,{userId,request})=>{
   expect(userId).toBe(STUDENT)
   expect(request.headers().authorization).toMatch(/^Bearer /)
   return active()?denied():true
  },
  athlete_plan_library_page:{items:[],total:0},
 }
 return {rpc,active,expire:()=>{restriction.ends_at=new Date(Date.now()-1000).toISOString();restriction.status='expired'}}
}
test('report moderation restricts only community until admin release across independent sessions',async({browser,baseURL},testInfo)=>{
 const shared=moderationState()
 const device=Object.fromEntries(['viewport','screen','isMobile','hasTouch','deviceScaleFactor','userAgent'].filter(key=>testInfo.project.use[key]!==undefined).map(key=>[key,testInfo.project.use[key]]))
 const adminContext=await browser.newContext({...device,baseURL,serviceWorkers:'block'}),userContext=await browser.newContext({...device,baseURL,serviceWorkers:'block'})
 try{
  const admin=await adminContext.newPage(),user=await userContext.newPage()
  await seed(admin,{authenticated:true,roles:['admin'],rpc:shared.rpc})
  await admin.goto(`/#/console/support/${TICKET}`)
  await expect(admin.getByText('Usuário denunciado: Pessoa denunciada')).toBeVisible()
  await admin.getByRole('textbox',{name:'Mensagem ao usuário (opcional)'}).fill('Evite mensagens repetidas na Comunidade.')
  await admin.getByRole('button',{name:'Bloquear da Comunidade',exact:true}).click()
  await expect(admin.getByText('Bloqueio ativo na Comunidade.',{exact:true})).toBeVisible()
  await seed(user,{authenticated:true,userId:STUDENT,rpc:shared.rpc})
  await user.goto('/#/home')
  const dialog=user.getByRole('dialog',{name:'Seu acesso à Comunidade foi restringido'})
  await expect(dialog).toBeVisible();await expect(dialog).toContainText('Motivo: Spam')
  await expect(dialog.getByText('Evite mensagens repetidas na Comunidade.')).toBeVisible()
  await expect(dialog.getByText(/Restrição temporária. Liberação em/)).toBeVisible()
  await dialog.getByRole('button',{name:'Entendi',exact:true}).click()
  await expect(dialog).toHaveCount(0);expect(shared.active()).not.toBeNull()
  await openMainNavigation(user)
  await expect(user.getByRole('button',{name:'Comunidade',exact:true})).toHaveCount(0)
  for(const path of ['/community','/community/profile',`/community/user/${USER}`,'/community/messages',`/community/messages/${USER}`]){
   await user.goto(`/#${path}`);await expect(user).toHaveURL(/#\/home$/)
  }
  const denied=await user.evaluate(async()=>{
   const token=JSON.parse(localStorage.getItem('sb-fitpp-test-auth-token'))
   const response=await fetch('https://fitpp-test.supabase.co/rest/v1/rpc/community_send_message',{method:'POST',headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({p_peer:'11111111-1111-4111-8111-111111111111',p_body:'Mensagem'})})
   return {status:response.status,body:await response.json()}
  })
  expect(denied.status).toBe(403);expect(denied.body.code).toBe('42501')
  await user.goto('/#/plan');await expect(user.locator('.community-restriction-dialog')).toHaveCount(0);await expect(user).toHaveURL(/#\/plan$/)
  await expect(user.getByText('Treino de teste',{exact:true}).filter({visible:true}).first()).toBeVisible()
  await user.goto('/#/home')
  await admin.getByRole('textbox',{name:'Motivo da liberação'}).fill('Revisão concluída')
  await admin.getByRole('button',{name:'Liberar acesso à Comunidade',exact:true}).click()
  await expect(admin.getByText('Sem bloqueio ativo na Comunidade.',{exact:true})).toBeVisible()
  await user.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await openMainNavigation(user)
  await expect(user.getByRole('button',{name:'Comunidade',exact:true})).toBeVisible()
  await user.goto('/#/community');await expect(user).toHaveURL(/#\/community$/)
  await expect(user.getByRole('dialog',{name:'Seu acesso à Comunidade foi restringido'})).toHaveCount(0)
 }finally{await adminContext.close();await userContext.close()}
})

test('expired moderation restores community without an acknowledgement or administrator release',async({page})=>{
 const shared=moderationState()
 shared.rpc.ops_community_restrict_user({p_user_id:STUDENT,p_source_ticket_id:TICKET,p_duration:'24h',p_reason:'spam',p_admin_message:'Expirado'})
 shared.expire()
 await seed(page,{authenticated:true,userId:STUDENT,rpc:shared.rpc})
 await page.addInitScript(({userId,id})=>localStorage.setItem(`fpp_community_access_v1:${userId}`,JSON.stringify({id,endsAt:new Date(Date.now()-1000).toISOString()})),{userId:STUDENT,id:BLOCK})
 await page.goto('/#/community')
 await expect(page).toHaveURL(/#\/community$/)
 await expect(page.getByRole('dialog',{name:'Seu acesso à Comunidade foi restringido'})).toHaveCount(0)
 await expect(page.getByText('Verificando acesso à Comunidade…')).toHaveCount(0)
})
