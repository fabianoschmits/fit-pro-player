import { useRef } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { useStore } from '../store/useStore.js'
import TrainingOnboarding from '../components/onboarding/TrainingOnboarding.jsx'
import ProfessionalOnboarding from '../components/onboarding/ProfessionalOnboarding.jsx'

export default function AccountOnboarding() {
  const auth = useAuth()
  return <AccountJourney key={auth.user?.id || 'local'} user={auth.user} />
}

function AccountJourney({ user }) {
  const navigate = useNavigate()
  const state = useStore(s => s.S)
  const startedHere = useRef(!state.onboardingDone)
  const owner = user?.id ? 'account:' + user.id : 'anonymous'
  const savedKind = state.onboardingDraft?.owner === owner ? state.onboardingDraft.kind : null
  const professional = Boolean(user?.id && !user.isAnonymous && (savedKind === 'professional' || user.accountType === 'professional'))
  const finish = destination => navigate(destination || (professional ? '/professional' : '/plan'), { replace: true })

  // Keep the just-completed journey mounted for its final action. Existing users
  // visiting the setup URL should return to their workspace immediately.
  if (state.onboardingDone && !startedHere.current) {
    return <Navigate to={professional ? '/professional' : '/plan'} replace />
  }
  return professional
    ? <ProfessionalOnboarding onDone={finish} />
    : <TrainingOnboarding onDone={finish} />
}
