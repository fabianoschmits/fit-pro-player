import homeLight from '../assets/page-backgrounds/home-light.png'
import homeDark from '../assets/page-backgrounds/home-dark.png'
import planLight from '../assets/page-backgrounds/plan-light.png'
import planDark from '../assets/page-backgrounds/plan-dark.png'
import workoutLight from '../assets/page-backgrounds/workout-light.png'
import workoutDark from '../assets/page-backgrounds/workout-dark.png'
import historyLight from '../assets/page-backgrounds/library-light.png'
import historyDark from '../assets/page-backgrounds/library-dark.png'
import communityLight from '../assets/page-backgrounds/community-light.png'
import communityDark from '../assets/page-backgrounds/community-dark.png'
import statsLight from '../assets/page-backgrounds/stats-light.png'
import statsDark from '../assets/page-backgrounds/stats-dark.png'
import invitesLight from '../assets/page-backgrounds/invites-light.png'
import invitesDark from '../assets/page-backgrounds/invites-dark.png'
import studentsLight from '../assets/page-backgrounds/students-light.png'
import studentsDark from '../assets/page-backgrounds/students-dark.png'
import studentProfessionalsLight from '../assets/page-backgrounds/student-professionals-light.png'
import studentProfessionalsDark from '../assets/page-backgrounds/student-professionals-dark.png'
import templatesLight from '../assets/page-backgrounds/templates-light.png'
import templatesDark from '../assets/page-backgrounds/templates-dark.png'
import professionalProfileLight from '../assets/page-backgrounds/professional-profile-light.png'
import professionalProfileDark from '../assets/page-backgrounds/professional-profile-dark.png'

const sceneryByTheme = {
  light: [
    homeLight,
    planLight,
    workoutLight,
    historyLight,
    communityLight,
    statsLight,
    invitesLight,
    studentsLight,
    studentProfessionalsLight,
    templatesLight,
    professionalProfileLight,
  ],
  dark: [
    homeDark,
    planDark,
    workoutDark,
    historyDark,
    communityDark,
    statsDark,
    invitesDark,
    studentsDark,
    studentProfessionalsDark,
    templatesDark,
    professionalProfileDark,
  ],
}

export function preloadPageScenery(theme) {
  if (typeof Image === 'undefined') return Promise.resolve([])
  const sources = sceneryByTheme[theme === 'light' ? 'light' : 'dark']
  return Promise.all(sources.map(source => new Promise(resolve => {
    const image = new Image()
    image.onload = () => {
      const decoded = typeof image.decode === 'function' ? image.decode() : undefined
      Promise.resolve(decoded).catch(() => {}).then(resolve)
    }
    image.onerror = resolve
    image.src = source
  })))
}
