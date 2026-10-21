const mapCategory = row => row ? ({ slug: row.slug, label: row.label || '', description: row.description || '', sortOrder: Number(row.sort_order || 0) }) : null
const mapFaq = row => row ? ({ articleId: row.article_id, categoryId: row.category_id || null, categorySlug: row.category_slug, categoryLabel: row.category_label || '', question: row.question || '', answer: row.answer || '', sortOrder: Number(row.sort_order || 0), isFeatured: Boolean(row.is_featured), isPublished: Boolean(row.is_published), updatedAt: row.updated_at || null }) : null
const mapTicket = row => row ? ({ ticketId: row.ticket_id, userId: row.user_id || null, email: row.email || '', displayName: row.display_name || '', subject: row.subject || '', categorySlug: row.category_slug || '', categoryLabel: row.category_label || '', status: row.status || 'pending', priority: row.priority || 'normal', assignedAdminId: row.assigned_admin_id || null, lastMessageAt: row.last_message_at || null, firstResponseAt: row.first_response_at || null, createdAt: row.created_at || null, messages: row.messages || [], events: row.events || [] }) : null

export function createSupportRepository({ client } = {}) {
  const rpc = async (name, args = {}) => {
    if (!client?.rpc) throw new Error('supabase-unavailable')
    const { data, error } = await client.rpc(name, args)
    if (error) throw error
    return data
  }
  const rows = value => Array.isArray(value) ? value : value ? [value] : []
  const listCategories = () => rpc('support_list_categories').then(rows).then(items => items.map(mapCategory))
  const listFaq = ({ query = '', category = null } = {}) => rpc('support_list_faq', { p_query: query || null, p_category: category || null }).then(rows).then(items => items.map(mapFaq))
  const createTicket = ({ categorySlug, subject, body }) => rpc('support_create_ticket', { p_category_slug: categorySlug, p_subject: subject, p_body: body })
  const listMyTickets = ({ status = null, limit = 50, offset = 0 } = {}) => rpc('support_list_my_tickets', { p_status: status, p_limit: limit, p_offset: offset }).then(rows).then(items => items.map(mapTicket))
  const ticketDetail = ticketId => rpc('support_ticket_detail', { p_ticket_id: ticketId }).then(value => ({ ...(value?.ticket ? mapTicket({ ...value.ticket, ticket_id: value.ticket.id, category_slug: value.category?.slug, category_label: value.category?.label, messages: value.messages }) : {}), messages: value?.messages || [] }))
  const addUserMessage = (ticketId, body) => rpc('support_add_user_message', { p_ticket_id: ticketId, p_body: body })
  const overview = () => rpc('ops_support_overview').then(value => value?.[0] || value || {}).then(row => ({ unreadCount: Number(row.unread_count || 0), pendingCount: Number(row.pending_count || 0), answeredCount: Number(row.answered_count || 0), resolvedCount: Number(row.resolved_count || 0), archivedCount: Number(row.archived_count || 0) }))
  const listTickets = (filters = {}) => rpc('ops_support_list_tickets', { p_query: filters.query || null, p_status: filters.status || null, p_category: filters.category || null, p_priority: filters.priority || null, p_assigned_admin_id: filters.assignedAdminId || null, p_from_date: filters.fromDate || null, p_to_date: filters.toDate || null, p_limit: filters.limit || 50, p_offset: filters.offset || 0 }).then(rows).then(items => items.map(mapTicket))
  const adminTicketDetail = ticketId => rpc('ops_support_ticket_detail', { p_ticket_id: ticketId }).then(value => ({ ...(value?.ticket ? mapTicket({ ...value.ticket, ticket_id: value.ticket.id, category_slug: value.category?.slug, category_label: value.category?.label, messages: value.messages, events: value.events }) : {}), messages: value?.messages || [], events: value?.events || [] }))
  const reply = (ticketId, body) => rpc('ops_support_reply', { p_ticket_id: ticketId, p_body: body })
  const updateTicket = (ticketId, { status = null, priority = null, assignedAdminId = null } = {}) => rpc('ops_support_update_ticket', { p_ticket_id: ticketId, p_status: status, p_priority: priority, p_assigned_admin_id: assignedAdminId })
  const markRead = ticketId => rpc('ops_support_mark_read', { p_ticket_id: ticketId })
  const listFaqAdmin = () => rpc('ops_support_list_faq').then(rows).then(items => items.map(mapFaq))
  const saveFaqArticle = ({ articleId = null, categorySlug, question, answer, sortOrder = 0, isFeatured = false, isPublished = false }) => rpc('ops_support_save_faq', { p_article_id: articleId, p_category_slug: categorySlug, p_question: question, p_answer: answer, p_sort_order: sortOrder, p_is_featured: isFeatured, p_is_published: isPublished })
  const deleteTicket = ticketId => rpc('ops_support_delete_ticket', { p_ticket_id: ticketId })
  return Object.freeze({ listCategories, listFaq, createTicket, listMyTickets, ticketDetail, addUserMessage, overview, listTickets, adminTicketDetail, reply, updateTicket, markRead, deleteTicket, listFaqAdmin, saveFaqArticle, deleteFaqArticle })
}
