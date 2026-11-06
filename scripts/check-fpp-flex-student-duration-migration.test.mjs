import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = name => fs.readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
test('student duration projection preserves every existing authorization and privacy guard', () => {
  const previous = read('202611020008_plan_selection_notifications.sql')
  const current = read('202611060003_fpp_flex_student_duration.sql')
  const rpc = source => source.slice(source.indexOf('create or replace function public.professional_client_detail'))
  assert.equal(rpc(current), rpc(previous).replace("'experience', source.profile->'experience')", "'experience', source.profile->'experience', 'preferredWorkoutMinutes', source.profile->'preferredWorkoutMinutes')"))
  assert.match(current, /r\.professional_user_id = auth\.uid\(\)/)
  assert.match(current, /r\.student_user_id = p_student_user_id/)
  assert.match(current, /r\.status = 'active'/)
  assert.match(current, /^begin;$/m)
  assert.doesNotMatch(current, /grant select|create policy|create table|drop function/i)
})
