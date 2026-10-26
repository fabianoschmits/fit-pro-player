export function communityNotificationDetail(notification) {
  if (notification.type === 'like') return 'curtiu sua postagem.'
  if (notification.type === 'message') return Number(notification.message_count) === 1 ? 'enviou uma mensagem.' : `enviou ${notification.message_count} mensagens.`
  return 'comentou na sua postagem.'
}

export function communityNotificationTarget(notification) {
  return notification.type === 'message' ? `/community/messages/${notification.actor_id}` : `/community?post=${notification.post_id}`
}
