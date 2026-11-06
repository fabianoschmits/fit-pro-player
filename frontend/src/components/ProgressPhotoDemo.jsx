import { lazy, Suspense } from 'react'
import { progressPhotoDemo } from '../lib/progress-photo-demo.js'
import { FppActionFeedback } from './FppFeedback.jsx'

const Compare = lazy(() => import('./ProgressPhotoCompare.jsx'))

export default function ProgressPhotoDemo({ body, children = undefined }) {
  const example = progressPhotoDemo(body)
  return <section className="bp-photo-demo" aria-label="Exemplo ilustrativo de comparação">
    <p className="bp-photo-demo-caption" role="note">Demonstração · {example.label}</p>
    <Suspense fallback={<FppActionFeedback state="loading">Carregando demonstração…</FppActionFeedback>}>
      <Compare key={example.before.id} before={example.before} after={example.after} beforeURL={example.beforeURL} afterURL={example.afterURL} controls={false}>{children}</Compare>
    </Suspense>
  </section>
}
