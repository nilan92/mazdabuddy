-- Migration: record deletions in the audit log
-- Applied 2026-08-11.
--
-- logAudit() is called from the browser and only for job status changes, so
-- deletions were invisible. Worse, customers -> vehicles -> job_cards cascade,
-- so removing one customer silently destroys their vehicles, every job card and
-- every invoice — and a cascade never runs client code, so nothing could have
-- logged it from the frontend even if we added a call.
--
-- A trigger is the only place that sees all of it: direct deletes, cascades,
-- RPCs and SQL alike.

create or replace function audit_deleted_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_label text;
begin
  -- tenant_id is on most of these tables; fall back to the caller's own.
  begin
    v_tenant := (to_jsonb(old) ->> 'tenant_id')::uuid;
  exception when others then
    v_tenant := null;
  end;
  v_tenant := coalesce(v_tenant, get_my_tenant());
  if v_tenant is null then
    return old;  -- nothing sensible to attribute it to
  end if;

  v_label := coalesce(
    to_jsonb(old) ->> 'name',
    to_jsonb(old) ->> 'description',
    to_jsonb(old) ->> 'license_plate',
    to_jsonb(old) ->> 'full_name',
    ''
  );

  insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, meta)
  values (
    v_tenant,
    auth.uid(),
    'deleted',
    tg_table_name,
    (to_jsonb(old) ->> 'id')::uuid,
    jsonb_build_object(
      'label', v_label,
      'row', to_jsonb(old)   -- the whole row, so a mistaken delete can be reconstructed
    )
  );
  return old;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['customers','vehicles','job_cards','invoices','parts',
                           'job_parts','job_labor','user_expenses','staff']
  loop
    execute format('drop trigger if exists %I on %I', 'audit_delete_' || t, t);
    execute format(
      'create trigger %I after delete on %I for each row execute function audit_deleted_row()',
      'audit_delete_' || t, t);
  end loop;
end $$;
