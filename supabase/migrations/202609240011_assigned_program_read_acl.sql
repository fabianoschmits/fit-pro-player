create policy programs_assigned_student_read on public.programs for select to authenticated
  using (exists (select 1 from public.program_assignments a where a.program_id = programs.id and a.student_user_id = auth.uid() and a.status = 'active'));

create policy versions_assigned_student_read on public.program_versions for select to authenticated
  using (exists (select 1 from public.program_assignments a where a.version_id = program_versions.id and a.student_user_id = auth.uid() and a.status = 'active'));
