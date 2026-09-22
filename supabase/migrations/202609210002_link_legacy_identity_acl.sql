-- Remove explicit default ACL grants from client roles without changing ownership.
revoke execute on function public.link_legacy_identity(text, uuid) from public, anon, authenticated;

grant execute on function public.link_legacy_identity(text, uuid) to service_role;
