import { useNavigate } from 'react-router-dom'
import { Segmented } from './ui.jsx'
import '../body-progress.css'

const destinations = { comparison: '/progress', measurements: '/progress/body', photos: '/progress/photos' }

export default function BodyProgressNavigation({ current }) {
  const navigate = useNavigate()
  return <nav className="bp-section-navigation" aria-label="Evolução corporal">
    <Segmented value={current} onChange={value => { if (value !== current) navigate(destinations[value]) }} options={[
      { value: 'comparison', label: 'Comparação' },
      { value: 'measurements', label: 'Medidas' },
      { value: 'photos', label: 'Editar fotos' },
    ]} />
  </nav>
}
