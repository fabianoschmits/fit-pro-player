export default function EmptyState({ title, description, action }) {
  return <div className="professional-empty"><h3>{title}</h3>{description && <p>{description}</p>}{action}</div>
}
