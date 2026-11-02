export const COMMUNITY_REASON_LABELS = {
  spam: 'Spam', harassment: 'Assédio ou discurso de ódio', inappropriate: 'Conteúdo impróprio',
  misinformation: 'Informação enganosa', abusive: 'Comportamento abusivo', repeated: 'Violações repetidas', other: 'Outro',
}
export const COMMUNITY_DURATION_OPTIONS = [
  ['24h', '24 horas'], ['3d', '3 dias'], ['7d', '7 dias'], ['30d', '30 dias'], ['permanent', 'Permanente'],
]
export const COMMUNITY_STATUS_LABELS = { active: 'Ativos', temporary: 'Temporários', permanent: 'Permanentes', expired: 'Expirados', revoked: 'Revogados', all: 'Todo o histórico' }

export function createCommunityModerationRepository(client) {
  const rpc = async (name, args = {}) => {
    if (!client?.rpc) throw new Error('Serviço indisponível.')
    const { data, error } = await client.rpc(name, args)
    if (error) throw error
    return data
  }
  return {
    status: userId => rpc('ops_community_restriction_status', { p_user_id: userId }),
    list: ({ status = 'active', duration = 'all', search = '', offset = 0, limit = 30 } = {}) => rpc('ops_community_restrictions', { p_status: status, p_duration: duration, p_search: search, p_offset: offset, p_limit: limit }),
    restrict: ({ userId, duration, reason, adminMessage = '', sourceTicketId = null }) => rpc('ops_community_restrict_user', { p_user_id: userId, p_duration: duration, p_reason: reason, p_admin_message: adminMessage.trim(), p_source_ticket_id: sourceTicketId }),
    unrestrict: ({ userId, reason, sourceTicketId = null }) => rpc('ops_community_unrestrict_user', { p_user_id: userId, p_reason: reason.trim(), p_source_ticket_id: sourceTicketId }),
    accessStatus: () => rpc('community_access_status'),
    acknowledge: id => rpc('community_acknowledge_restriction', { p_id: id }),
  }
}
