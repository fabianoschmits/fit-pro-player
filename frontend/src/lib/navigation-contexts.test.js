// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  resolveNavigationContext,
  NAVIGATION_CONTEXT_STORAGE_KEY,
} from './navigation-contexts.js'

describe('navigation-contexts resolver', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('resolves Home context correctly on /home', () => {
    const res = resolveNavigationContext({ pathname: '/home' })
    expect(res.contextId).toBe('home')
    expect(res.activeKey).toBe('home')
    expect(res.items.map(i => i.k)).toEqual(['home', 'plan', 'start', 'stats'])
  })

  it.each(['/community', '/community/profile', '/community/user/other-user'])('selects only Community on %s, including the collapsed menu', pathname => {
    const res = resolveNavigationContext({ pathname })
    expect(res.contextId).toBe('home')
    expect(res.activeKey).toBe('community')
    expect(res.items.some(item => item.k === res.activeKey)).toBe(false)
    expect(res.pivotItem?.to).toBe('/community')
    expect(res.pivotItem?.label()).toBe('Comunidade')
  })

  it('resolves Training context on /plan and /library', () => {
    const resPlan = resolveNavigationContext({ pathname: '/plan' })
    expect(resPlan.contextId).toBe('training')
    expect(resPlan.activeKey).toBe('plan')
    expect(resPlan.items.map(i => i.k)).toEqual(['home', 'plan', 'library', 'history'])

    const resLib = resolveNavigationContext({ pathname: '/library' })
    expect(resLib.contextId).toBe('training')
    expect(resLib.activeKey).toBe('library')
    expect(resLib.items.map(i => i.k)).toEqual(['home', 'plan', 'library', 'history'])
  })

  it('keeps a resumable workout reachable without replacing the current route action', () => {
    const active = { active: { id: 'active-workout' }, routines: [] }

    const plan = resolveNavigationContext({ pathname: '/plan', hasActiveWorkout: true, workoutState: active })
    expect(plan.items.map(i => i.k)).toEqual(['home', 'plan', 'library', 'start'])
    expect(plan.items[3].label(active)).toBe('Retomar')

    const stats = resolveNavigationContext({ pathname: '/stats', hasActiveWorkout: true, workoutState: active })
    expect(stats.items.map(i => i.k)).toEqual(['home', 'stats', 'body-progress', 'start'])
    expect(stats.items[3].label(active)).toBe('Retomar')

    const privacy = resolveNavigationContext({ pathname: '/privacy-settings', hasActiveWorkout: true, workoutState: active })
    expect(privacy.activeKey).toBe('privacy-settings')
    expect(privacy.items.map(i => i.k)).toEqual(['home', 'settings', 'start', 'privacy-settings'])
  })

  it('inherits Training context on /plan/r/:id (level 2)', () => {
    const res = resolveNavigationContext({ pathname: '/plan/r/routine-123' })
    expect(res.contextId).toBe('training')
    expect(res.activeKey).toBe('plan')
    expect(res.items.map(i => i.k)).toEqual(['home', 'plan', 'library', 'history'])
  })

  it('resolves Workout context on /workout', () => {
    const res = resolveNavigationContext({ pathname: '/workout', hasActiveWorkout: true })
    expect(res.contextId).toBe('workout')
    expect(res.activeKey).toBe('start')
    expect(res.items.map(i => i.k)).toEqual(['home', 'plan', 'start', 'history'])
  })

  it('resolves Stats context on /stats and /body-progress', () => {
    const resStats = resolveNavigationContext({ pathname: '/stats' })
    expect(resStats.contextId).toBe('stats')
    expect(resStats.activeKey).toBe('stats')
    expect(resStats.items.map(i => i.k)).toEqual(['home', 'stats', 'body-progress', 'history'])

    const resBody = resolveNavigationContext({ pathname: '/body-progress' })
    expect(resBody.contextId).toBe('stats')
    expect(resBody.activeKey).toBe('body-progress')
    expect(resBody.items.map(i => i.k)).toEqual(['home', 'stats', 'body-progress', 'history'])
  })

  it('resolves /history with origin context (Training vs Stats)', () => {
    // Coming from plan / training
    const resFromTraining = resolveNavigationContext({
      pathname: '/history',
      navigationState: { fromContext: 'training' },
    })
    expect(resFromTraining.contextId).toBe('training')
    expect(resFromTraining.activeKey).toBe('history')
    expect(resFromTraining.items.map(i => i.k)).toEqual(['home', 'plan', 'library', 'history'])

    // Coming from stats
    const resFromStats = resolveNavigationContext({
      pathname: '/history',
      navigationState: { fromContext: 'stats' },
    })
    expect(resFromStats.contextId).toBe('stats')
    expect(resFromStats.activeKey).toBe('history')
    expect(resFromStats.items.map(i => i.k)).toEqual(['home', 'stats', 'body-progress', 'history'])

    // Direct access fallback uses sessionStorage if previously visited
    window.sessionStorage.setItem(NAVIGATION_CONTEXT_STORAGE_KEY, 'stats')
    const resFallback = resolveNavigationContext({ pathname: '/history' })
    expect(resFallback.contextId).toBe('stats')
    expect(resFallback.activeKey).toBe('history')
  })

  it('resolves Account context on /settings, /personal-data and privacy paths', () => {
    const resSettings = resolveNavigationContext({ pathname: '/settings' })
    expect(resSettings.contextId).toBe('account')
    expect(resSettings.activeKey).toBe('settings')
    expect(resSettings.items.map(i => i.k)).toEqual(['home', 'settings', 'personal-data', 'privacy-settings'])

    const resPersonal = resolveNavigationContext({ pathname: '/personal-data' })
    expect(resPersonal.contextId).toBe('account')
    expect(resPersonal.activeKey).toBe('personal-data')

    const resPrivacy = resolveNavigationContext({ pathname: '/privacy' })
    expect(resPrivacy.contextId).toBe('account')
    expect(resPrivacy.activeKey).toBe('privacy-settings')
  })

  it('resolves Support context on /support and tickets subpaths', () => {
    const resSupport = resolveNavigationContext({ pathname: '/support' })
    expect(resSupport.contextId).toBe('support')
    expect(resSupport.activeKey).toBe('support')
    expect(resSupport.items.map(i => i.k)).toEqual(['home', 'support', 'support-tickets', 'support-new'])

    const resTickets = resolveNavigationContext({ pathname: '/support/tickets' })
    expect(resTickets.contextId).toBe('support')
    expect(resTickets.activeKey).toBe('support-tickets')

    const resTicketDetail = resolveNavigationContext({ pathname: '/support/tickets/ticket-42' })
    expect(resTicketDetail.contextId).toBe('support')
    expect(resTicketDetail.activeKey).toBe('support-tickets')

    const resNew = resolveNavigationContext({ pathname: '/support/tickets/new' })
    expect(resNew.contextId).toBe('support')
    expect(resNew.activeKey).toBe('support-new')
  })

  it('resolves StudentProfessionals context', () => {
    const resList = resolveNavigationContext({ pathname: '/student/professionals' })
    expect(resList.contextId).toBe('studentProfessionals')
    expect(resList.activeKey).toBe('student-list')
    expect(resList.items.map(i => i.k)).toEqual(['home', 'student-list', 'student-materials', 'student-add'])

    const resMaterials = resolveNavigationContext({ pathname: '/student/professionals/materials' })
    expect(resMaterials.contextId).toBe('studentProfessionals')
    expect(resMaterials.activeKey).toBe('student-materials')
  })

  it('resolves StudentProfessionalDetail (level 2) preserving professionalId', () => {
    const resSummary = resolveNavigationContext({
      pathname: '/student/professionals/prof-99',
      search: '?section=summary',
    })
    expect(resSummary.contextId).toBe('studentProfessionalDetail')
    expect(resSummary.activeKey).toBe('prof-summary')
    expect(resSummary.items.map(i => i.k)).toEqual(['home', 'student-list', 'prof-summary', 'prof-training'])
    expect(resSummary.items[2].to).toBe('/student/professionals/prof-99?section=summary')
    expect(resSummary.items[3].to).toBe('/student/professionals/prof-99?section=training')

    const resTraining = resolveNavigationContext({
      pathname: '/student/professionals/prof-99',
      search: '?section=training',
    })
    expect(resTraining.contextId).toBe('studentProfessionalDetail')
    expect(resTraining.activeKey).toBe('prof-training')
  })

  it('resolves Professional context on /professional and sub-paths', () => {
    const resOverview = resolveNavigationContext({ pathname: '/professional' })
    expect(resOverview.contextId).toBe('professional')
    expect(resOverview.activeKey).toBe('prof-overview')
    expect(resOverview.items.map(i => i.k)).toEqual(['home', 'prof-students', 'prof-programs', 'prof-invites'])
    expect(resOverview.pivotItem?.label()).toBe('Área profissional')

    const resStudents = resolveNavigationContext({ pathname: '/professional/students' })
    expect(resStudents.contextId).toBe('professional')
    expect(resStudents.activeKey).toBe('prof-students')
    expect(resStudents.pivotItem?.label()).toBe('Alunos')

    const resPrograms = resolveNavigationContext({ pathname: '/professional/programs' })
    expect(resPrograms.contextId).toBe('professional')
    expect(resPrograms.activeKey).toBe('prof-programs')
    expect(resPrograms.pivotItem?.label()).toBe('Programas')

    const resProgramNew = resolveNavigationContext({ pathname: '/professional/programs/new' })
    expect(resProgramNew.contextId).toBe('professional')
    expect(resProgramNew.activeKey).toBe('prof-programs')

    const resInvites = resolveNavigationContext({ pathname: '/professional/invites' })
    expect(resInvites.contextId).toBe('professional')
    expect(resInvites.activeKey).toBe('prof-invites')
    expect(resInvites.pivotItem?.label()).toBe('Convites')

    const resProfile = resolveNavigationContext({ pathname: '/professional/profile' })
    expect(resProfile.contextId).toBe('professional')
    expect(resProfile.activeKey).toBe('prof-profile')
    expect(resProfile.items.map(i => i.k)).toEqual(['home', 'prof-students', 'prof-programs', 'prof-invites'])
    expect(resProfile.pivotItem?.label()).toBe('Perfil profissional')

    // Alias antigo
    const resAlias = resolveNavigationContext({ pathname: '/professional-profile' })
    expect(resAlias.contextId).toBe('professional')
    expect(resAlias.activeKey).toBe('prof-profile')
    expect(resAlias.pivotItem?.label()).toBe('Perfil profissional')
  })

  it('resolves ProfessionalStudent context on /professional/students/:id', () => {
    const resSummary = resolveNavigationContext({
      pathname: '/professional/students/student-42',
      search: '?section=summary',
    })
    expect(resSummary.contextId).toBe('professionalStudent')
    expect(resSummary.activeKey).toBe('ps-summary')
    expect(resSummary.items.map(i => i.k)).toEqual(['home', 'prof-students', 'ps-summary', 'ps-training'])
    expect(resSummary.items[2].to).toBe('/professional/students/student-42?section=summary')
    expect(resSummary.items[3].to).toBe('/professional/students/student-42?section=training')

    const resTraining = resolveNavigationContext({
      pathname: '/professional/students/student-42',
      search: '?section=training',
    })
    expect(resTraining.contextId).toBe('professionalStudent')
    expect(resTraining.activeKey).toBe('ps-training')
  })
})
