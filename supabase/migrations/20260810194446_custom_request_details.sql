-- Store commission preferences as queryable fields instead of embedding them
-- in the free-form description. Columns stay nullable for legacy records.
alter table public.custom_requests
  add column if not exists preferred_size text,
  add column if not exists budget_range text,
  add column if not exists desired_deadline date;

comment on column public.custom_requests.preferred_size is
  'Customer-selected figure size; Not sure is an accepted value.';
comment on column public.custom_requests.budget_range is
  'Customer-selected EGP budget bracket; Not sure is an accepted value.';
comment on column public.custom_requests.desired_deadline is
  'Optional requested completion date; not a guaranteed delivery date.';

-- Recreate the public submission policy so crafted browser requests cannot
-- bypass the form choices or send unbounded values into the new columns.
drop policy if exists printx_custom_requests_submit on public.custom_requests;
create policy printx_custom_requests_submit on public.custom_requests
  for insert to anon, authenticated
  with check (
    status = 'pending'
    and char_length(name) between 2 and 80
    and char_length(email) between 5 and 160
    and char_length(phone) between 10 and 24
    and char_length(description) between 20 and 2400
    and char_length(figure_type) between 1 and 80
    and preferred_size in ('Not sure', '75mm', '100mm', '120mm', '150mm XL')
    and budget_range in (
      'Not sure',
      'Under EGP 1,000',
      'EGP 1,000-2,500',
      'EGP 2,500-5,000',
      'EGP 5,000+'
    )
    and (
      desired_deadline is null
      or desired_deadline between current_date and (current_date + 730)
    )
  );
