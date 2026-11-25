export function createProfessionalInsightsRepository(client) {
 const rpc=async(name,args)=>{const result=await client.rpc(name,args);if(result.error)throw result.error;return result.data}
 return {
  async load({offset=0,limit=20,studentId=null}={}) {
   const data=await rpc('get_professional_insights_context',{p_offset:offset,p_limit:limit,p_student_id:studentId})
   if(!data||!Array.isArray(data.items)||!Number.isSafeInteger(data.total)||typeof data.hasMore!=='boolean')throw new Error('invalid-insights-context')
   return data
  },
  save:(alert,status,days=null)=>rpc('save_professional_insight_state',{p_relationship_id:alert.relationshipId,p_type:alert.type,p_episode_key:alert.episodeKey,p_fingerprint:alert.evidenceFingerprint,p_status:status,p_expected_revision:alert.revision||0,p_snooze_days:days}),
 }
}
