
-- Seed three demo accounts: admin, manager, staff
DO $$
DECLARE
  v_admin_id uuid := '00000000-0000-0000-0000-00000000a001';
  v_mgr_id   uuid := '00000000-0000-0000-0000-00000000a002';
  v_staff_id uuid := '00000000-0000-0000-0000-00000000a003';
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      (v_admin_id, 'admin@restaurant.com',   'Admin@123',   'System Admin',   'admin'::public.app_role),
      (v_mgr_id,   'manager@restaurant.com', 'Manager@123', 'Demo Manager',   'manager'::public.app_role),
      (v_staff_id, 'staff@restaurant.com',   'Staff@123',   'Demo Staff',     'staff'::public.app_role)
    ) AS t(uid, email, pwd, full_name, role)
  LOOP
    -- Insert auth user if it doesn't already exist
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = rec.email) THEN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change,
        email_change_token_new, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        rec.uid, 'authenticated', 'authenticated', rec.email,
        crypt(rec.pwd, gen_salt('bf')),
        now(),
        jsonb_build_object('provider','email','providers',ARRAY['email']),
        jsonb_build_object('full_name', rec.full_name),
        now(), now(), '', '', '', ''
      );

      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), rec.uid,
              jsonb_build_object('sub', rec.uid::text, 'email', rec.email),
              'email', rec.uid::text, now(), now(), now());
    END IF;

    -- Force profile to approved with correct name (trigger may have set pending)
    INSERT INTO public.profiles (id, full_name, email, status, reviewed_at)
    VALUES (rec.uid, rec.full_name, rec.email, 'approved'::public.user_status, now())
    ON CONFLICT (id) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          email = EXCLUDED.email,
          status = 'approved'::public.user_status,
          reviewed_at = COALESCE(public.profiles.reviewed_at, now());

    -- Ensure role assignment
    INSERT INTO public.user_roles (user_id, role)
    VALUES (rec.uid, rec.role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END LOOP;
END $$;
