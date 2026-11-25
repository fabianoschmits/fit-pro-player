import { Link } from 'react-router-dom'
import { t } from '../../../lib/i18n.js'
import Icon from '../../Icon.jsx'
import { useProfessionalInsights } from '../../../lib/use-professional-insights.js'
export default function ProfessionalInsightsPreview({studentId=null}) {
 const {alerts,data,online,error,loading}=useProfessionalInsights({studentId,limit:studentId?1:5})
 return <section className="card professional-insights-preview"><h2>{t(studentId?'Follow-up points':'Student follow-up')}</h2>
 {loading?<p role="status">{t('Loading…')}</p>:!online?<p>{t('Connect to update student follow-up.')}</p>:error?<p>{t('Could not load student follow-up.')}</p>:data&&<><p>{t('{0} new alerts in available records.',alerts.filter(a=>a.status==='new').length)}</p>{studentId&&alerts.slice(0,3).map(alert=><p key={alert.episodeKey}>{t(alert.titleKey)}</p>)}</>}
 <Link className="management-button" to={'/professional/insights'+(studentId?'?student='+encodeURIComponent(studentId):'')}><Icon name="chart"/>{t('View student follow-up')} ›</Link></section>
}
