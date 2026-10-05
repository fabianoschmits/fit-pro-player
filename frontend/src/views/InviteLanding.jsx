import { useParams } from 'react-router-dom'
import StudentProfessionalInvite from '../components/StudentProfessionalInvite.jsx'

export default function InviteLanding() {
  const { code } = useParams()
  return <StudentProfessionalInvite inviteCode={code} />
}
