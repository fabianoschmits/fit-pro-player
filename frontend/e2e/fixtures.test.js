export const USER='11111111-1111-4111-8111-111111111111'
export const STUDENT='22222222-2222-4222-8222-222222222222'
export function stateFixture(){
  return {unit:'kg',restSec:90,sound:false,keepAwake:false,lang:'pt',theme:'dark',accent:'lime',body:'male',targetW:null,
    profile:{name:'Pessoa Teste',avatarId:'avatar-27',birthDate:'1995-01-01',sex:'male',heightCm:175,startWeight:75,goal:'build_muscle',experience:'intermediate',completedAt:'2026-10-02T12:00:00Z'},
    planMode:'weekly',bodyweight:[],bodyMeasurements:[],bodyMeasurementGoals:{},
    routines:[{id:'e2e-routine',name:'Treino de teste',emoji:'dumbbell',ex:[{id:'0025',sets:1,reps:10,weight:20}]}],
    week:Object.fromEntries(Array.from({length:7},(_,day)=>[day,'e2e-routine'])),dayPlan:{},exWeights:{},workouts:[],active:null,customEx:[],mediaSize:'mini',
    reminder:{on:false,time:'08:00',tz:null},effort:null,assignedProgram:null,weighBeforeWorkout:false,onboardingDone:true,simpleMode:true,seenTips:{},pendingProfessionalEvents:[],professionalProgramDrafts:{},_ts:1}
}
export async function seed(page,{professional=false,authenticated=professional,state=stateFixture(),rpc={}}={}){
  const user={id:USER,email:'browser-test@example.invalid',email_confirmed_at:'2026-10-01T12:00:00Z',app_metadata:{provider:'email'},user_metadata:{}}
  await page.route('https://fitpp-test.supabase.co/**',async route=>{
    const url=new URL(route.request().url()), name=url.pathname.split('/').at(-1)
    let data=[]
    if(url.pathname.includes('/auth/v1/user'))data=user
    else if(name==='account_snapshots')data={user_id:USER,revision:1,state_schema_version:1,payload:state,updated_at:'2026-10-02T12:00:00Z'}
    else if(name==='user_roles')data=professional?[{role:'professional'}]:[]
    else if(name==='save_own_account_snapshot')data=[{status:'APPLIED',revision:2,updated_at:new Date().toISOString()}]
    else if(Object.hasOwn(rpc,name))data=typeof rpc[name]==='function'?rpc[name](JSON.parse(route.request().postData()||'{}')):rpc[name]
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
  })
  await page.addInitScript(({authenticated,state,user})=>{
    if(localStorage.getItem('e2e_initialized'))return
    localStorage.setItem('e2e_initialized','1')
    if(authenticated){
      const header=btoa(JSON.stringify({alg:'HS256',typ:'JWT'})), payload=btoa(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'}))
      localStorage.setItem('sb-fitpp-test-auth-token',JSON.stringify({access_token:`${header}.${payload}.fixture`,refresh_token:'browser-test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}))
      localStorage.setItem(`fpp_account_cache_v1:${user.id}`,JSON.stringify({ownerId:user.id,schemaVersion:1,state}))
      localStorage.setItem(`fpp_account_sync_v1:${user.id}`,JSON.stringify({revision:1,dirty:false}))
      localStorage.setItem(`fpp_app_entered:${user.id}`,'1')
    }else{localStorage.setItem('gym_state_v1',JSON.stringify(state));localStorage.setItem('gym_guest','1');localStorage.setItem('fpp_app_entered:anonymous','1')}
  },{authenticated,state,user})
}
