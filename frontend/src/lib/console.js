const toOverview = row => row ? ({
  userCount: Number(row.user_count || 0),
  professionalCount: Number(row.professional_count || 0),
  pendingVerificationCount: Number(row.pending_verification_count || 0),
  suspendedCount: Number(row.suspended_count || 0),
  newUsers7d: Number(row.new_users_7d || 0),
  accountUserCount: Number(row.account_user_count || 0),
  localUserCount: Number(row.local_user_count || 0),
}) : null

const toUser = row => row ? ({
  userId: row.user_id,
  email: row.email || '',
  displayName: row.display_name || '',
  avatarRef: row.avatar_ref || null,
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
  suspendedAt: row.suspended_at || null,
  roles: row.roles || [],
  hasProfessionalProfile: Boolean(row.has_professional_profile),
  verificationStatus: row.verification_status || null,
  studentLinks: Number(row.student_links || 0),
  professionalLinks: Number(row.professional_links || 0),
  professionalName: row.professional_name || null,
  bio: row.bio || null,
  specialties: row.specialties || [],
  cityRegion: row.city_region || null,
  registrationType: row.registration_type || null,
  registrationNumber: row.registration_number || null,
  isAnonymous: Boolean(row.is_anonymous),
  accountKind: row.account_kind || (row.is_anonymous ? 'local' : 'account'),
}) : null

const toProfessional = row => row ? ({
  userId: row.user_id,
  email: row.email || '',
  displayName: row.display_name || '',
  professionalName: row.professional_name || '',
  cityRegion: row.city_region || null,
  verificationStatus: row.verification_status || 'unverified',
  specialties: row.specialties || [],
  registrationType: row.registration_type || null,
  registrationNumber: row.registration_number || null,
  createdAt: row.created_at || null,
  studentLinks: Number(row.student_links || 0),
  suspendedAt: row.suspended_at || null,
}) : null

export function createConsoleRepository({ client } = {}) {
  const rpc = async (name, args = {}) => {
    if (!client?.rpc) throw new Error('supabase-unavailable')
    const { data, error } = await client.rpc(name, args)
    if (error) throw error
    return data
  }
  const read = async (table, query) => {
    if (!client?.from) throw new Error('supabase-unavailable')
    const response = await query(client.from(table))
    if (response?.error) throw response.error
    return response.data || []
  }

  const adminRole = userId => read('user_roles', q => q.select('role').eq('user_id', userId))
    .then(rows => rows.some(row => row.role === 'admin'))

  const accountSuspended = userId => read('profiles', q => q.select('suspended_at').eq('id', userId).limit(1))
    .then(rows => Boolean(rows[0]?.suspended_at))

  const overview = () => rpc('ops_overview').then(rows => toOverview(rows?.[0] || rows))
  const advancedMetrics = () => rpc('ops_advanced_metrics').then(rows => rows?.[0] || rows || {})
  const listUsers = ({ query = '', accountKind = null, limit = 50, offset = 0 } = {}) => rpc('ops_list_users', {
    p_query: query || null,
    p_account_kind: accountKind || null,
    p_limit: limit,
    p_offset: offset,
  }).then(rows => (rows || []).map(toUser))
  const userDetail = userId => rpc('ops_user_detail', { p_user_id: userId }).then(rows => toUser(rows?.[0]))
  const listProfessionals = ({ query = '', status = null, limit = 50, offset = 0 } = {}) => rpc('ops_list_professionals', {
    p_query: query || null,
    p_status: status,
    p_limit: limit,
    p_offset: offset,
  }).then(rows => (rows || []).map(toProfessional))
  const setDisplayName = (userId, displayName) => rpc('ops_set_display_name', { p_user_id: userId, p_display_name: displayName })
  const setSuspended = (userId, suspended) => rpc('ops_set_suspended', { p_user_id: userId, p_suspended: suspended })
  const setProfessionalRole = (userId, enabled) => rpc('ops_set_professional_role', { p_user_id: userId, p_enabled: enabled })
  const setVerification = (userId, status) => rpc('ops_set_verification', { p_user_id: userId, p_status: status })
  const updateProfessionalProfile = (userId, payload) => rpc('ops_update_professional_profile', {
    p_user_id: userId,
    p_professional_name: payload.professionalName,
    p_bio: payload.bio ?? null,
    p_specialties: payload.specialties || [],
    p_city_region: payload.cityRegion ?? null,
    p_registration_type: payload.registrationType ?? null,
    p_registration_number: payload.registrationNumber ?? null,
  })
  const deleteUser = userId => rpc('ops_delete_user', { p_user_id: userId })
  const userTraining = userId => rpc('ops_user_training', { p_user_id: userId }).then(row => {
    const data = Array.isArray(row) ? row[0] : row
    if (!data || typeof data !== 'object') {
      return {
        hasSnapshot: false,
        profile: {},
        planMode: null,
        week: {},
        dayPlan: {},
        routines: [],
        workoutCount: 0,
        recentWorkouts: [],
        bodyweight: [],
        bodyMeasurements: [],
        snapshotUpdatedAt: null,
      }
    }
    return {
      hasSnapshot: Boolean(data.has_snapshot),
      profile: data.profile || {},
      planMode: data.plan_mode || null,
      week: data.week || {},
      dayPlan: data.day_plan || {},
      routines: data.routines || [],
      workoutCount: Number(data.workout_count || 0),
      recentWorkouts: data.recent_workouts || [],
      bodyweight: data.bodyweight || [],
      bodyMeasurements: data.body_measurements || [],
      snapshotUpdatedAt: data.snapshot_updated_at || null,
    }
  })

  return Object.freeze({
    adminRole,
    accountSuspended,
    overview,
    advancedMetrics,
    listUsers,
    userDetail,
    userTraining,
    listProfessionals,
    setDisplayName,
    setSuspended,
    setProfessionalRole,
    setVerification,
    updateProfessionalProfile,
    deleteUser,
  })
}

export const VERIFICATION_LABELS = {
  unverified: 'Não verificado',
  pending: 'Pendente',
  verified: 'Verificado',
  rejected: 'Rejeitado',
}

export const verificationTone = status => ({
  verified: 'success',
  pending: 'warning',
  rejected: 'error',
  unverified: 'neutral',
}[status] || 'neutral')
