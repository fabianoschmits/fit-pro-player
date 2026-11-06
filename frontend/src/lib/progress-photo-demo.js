import maleBefore from '../assets/progress-photo-demo/male-before.jpg'
import maleAfter from '../assets/progress-photo-demo/male-after.jpg'
import femaleBefore from '../assets/progress-photo-demo/female-before.jpg'
import femaleAfter from '../assets/progress-photo-demo/female-after.jpg'

// Bundled illustrations only. These descriptors never enter the photo repository,
// user history or synchronized account JSON. No pose model is loaded for demos.
const example = (id, width, height, alt) => ({ id, width, height, alt, date_label: 'Imagem de exemplo' })
const examples = {
  male: {
    label: 'modelo masculino',
    before: example('demo-male-before', 582, 1280, 'Modelo masculino ilustrativo antes'),
    after: example('demo-male-after', 574, 1280, 'Modelo masculino ilustrativo depois'),
    beforeURL: maleBefore, afterURL: maleAfter,
  },
  female: {
    label: 'modelo feminino',
    before: example('demo-female-before', 365, 1280, 'Modelo feminino ilustrativo antes'),
    after: example('demo-female-after', 365, 1280, 'Modelo feminino ilustrativo depois'),
    beforeURL: femaleBefore, afterURL: femaleAfter,
  },
}

export function progressPhotoDemo(body) {
  return examples[body === 'female' ? 'female' : 'male']
}
