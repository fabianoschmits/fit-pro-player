import { t } from './i18n.js'
import { startTabShortLabel } from './ux.js'

export const NAVIGATION_CONTEXT_STORAGE_KEY = 'fpp_last_nav_context'

/**
 * Persists the latest active main context (training or stats) in sessionStorage.
 */
export function persistNavigationContext(contextId) {
  if (typeof window === 'undefined' || !window.sessionStorage) return
  if (contextId === 'training' || contextId === 'stats') {
    try {
      window.sessionStorage.setItem(NAVIGATION_CONTEXT_STORAGE_KEY, contextId)
    } catch {}
  }
}

/**
 * Retrieves the stored fallback context from sessionStorage.
 */
export function getStoredNavigationContext() {
  if (typeof window === 'undefined' || !window.sessionStorage) return null
  try {
    return window.sessionStorage.getItem(NAVIGATION_CONTEXT_STORAGE_KEY)
  } catch {
    return null
  }
}

// A running workout must remain one tap away without taking over the item that
// represents the screen the person is currently using. Less-frequent routes
// remain available from More.
function withResumeAction(items, activeKey, hasActiveWorkout) {
  if (!hasActiveWorkout || items.some(item => item.k === 'start')) return items
  const replaceAt = items.map((item, index) => ({ item, index })).reverse()
    .find(({ item }) => item.k !== 'home' && item.k !== activeKey)?.index
  if (replaceAt == null) return items
  const next = [...items]
  next[replaceAt] = { k: 'start', icon: 'dumbbell', action: true, to: '/workout', label: state => startTabShortLabel(state) }
  return next
}

/**
 * Resolves which navigation context, items, and active item key apply.
 */
export function resolveNavigationContext({
  pathname = '',
  search = '',
  navigationState = null,
  previousContext = null,
  workoutState = null,
  hasActiveWorkout = false,
}) {
  const normPath = pathname.replace(/\/+$/, '') || '/'

  // 1. Detect direct context from pathname
  let detectedContext = null
  let activeKey = null

  if (normPath === '/home' || normPath === '/' || normPath === '/tests/home-glass') {
    detectedContext = 'home'
    activeKey = 'home'
  } else if (normPath === '/workout') {
    detectedContext = 'workout'
    activeKey = 'start'
  } else if (normPath === '/plan' || normPath.startsWith('/plan/r/') || normPath === '/library') {
    detectedContext = 'training'
    if (normPath.startsWith('/plan')) activeKey = 'plan'
    else if (normPath === '/library') activeKey = 'library'
  } else if (normPath === '/stats' || normPath === '/body-progress' || normPath === '/stats/body-progress') {
    detectedContext = 'stats'
    if (normPath === '/stats') activeKey = 'stats'
    else activeKey = 'body-progress'
  } else if (
    normPath === '/settings' ||
    normPath === '/personal-data' ||
    normPath === '/privacy-settings' ||
    normPath === '/privacy' ||
    normPath === '/terms' ||
    normPath === '/data-rights'
  ) {
    detectedContext = 'account'
    if (normPath === '/personal-data') activeKey = 'personal-data'
    else if (normPath === '/privacy-settings' || normPath === '/privacy' || normPath === '/terms' || normPath === '/data-rights') {
      activeKey = 'privacy-settings'
    } else {
      activeKey = 'settings'
    }
  } else if (normPath.startsWith('/support')) {
    detectedContext = 'support'
    if (normPath === '/support/tickets/new') activeKey = 'support-new'
    else if (normPath.startsWith('/support/tickets')) activeKey = 'support-tickets'
    else activeKey = 'support'
  } else if (normPath.startsWith('/student/professionals')) {
    const studentDetailMatch = normPath.match(/^\/student\/professionals\/([^/]+)$/)
    const subRoute = normPath.replace('/student/professionals', '')
    if (studentDetailMatch && subRoute !== '/add' && subRoute !== '/materials') {
      detectedContext = 'studentProfessionalDetail'
      const searchParams = new URLSearchParams(search || '')
      const section = searchParams.get('section')
      activeKey = section === 'training' ? 'prof-training' : 'prof-summary'
    } else {
      detectedContext = 'studentProfessionals'
      if (normPath === '/student/professionals/materials') activeKey = 'student-materials'
      else if (normPath === '/student/professionals/add') activeKey = 'student-add'
      else activeKey = 'student-list'
    }
  } else if (normPath.startsWith('/professional')) {
    // Detail page: /professional/students/:studentId
    const studentDetailMatch = normPath.match(/^\/professional\/students\/([^/]+)$/)
    if (studentDetailMatch) {
      detectedContext = 'professionalStudent'
      const searchParams = new URLSearchParams(search || '')
      const section = searchParams.get('section')
      activeKey = section === 'training' ? 'ps-training' : 'ps-summary'
    } else {
      detectedContext = 'professional'
      if (normPath === '/professional/students') activeKey = 'prof-students'
      else if (normPath.startsWith('/professional/programs')) activeKey = 'prof-programs'
      else if (normPath.startsWith('/professional/invites')) activeKey = 'prof-invites'
      else if (normPath === '/professional/profile' || normPath.startsWith('/professional/profile/') || normPath === '/professional-profile') {
        activeKey = 'prof-profile'
      } else {
        activeKey = 'prof-overview'
      }
    }
  } else if (normPath === '/history') {
    // Shared page: preserve origin context
    const originContext =
      navigationState?.fromContext ||
      previousContext ||
      getStoredNavigationContext() ||
      'training'

    detectedContext = originContext === 'stats' ? 'stats' : 'training'
    activeKey = 'history'
  } else {
    // Default fallback
    detectedContext = 'home'
    activeKey = 'home'
  }

  // Update session storage if in persistent context
  if (detectedContext === 'training' || detectedContext === 'stats') {
    persistNavigationContext(detectedContext)
  }

  // Build items according to detected context
  let items = []

  switch (detectedContext) {
    case 'home':
      items = [
        { k: 'home', icon: 'house', to: '/home', label: () => t('Home') },
        { k: 'plan', icon: 'calendar', to: '/plan', label: () => t('Plan') },
        { k: 'start', icon: 'dumbbell', action: true, label: s => startTabShortLabel(s) },
        { k: 'stats', icon: 'chart', to: '/stats', label: () => t('Stats') },
      ]
      break

    case 'training':
      items = [
        { k: 'home', icon: 'house', to: '/home', label: () => t('Home') },
        { k: 'plan', icon: 'calendar', to: '/plan', label: () => t('Plan') },
        { k: 'library', icon: 'list', to: '/library', label: () => t('Exercises') },
        { k: 'history', icon: 'history', to: '/history', label: () => t('History') },
      ]
      break

    case 'workout':
      items = [
        { k: 'home', icon: 'house', to: '/home', label: () => t('Home') },
        { k: 'plan', icon: 'calendar', to: '/plan', label: () => t('Plan') },
        { k: 'start', icon: 'dumbbell', action: true, to: '/workout', label: s => startTabShortLabel(s) },
        { k: 'history', icon: 'history', to: '/history', label: () => t('History') },
      ]
      break

    case 'stats':
      items = [
        { k: 'home', icon: 'house', to: '/home', label: () => t('Home') },
        { k: 'stats', icon: 'chart', to: '/stats', label: () => t('Stats') },
        { k: 'body-progress', icon: 'chartLine', to: '/body-progress', label: () => 'Corpo' },
        { k: 'history', icon: 'history', to: '/history', label: () => t('History') },
      ]
      break

    case 'account':
      items = [
        { k: 'home', icon: 'house', to: '/home', label: () => t('Home') },
        { k: 'settings', icon: 'gear', to: '/settings', label: () => t('Settings') },
        { k: 'personal-data', icon: 'person', to: '/personal-data', label: () => 'Dados pessoais' },
        { k: 'privacy-settings', icon: 'shield', to: '/privacy-settings', label: () => 'Privacidade' },
      ]
      break

    case 'support':
      items = [
        { k: 'home', icon: 'house', to: '/home', label: () => t('Home') },
        { k: 'support', icon: 'info', to: '/support', label: () => 'Suporte' },
        { k: 'support-tickets', icon: 'history', to: '/support/tickets', label: () => 'Chamados' },
        { k: 'support-new', icon: 'chat', to: '/support/tickets/new', label: () => 'Novo chamado' },
      ]
      break

    case 'studentProfessionals':
      items = [
        { k: 'home', icon: 'house', to: '/home', label: () => t('Home') },
        { k: 'student-list', icon: 'personCircle', to: '/student/professionals', label: () => 'Profissionais' },
        { k: 'student-materials', icon: 'clipboard', to: '/student/professionals/materials', label: () => 'Materiais' },
        { k: 'student-add', icon: 'plus', to: '/student/professionals/add', label: () => 'Adicionar' },
      ]
      break

    case 'studentProfessionalDetail': {
      const match = normPath.match(/^\/student\/professionals\/([^/]+)$/)
      const professionalId = match ? match[1] : ''
      items = [
        { k: 'home', icon: 'house', to: '/home', label: () => t('Home') },
        { k: 'student-list', icon: 'personCircle', to: '/student/professionals', label: () => 'Profissionais' },
        {
          k: 'prof-summary',
          icon: 'info',
          to: `/student/professionals/${professionalId}?section=summary`,
          label: () => 'Resumo',
        },
        {
          k: 'prof-training',
          icon: 'dumbbell',
          to: `/student/professionals/${professionalId}?section=training`,
          label: () => 'Treino',
        },
      ]
      break
    }

    case 'professional':
      items = [
        { k: 'home', icon: 'house', to: '/home', label: () => t('Home') },
        { k: 'prof-students', icon: 'personCircle', to: '/professional/students', label: () => 'Alunos' },
        { k: 'prof-programs', icon: 'clipboard', to: '/professional/programs', label: () => 'Programas' },
        { k: 'prof-invites', icon: 'bell', to: '/professional/invites', label: () => 'Convites' },
      ]
      break

    case 'professionalStudent': {
      const psMatch = normPath.match(/^\/professional\/students\/([^/]+)$/)
      const studentId = psMatch ? psMatch[1] : ''
      items = [
        { k: 'home', icon: 'house', to: '/home', label: () => t('Home') },
        { k: 'prof-students', icon: 'personCircle', to: '/professional/students', label: () => 'Alunos' },
        {
          k: 'ps-summary',
          icon: 'info',
          to: `/professional/students/${studentId}?section=summary`,
          label: () => 'Resumo',
        },
        {
          k: 'ps-training',
          icon: 'clipboard',
          to: `/professional/students/${studentId}?section=training`,
          label: () => 'Treino',
        },
      ]
      break
    }

    default:
      items = [
        { k: 'home', icon: 'house', to: '/home', label: () => t('Home') },
        { k: 'plan', icon: 'calendar', to: '/plan', label: () => t('Plan') },
        { k: 'start', icon: 'dumbbell', action: true, label: s => startTabShortLabel(s) },
        { k: 'stats', icon: 'chart', to: '/stats', label: () => t('Stats') },
      ]
  }

  items = withResumeAction(items, activeKey, hasActiveWorkout)

  // Determine pivotItem: represents the current page when the menu is closed
  let pivotItem = items.find(item => item.k === activeKey) || null
  if (!pivotItem) {
    if (activeKey === 'prof-overview') {
      pivotItem = { k: 'prof-overview', icon: 'clipboard', to: '/professional', label: () => 'Área profissional' }
    } else if (activeKey === 'prof-profile') {
      pivotItem = { k: 'prof-profile', icon: 'personCircle', to: '/professional/profile', label: () => 'Perfil profissional' }
    }
  }

  return {
    contextId: detectedContext,
    items,
    activeKey,
    pivotItem,
  }
}
