import { Link } from 'react-router-dom'
import Home from '../../views/Home.jsx'
import Icon from '../../components/Icon.jsx'
import './home-glass.css'

// The experiment shares Home's content and actions, but owns its entire visual layer.
// The DOM marker also scopes the shared profile, navigation and portaled sheets.
export default function HomeGlass() {
  return <div className="home-glass-experiment">
    <nav className="home-glass-toolbar" aria-label="Teste da Home Glass">
      <Link to="/console/laboratory" aria-label="Voltar ao laboratório de testes"><Icon name="chevronLeft" /><span>Testes</span></Link>
      <span className="home-glass-label"><Icon name="sparkles" /><span>Home Glass<small>Design em teste</small></span></span>
      <Link to="/home" aria-label="Comparar com a home atual"><span>Home atual</span><Icon name="house" /></Link>
    </nav>
    <Home />
  </div>
}
