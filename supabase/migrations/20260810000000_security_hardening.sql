-- PrintX security boundary hardening.
-- Apply with the Supabase CLI after reviewing against the production schema.

begin;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.validate_voucher(p_code text)
returns table(code text, discount_type text, discount_value numeric, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select v.code::text, v.discount_type::text, v.discount_value::numeric, v.expires_at::timestamptz
  from public.vouchers v
  where upper(v.code) = upper(trim(p_code))
    and v.active = true
    and (v.expires_at is null or v.expires_at > now())
  limit 1;
$$;

revoke all on function public.validate_voucher(text) from public;
grant execute on function public.validate_voucher(text) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.settings enable row level security;
alter table public.orders enable row level security;
alter table public.custom_requests enable row level security;
alter table public.vouchers enable row level security;
alter table public.categories enable row level security;
alter table public.hero_slides enable row level security;

-- Profiles: users may read their own record; only admins may see other profiles.
drop policy if exists printx_profiles_read on public.profiles;
create policy printx_profiles_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists printx_profiles_admin_write_guard on public.profiles;
create policy printx_profiles_admin_write_guard on public.profiles
  as restrictive for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Prevent normal users from changing the role column through PostgREST.
revoke update on public.profiles from authenticated;
grant update (username) on public.profiles to authenticated;

-- Storefront catalog is public, but hidden products must stay private.
drop policy if exists printx_products_public_read on public.products;
create policy printx_products_public_read on public.products
  for select to anon, authenticated
  using (coalesce(hidden, false) = false or public.is_admin());
drop policy if exists printx_products_admin_access on public.products;
create policy printx_products_admin_access on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists printx_products_admin_insert_guard on public.products;
create policy printx_products_admin_insert_guard on public.products
  as restrictive for insert to authenticated with check (public.is_admin());
drop policy if exists printx_products_admin_update_guard on public.products;
create policy printx_products_admin_update_guard on public.products
  as restrictive for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists printx_products_admin_delete_guard on public.products;
create policy printx_products_admin_delete_guard on public.products
  as restrictive for delete to authenticated using (public.is_admin());

-- Only customer-facing phone and delivery settings are publicly readable.
drop policy if exists printx_settings_public_read on public.settings;
create policy printx_settings_public_read on public.settings
  for select to anon, authenticated
  using (key like 'phone_%' or key like 'delivery_%' or public.is_admin());
drop policy if exists printx_settings_admin_access on public.settings;
create policy printx_settings_admin_access on public.settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists printx_settings_admin_insert_guard on public.settings;
create policy printx_settings_admin_insert_guard on public.settings
  as restrictive for insert to authenticated with check (public.is_admin());
drop policy if exists printx_settings_admin_update_guard on public.settings;
create policy printx_settings_admin_update_guard on public.settings
  as restrictive for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists printx_settings_admin_delete_guard on public.settings;
create policy printx_settings_admin_delete_guard on public.settings
  as restrictive for delete to authenticated using (public.is_admin());

-- Orders are created by the create-order Edge Function and otherwise admin-only.
revoke insert on public.orders from anon, authenticated;
drop policy if exists printx_orders_admin_access on public.orders;
create policy printx_orders_admin_access on public.orders
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
drop policy if exists printx_orders_read_guard on public.orders;
create policy printx_orders_read_guard on public.orders as restrictive for select to authenticated using (public.is_admin());
drop policy if exists printx_orders_update_guard on public.orders;
create policy printx_orders_update_guard on public.orders as restrictive for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists printx_orders_delete_guard on public.orders;
create policy printx_orders_delete_guard on public.orders as restrictive for delete to authenticated using (public.is_admin());

-- Public commission submissions are constrained; only admins may read or change them.
drop policy if exists printx_custom_requests_submit on public.custom_requests;
create policy printx_custom_requests_submit on public.custom_requests
  for insert to anon, authenticated
  with check (
    status = 'pending'
    and char_length(name) between 2 and 80
    and char_length(email) between 5 and 160
    and char_length(phone) between 10 and 24
    and char_length(description) between 20 and 2400
  );

drop policy if exists printx_custom_requests_admin_access on public.custom_requests;
create policy printx_custom_requests_admin_access on public.custom_requests
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
drop policy if exists printx_custom_requests_read_guard on public.custom_requests;
create policy printx_custom_requests_read_guard on public.custom_requests as restrictive for select to authenticated using (public.is_admin());
drop policy if exists printx_custom_requests_update_guard on public.custom_requests;
create policy printx_custom_requests_update_guard on public.custom_requests as restrictive for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists printx_custom_requests_delete_guard on public.custom_requests;
create policy printx_custom_requests_delete_guard on public.custom_requests as restrictive for delete to authenticated using (public.is_admin());

-- Voucher rows are never enumerable by anonymous visitors. They use the RPC above.
revoke select on public.vouchers from anon;
drop policy if exists printx_vouchers_admin_access on public.vouchers;
create policy printx_vouchers_admin_access on public.vouchers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
drop policy if exists printx_vouchers_read_guard on public.vouchers;
create policy printx_vouchers_read_guard on public.vouchers as restrictive for select to authenticated using (public.is_admin());
drop policy if exists printx_vouchers_insert_guard on public.vouchers;
create policy printx_vouchers_insert_guard on public.vouchers as restrictive for insert to authenticated with check (public.is_admin());
drop policy if exists printx_vouchers_update_guard on public.vouchers;
create policy printx_vouchers_update_guard on public.vouchers as restrictive for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists printx_vouchers_delete_guard on public.vouchers;
create policy printx_vouchers_delete_guard on public.vouchers as restrictive for delete to authenticated using (public.is_admin());

drop policy if exists printx_categories_public_read on public.categories;
create policy printx_categories_public_read on public.categories
  for select to anon, authenticated using (true);
drop policy if exists printx_categories_admin_access on public.categories;
create policy printx_categories_admin_access on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists printx_categories_admin_insert_guard on public.categories;
create policy printx_categories_admin_insert_guard on public.categories as restrictive for insert to authenticated with check (public.is_admin());
drop policy if exists printx_categories_admin_update_guard on public.categories;
create policy printx_categories_admin_update_guard on public.categories as restrictive for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists printx_categories_admin_delete_guard on public.categories;
create policy printx_categories_admin_delete_guard on public.categories as restrictive for delete to authenticated using (public.is_admin());

drop policy if exists printx_hero_slides_public_read on public.hero_slides;
create policy printx_hero_slides_public_read on public.hero_slides
  for select to anon, authenticated using (true);
drop policy if exists printx_hero_slides_admin_access on public.hero_slides;
create policy printx_hero_slides_admin_access on public.hero_slides
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists printx_hero_slides_admin_insert_guard on public.hero_slides;
create policy printx_hero_slides_admin_insert_guard on public.hero_slides as restrictive for insert to authenticated with check (public.is_admin());
drop policy if exists printx_hero_slides_admin_update_guard on public.hero_slides;
create policy printx_hero_slides_admin_update_guard on public.hero_slides as restrictive for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists printx_hero_slides_admin_delete_guard on public.hero_slides;
create policy printx_hero_slides_admin_delete_guard on public.hero_slides as restrictive for delete to authenticated using (public.is_admin());

-- Product images are public to view and admin-only to modify.
drop policy if exists printx_product_images_public_read on storage.objects;
create policy printx_product_images_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists printx_product_images_admin_write on storage.objects;
create policy printx_product_images_admin_write on storage.objects
  for all to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

commit;
