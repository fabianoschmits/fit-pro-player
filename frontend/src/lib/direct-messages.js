export function createMessageRepository(client) {
  const rpc = async (name, args = {}) => {
    if (!client?.rpc) throw new Error('Mensagens indisponíveis. Tente novamente.')
    const { data, error } = await client.rpc(name, args)
    if (error) throw error
    return data
  }
  return {
    inbox: (offset = 0, query = '') => rpc('community_message_inbox', { p_offset: offset, p_query: query }),
    history: (peer, before = null) => rpc('community_message_history', { p_peer: peer, p_before: before }),
    unread: () => rpc('community_message_unread_count'),
    read: (peer, through) => rpc('community_read_messages', { p_peer: peer, p_through: through }),
    async send(peer, body, nonce) {
      const trimmed = body.trim()
      if (!trimmed || trimmed.length > 3000) throw new Error('A mensagem deve ter entre 1 e 3000 caracteres.')
      return rpc('community_send_message', { p_peer: peer, p_body: trimmed, p_nonce: nonce })
    },
  }
}

export function mergeMessages(previous, incoming) {
  const rows = new Map(previous.map(row => [row.id, row]))
  incoming.forEach(row => rows.set(row.id, row))
  return [...rows.values()].sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0)
}
