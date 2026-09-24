-- Migration: Fix staff member creation and profile linking to prevent unique constraint violation on idx_staff_profile
-- Applied 2026-09-24

-- 1. Update ensure_staff_for_profile trigger function
CREATE OR REPLACE FUNCTION public.ensure_staff_for_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_unlinked_staff_id uuid;
begin
  if new.tenant_id is not null then
    -- Check if this profile is already linked to a staff record
    if not exists (select 1 from public.staff where profile_id = new.id) then
      -- Check if an unlinked staff record exists with matching name
      select id into v_unlinked_staff_id
        from public.staff
       where tenant_id = new.tenant_id
         and profile_id is null
         and lower(btrim(name)) = lower(btrim(new.full_name))
       order by created_at asc
       limit 1;

      if v_unlinked_staff_id is not null then
        update public.staff
           set profile_id = new.id,
               name = coalesce(nullif(btrim(new.full_name), ''), name),
               active = true
         where id = v_unlinked_staff_id;

        -- Sync past job cards assigned to this floor technician
        update public.job_cards
           set assigned_technician_id = new.id
         where assigned_staff_id = v_unlinked_staff_id
           and assigned_technician_id is null;
      else
        insert into public.staff (tenant_id, profile_id, name, active)
        values (
          new.tenant_id,
          new.id,
          coalesce(nullif(btrim(new.full_name), ''), 'New staff member'),
          true
        );
      end if;
    end if;
  end if;
  return new;
end;
$function$;

-- 2. Drop previous 5-argument create_staff_member to avoid overload collision
DROP FUNCTION IF EXISTS public.create_staff_member(text, text, text, text, text);

-- 3. Create updated 6-argument create_staff_member with optional p_staff_id
CREATE OR REPLACE FUNCTION public.create_staff_member(
  p_full_name text, 
  p_username text, 
  p_password text, 
  p_role text DEFAULT 'technician'::text, 
  p_email text DEFAULT NULL::text,
  p_staff_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
declare
  v_tenant_id uuid;
  v_user_id uuid;
  v_clean_username text;
  v_email text;
  v_encrypted_pw text;
  v_target_staff_id uuid;
begin
  if not is_admin() then
    raise exception 'Only an administrator can create staff accounts';
  end if;
  
  v_tenant_id := get_my_tenant_id();
  if v_tenant_id is null then
    raise exception 'You do not belong to a workshop';
  end if;

  if p_role not in ('admin', 'manager', 'technician', 'accountant') then
    raise exception 'Invalid role: %', p_role;
  end if;

  v_clean_username := lower(btrim(p_username));
  if length(v_clean_username) < 3 then
    raise exception 'Username must be at least 3 characters';
  end if;

  if length(p_password) < 4 then
    raise exception 'Password must be at least 4 characters';
  end if;

  if exists (select 1 from public.profiles where lower(username) = v_clean_username) then
    raise exception 'Username "%" is already taken. Please choose another username.', v_clean_username;
  end if;

  if p_email is not null and btrim(p_email) <> '' and p_email like '%@%' then
    v_email := lower(btrim(p_email));
  else
    v_email := v_clean_username || '@' || replace(v_tenant_id::text, '-', '') || '.autopulse.local';
  end if;

  if exists (select 1 from auth.users where lower(email) = v_email) then
    v_email := v_clean_username || '_' || substr(gen_random_uuid()::text, 1, 6) || '@' || replace(v_tenant_id::text, '-', '') || '.autopulse.local';
  end if;

  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));
  v_user_id := gen_random_uuid();

  -- Insert into auth.users with empty string tokens so GoTrue scanner never crashes
  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    phone_change,
    phone_change_token,
    email_change_token_current,
    reauthentication_token,
    email_change_confirm_status,
    raw_app_meta_data,
    raw_user_meta_data,
    role,
    aud,
    created_at,
    updated_at
  ) values (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    v_email,
    v_encrypted_pw,
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    0,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'username', v_clean_username),
    'authenticated',
    'authenticated',
    now(),
    now()
  );

  -- Insert email identity into auth.identities
  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', true
    ),
    'email',
    v_user_id::text,
    now(),
    now(),
    now()
  );

  -- Pre-locate unlinked staff row if explicitly specified or by matching name
  if p_staff_id is not null then
    select id into v_target_staff_id
      from public.staff
     where id = p_staff_id
       and tenant_id = v_tenant_id
       and profile_id is null;
  end if;

  if v_target_staff_id is null then
    select id into v_target_staff_id
      from public.staff
     where tenant_id = v_tenant_id
       and profile_id is null
       and lower(btrim(name)) = lower(btrim(p_full_name))
     order by created_at asc
     limit 1;
  end if;

  -- Link unlinked staff record to v_user_id BEFORE updating profiles (so trigger sees it)
  if v_target_staff_id is not null then
    update public.staff
       set profile_id = v_user_id,
           name = p_full_name,
           active = true
     where id = v_target_staff_id;

    -- Also link existing job cards assigned to this staff member
    update public.job_cards
       set assigned_technician_id = v_user_id
     where assigned_staff_id = v_target_staff_id
       and assigned_technician_id is null;
  end if;

  perform set_config('app.provisioning', 'on', true);

  -- Update profiles: tenant_id, username, full_name, role
  update public.profiles
     set tenant_id = v_tenant_id,
         username = v_clean_username,
         full_name = p_full_name,
         role = p_role
   where id = v_user_id;

  -- Ensure staff row has active = true and correct name
  update public.staff
     set name = p_full_name,
         active = true
   where tenant_id = v_tenant_id
     and profile_id = v_user_id;

  -- If still not in staff table, insert record
  if not exists (select 1 from public.staff where profile_id = v_user_id) then
    insert into public.staff (tenant_id, profile_id, name, active)
    values (v_tenant_id, v_user_id, p_full_name, true);
  end if;

  return jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'username', v_clean_username,
    'full_name', p_full_name,
    'role', p_role
  );
end;
$function$;

GRANT EXECUTE ON FUNCTION public.create_staff_member(text, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_staff_member(text, text, text, text, text, uuid) TO service_role;
