import { lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import BodyProgressNavigation from '../components/BodyProgressNavigation.jsx'
import Icon from '../components/Icon.jsx'
import { FppActionFeedback } from '../components/FppFeedback.jsx'

const ProgressPhotoGallery = lazy(() => import('../components/ProgressPhotoGallery.jsx'))

export default function ProgressPhotos() {
  const navigate = useNavigate()
  return <main className="body-progress-view bp-photo-editor-page page-scenery fpp-ui-view fpp-screen-body">
    <header className="bp-header">
      <button type="button" className="iconbtn" onClick={() => navigate('/progress')} aria-label="Voltar para evolução"><Icon name="chevronLeft" /></button>
      <div><h1>Fotografias de evolução</h1><p>Suas fotos e seus alinhamentos, somente para você.</p></div>
    </header>
    <BodyProgressNavigation current="photos" />
    <Suspense fallback={<FppActionFeedback state="loading">Carregando fotos…</FppActionFeedback>}><ProgressPhotoGallery mode="editor" /></Suspense>
  </main>
}
