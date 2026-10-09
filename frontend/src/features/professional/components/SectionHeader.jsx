export default function SectionHeader({ title, action }) {
  return <header className="professional-section-header"><h2>{title}</h2>{action && <div>{action}</div>}</header>
}
