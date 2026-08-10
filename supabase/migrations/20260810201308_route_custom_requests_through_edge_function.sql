-- Custom requests are validated and inserted by the create-custom-order Edge
-- Function with the service role. Prevent browsers from bypassing that path.
revoke insert on public.custom_requests from anon, authenticated;

drop policy if exists printx_custom_requests_submit on public.custom_requests;
