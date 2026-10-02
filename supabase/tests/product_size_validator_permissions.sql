-- Run as postgres in the Supabase SQL editor or through a privileged database connection.
-- Uses an existing admin profile. All temporary product changes are rolled back.
begin;
do $$ begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub',(select id from public.profiles where role='admin' order by id limit 1),'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $test$
declare v_id uuid; v_count integer; v_constraint text;
begin
  if not public.is_admin() then raise exception 'Admin test identity missing'; end if;
  if not public.products_sizes_are_valid('[]'::jsonb)
    or not public.products_sizes_are_valid('[{"name":"Standard","price":1}]'::jsonb)
    or public.products_sizes_are_valid('[{"name":"Standard","price":0}]'::jsonb)
  then raise exception 'Validator behavior regression'; end if;
  insert into public.products(name,price,hidden,sizes)
    values ('PrintX permission regression test',1,true,'[{"name":"Standard","price":1}]'::jsonb)
    returning id into v_id;
  perform set_config('printx.test_product_id',v_id::text,true);
  update public.products set image_url='https://ik.imagekit.io/bxk734nq4h/test-only-not-uploaded.jpg',sizes='[]'::jsonb where id=v_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Admin product update failed'; end if;
  begin
    update public.products set sizes='[{"name":"Invalid","price":0}]'::jsonb where id=v_id;
    raise exception 'Invalid sizes unexpectedly allowed';
  exception when check_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint <> 'products_sizes_valid' then raise; end if;
  end;
end $test$;
reset role;
do $$ begin
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}',true);
end $$;
set local role authenticated;
do $test$
declare v_count integer;
begin
  if public.is_admin() then raise exception 'Non-admin unexpectedly authorized'; end if;
  begin
    insert into public.products(name,price,hidden,sizes) values ('Unauthorized regression test',1,true,'[]'::jsonb);
    raise exception 'Non-admin insert unexpectedly allowed';
  exception when insufficient_privilege then
    if position('row-level security' in sqlerrm)=0 then raise; end if;
  end;
  update public.products set price=2 where id=current_setting('printx.test_product_id')::uuid;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'Non-admin update unexpectedly allowed'; end if;
end $test$;
reset role;
select jsonb_build_object(
'admin_insert_and_update','passed',
'invalid_sizes_rejected','passed',
'non_admin_insert_and_update_blocked','passed',
'authenticated_execute',has_function_privilege('authenticated','public.products_sizes_are_valid(jsonb)','execute'),
'anon_execute',has_function_privilege('anon','public.products_sizes_are_valid(jsonb)','execute'),
'security_invoker',not (select prosecdef from pg_proc where oid='public.products_sizes_are_valid(jsonb)'::regprocedure)
) as verification;
rollback;
