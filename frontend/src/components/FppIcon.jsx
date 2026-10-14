import push from '../assets/icons/fpp/workouts/workout-push.svg?raw'
import pull from '../assets/icons/fpp/workouts/workout-pull.svg?raw'
import legs from '../assets/icons/fpp/workouts/workout-legs.svg?raw'
const SOURCES = { 'workout-push': push, 'workout-pull': pull, 'workout-legs': legs }
export default function FppIcon({ name, size = '1em', className = '', title, 'aria-hidden': ariaHidden, ...props }) { const source = SOURCES[name]; if (!source) throw new Error(`Unknown FPP icon: ${name}`); return <span className={`fpp-icon ${className}`.trim()} style={{ width: size, height: size, display: 'inline-block', ...props.style }} role={title ? 'img' : undefined} aria-label={title} aria-hidden={ariaHidden ?? (title ? undefined : true)} dangerouslySetInnerHTML={{ __html: source.replace('<svg ', '<svg width="100%" height="100%" ') }} /> }
