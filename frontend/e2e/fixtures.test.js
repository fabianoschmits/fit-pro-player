import { expect } from '@playwright/test'

export const USER='11111111-1111-4111-8111-111111111111'
export const STUDENT='22222222-2222-4222-8222-222222222222'
export async function openMainNavigation(page) {
  const toggle = page.locator('.corner-nav-toggle')
  await expect(toggle).toBeVisible()
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
}
export function stateFixture(){
  return {pwaInstallPrompt:{dismissForever:true},stateSchemaVersion:2,massUnit:'kg',displayUnit:'kg',restSec:90,sound:false,keepAwake:false,lang:'pt',theme:'dark',accent:'lime',body:'male',targetW:null,
    profile:{name:'Pessoa Teste',avatarId:'avatar-27',birthDate:'1995-01-01',sex:'male',heightCm:175,startWeight:75,goal:'build_muscle',experience:'intermediate',completedAt:'2026-10-02T12:00:00Z'},
    planMode:'weekly',bodyweight:[],bodyMeasurements:[],bodyMeasurementGoals:{},
    routines:[{id:'e2e-routine',name:'Treino de teste',emoji:'dumbbell',ex:[{id:'0025',sets:1,reps:10,weight:20}]}],
    week:Object.fromEntries(Array.from({length:7},(_,day)=>[day,'e2e-routine'])),dayPlan:{},exWeights:{},workouts:[],active:null,customEx:[],mediaSize:'mini',
    reminder:{on:false,time:'08:00',tz:null},effort:null,assignedProgram:null,weighBeforeWorkout:false,onboardingDone:true,simpleMode:true,seenTips:{},pendingProfessionalEvents:[],professionalProgramDrafts:{},_ts:1}
}
export async function seed(page,{professional=false,authenticated=professional,userId=USER,roles=null,state=stateFixture(),rpc={}}={}){
  const user={id:userId,email:'browser-test@example.invalid',email_confirmed_at:'2026-10-01T12:00:00Z',app_metadata:{provider:'email'},user_metadata:{}}
  await page.route('https://fitpp-test.supabase.co/**',async route=>{
    const url=new URL(route.request().url()), name=url.pathname.split('/').at(-1)
    /** @type {any} */
    let data=[]
    if(url.pathname.includes('/auth/v1/user'))data=user
    else if(name==='athlete_routines' && !Object.hasOwn(rpc,name))data=state.routines.map(({id,name,...prescription},position)=>({id,user_id:userId,title:name,prescription,position,revision:1,created_at:'2026-11-01T12:00:00Z',updated_at:'2026-11-01T12:00:00Z'}))
    else if(name==='athlete_schedules' && !Object.hasOwn(rpc,name))data=[{user_id:userId,revision:1,mode:state.planMode,schedule:{week:state.week,dayPlan:state.dayPlan},updated_at:'2026-11-01T12:00:00Z'}]
    else if(name==='account_preferences' && !Object.hasOwn(rpc,name))data=[{user_id:userId,revision:1,display_unit:state.displayUnit,mass_unit:'kg',state_schema_version:2,preferences:{lang:state.lang,profile:state.profile,pwaInstallPrompt:state.pwaInstallPrompt},updated_at:'2026-11-01T12:00:00Z'}]
    else if(name==='save_athlete_plan' && !Object.hasOwn(rpc,name)){
      const args=route.request().postDataJSON(),revision=args.p_expected_revision+1
      state.routines=args.p_routines.map(({id,title,prescription})=>({...prescription,id,name:title}));state.week=args.p_schedule.week;state.dayPlan=args.p_schedule.dayPlan;state.planMode=args.p_mode
      data={routines:args.p_routines.map((row,position)=>({...row,user_id:userId,position,revision,created_at:'2026-11-01T12:00:00Z',updated_at:'2026-11-01T12:00:00Z'})),schedule:{user_id:userId,revision,mode:args.p_mode,schedule:args.p_schedule,updated_at:'2026-11-01T12:00:00Z'}}
    }
    else if(name==='save_account_preferences' && !Object.hasOwn(rpc,name)){
      const args=route.request().postDataJSON();data={user_id:userId,revision:args.p_expected_revision+1,display_unit:args.p_display_unit,mass_unit:'kg',state_schema_version:2,preferences:args.p_preferences,updated_at:'2026-11-01T12:00:00Z'}
    }
    else if(name==='account_snapshots')data={user_id:userId,revision:1,state_schema_version:1,payload:state,updated_at:'2026-10-02T12:00:00Z'}
    else if(name==='is_current_user_suspended' && !Object.hasOwn(rpc,name))data=false
    else if(name==='community_access_status' && !Object.hasOwn(rpc,name))data={active:null}
    else if(name==='community_has_block' && !Object.hasOwn(rpc,name))data=false
    else if(name==='community_acknowledge_restriction' && !Object.hasOwn(rpc,name))data=true
    else if(name==='ops_community_restriction_status' && !Object.hasOwn(rpc,name))data={active:null,history:[]}
    else if(name==='professional_link_requests_page' && !Object.hasOwn(rpc,name))data={items:[],total:0}
    else if(name==='professional_relationship_cycles' && !Object.hasOwn(rpc,name))data=[{id:'fixture-cycle',professional_user_id:userId,student_user_id:STUDENT,status:'active',created_at:'2026-10-10T12:00:00Z'}]
    else if(name==='user_roles')data=(roles || (professional?['professional']:[])).map(role=>({role}))
    else if(name==='save_own_account_snapshot')data=[{status:'APPLIED',revision:2,updated_at:new Date().toISOString()}]
    else if(Object.hasOwn(rpc,name))data=typeof rpc[name]==='function'?await rpc[name](JSON.parse(route.request().postData()||'{}'),{userId,user,request:route.request()}):rpc[name]
    if(name==='professional_invites'&&Array.isArray(data)){
      const personalFilter=url.searchParams.get('is_personal')
      if(personalFilter==='eq.true')data=data.filter(invite=>invite.is_personal)
      else if(personalFilter==='eq.false')data=data.filter(invite=>!invite.is_personal)
    }
    const error = data?.__error
    if(error){data=error.body;await route.fulfill({status:error.status||400,contentType:'application/json',body:JSON.stringify(data)})}
    else await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
  })
  await page.addInitScript(({authenticated,state,user})=>{
    if(localStorage.getItem('e2e_initialized'))return
    localStorage.setItem('e2e_initialized','1')
    // Functional flows start after the separate privacy-choice screen.
    // Keep optional purposes disabled without interacting with real accounts.
    localStorage.setItem('fpp_privacy_consent_v1',JSON.stringify({version:'2026-10-13',necessary:true,preferences:false,analytics:false,communications:false,acceptedAt:'2026-10-15T12:00:00Z'}))
    if(authenticated){
      const header=btoa(JSON.stringify({alg:'HS256',typ:'JWT'})), payload=btoa(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'}))
      localStorage.setItem('sb-fitpp-test-auth-token',JSON.stringify({access_token:`${header}.${payload}.fixture`,refresh_token:'browser-test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}))
      localStorage.setItem(`fpp_account_cache_v1:${user.id}`,JSON.stringify({ownerId:user.id,schemaVersion:1,state}))
      localStorage.setItem(`fpp_account_sync_v1:${user.id}`,JSON.stringify({revision:1,dirty:false}))
      localStorage.setItem(`fpp_app_entered:${user.id}`,'1')
    }else{localStorage.setItem('gym_state_v1',JSON.stringify(state));localStorage.setItem('gym_guest','1');localStorage.setItem('fpp_app_entered:anonymous','1')}
  },{authenticated,state,user})
}
