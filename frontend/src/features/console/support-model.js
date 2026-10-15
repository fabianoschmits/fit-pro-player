export const supportStatusLabel = { unread: 'Não lida', read: 'Lida', pending: 'Pendente', answered: 'Respondida', resolved: 'Resolvida', archived: 'Arquivada' }
export const supportPriorityLabel = { low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente' }
export function ticketTone(status) { return ({ unread: 'warn', pending: 'warn', answered: 'ok', resolved: 'ok' })[status] || 'neutral' }
