-- Apply before deploying the updated create-order function. No existing orders are changed.
begin;
alter table public.orders add column if not exists request_key uuid;
alter table public.orders add column if not exists request_hash text;
create unique index if not exists orders_request_key_unique
  on public.orders(request_key) where request_key is not null;
comment on column public.orders.request_key is 'Random checkout retry identity; nullable for legacy callers.';
comment on column public.orders.request_hash is 'SHA-256 of submitted order fields; prevents key reuse with different details.';
commit;
