-- Product inserts and updates evaluate products_sizes_valid under the caller's role.
-- This immutable SECURITY INVOKER helper only validates its JSON argument.
-- Restore validation access for signed-in admins; product writes still require is_admin() via RLS.
grant execute on function public.products_sizes_are_valid(jsonb) to authenticated;
-- Rollback: revoke execute on function public.products_sizes_are_valid(jsonb) from authenticated;
