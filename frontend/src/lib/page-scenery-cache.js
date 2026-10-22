import homeLight from '../assets/page-backgrounds/home-light.png'
import homeDark from '../assets/page-backgrounds/home-dark.png'
import planLight from '../assets/page-backgrounds/plan-light.png'
import planDark from '../assets/page-backgrounds/plan-dark.png'
import workoutLight from '../assets/page-backgrounds/workout-light.png'
import workoutDark from '../assets/page-backgrounds/workout-dark.png'
import historyLight from '../assets/page-backgrounds/library-light.png'
import historyDark from '../assets/page-backgrounds/library-dark.png'

const sceneryByTheme = {
  light: [homeLight, planLight, workoutLight, historyLight],
  dark: [homeDark, planDark, workoutDark, historyDark],
}

export function preloadPageScenery(theme) {
  const sources = sceneryByTheme[theme === 'light' ? 'light' : 'dark']
  return Promise.all(sources.map(source => new Promise(resolve => {
    const image = new Image()
    image.onload = resolve
    image.onerror = resolve
    image.src = source
  })))
}
