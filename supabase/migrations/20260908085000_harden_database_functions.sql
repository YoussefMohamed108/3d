-- Pin function resolution and close direct execution of internal helpers.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.normalize_voucher_code()
returns trigger language plpgsql set search_path = '' as $$
begin new.code := upper(trim(new.code)); return new; end;
$$;

create or replace function public.products_sizes_are_valid(sizes jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(bool_and(
    (elem ->> 'name') is not null
    and length(trim(elem ->> 'name')) between 1 and 80
    and (elem ->> 'price') is not null
    and (elem ->> 'price')::numeric > 0
  ), true)
  from jsonb_array_elements(sizes) as elem;
$$;

create or replace function public.prevent_role_self_escalation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then new.role := old.role; end if;
  return new;
end;
$$;

create or replace function public.cleanup_rate_limit_hits()
returns void language sql security definer set search_path = '' as $$
  delete from public.rate_limit_hits where hit_at < now() - interval '1 day';
$$;

create or replace function public.check_rate_limit(p_bucket text, p_key text, p_max_hits integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if p_bucket is null or length(p_bucket) not between 1 and 40
     or p_key is null or length(p_key) not between 1 and 160
     or p_max_hits not between 1 and 1000
     or p_window_seconds not between 1 and 86400 then
    raise exception 'invalid rate-limit parameters';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_bucket || ':' || p_key, 0));
  select count(*) into v_count from public.rate_limit_hits
    where bucket = p_bucket and key = p_key
      and hit_at > now() - make_interval(secs => p_window_seconds);
  if v_count >= p_max_hits then return false; end if;
  insert into public.rate_limit_hits (bucket, key) values (p_bucket, p_key);
  if random() < 0.005 then perform public.cleanup_rate_limit_hits(); end if;
  return true;
end;
$$;

create or replace function public.validate_voucher(p_code text)
returns table(code text, discount_type text, discount_value numeric, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select v.code::text, v.discount_type::text, v.discount_value::numeric, v.expires_at::timestamptz
  from public.vouchers v
  where p_code is not null and length(p_code) between 1 and 64
    and upper(v.code) = upper(trim(p_code)) and v.active = true
    and (v.expires_at is null or v.expires_at > now())
  limit 1;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.normalize_voucher_code() from public, anon, authenticated;
revoke all on function public.products_sizes_are_valid(jsonb) from public, anon, authenticated;
revoke all on function public.prevent_role_self_escalation() from public, anon, authenticated;
revoke all on function public.cleanup_rate_limit_hits() from public, anon, authenticated;
revoke all on function public.check_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.cleanup_rate_limit_hits() to service_role;
grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated, service_role;
revoke all on function public.validate_voucher(text) from public, anon, authenticated;
grant execute on function public.validate_voucher(text) to anon, authenticated, service_role;

