export function createConsoleNotificationRepository({ client } = {}) {
  const rpc = async (name, args) => {
    if (!client?.rpc) throw new Error('supabase-unavailable')
    const { data, error } = await client.rpc(name, args)
    if (error) throw error
    return data
  }
  return {
    list: ({ limit = 25, offset = 0 } = {}) => rpc('ops_list_notifications', { p_limit: limit, p_offset: offset }).then(data => ({
      items: (data?.items || []).map(item => ({ id: item.id, kind: item.kind, title: item.title, body: item.body, targetPath: item.target_path, createdAt: item.created_at, readAt: item.read_at })),
      unreadCount: Number(data?.unread_count || 0), hasMore: Boolean(data?.has_more),
    })),
    markRead: id => rpc('ops_mark_notifications_read', { p_notification_id: id }),
    deleteNotifications: ids => rpc('ops_delete_notifications', { p_notification_ids: Array.isArray(ids) ? ids : [ids] }),
  }
}
