
-- 1. Status enum
CREATE TYPE public.user_status AS ENUM ('pending','approved','rejected');

-- 2. Profile status columns
ALTER TABLE public.profiles
  ADD COLUMN status public.user_status NOT NULL DEFAULT 'pending',
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN rejection_reason text;

-- 3. Seed: any existing user becomes admin + approved (first admin)
UPDATE public.profiles SET status = 'approved', reviewed_at = now();
INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'admin'::app_role FROM public.profiles
  ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Replace handle_new_user: pending, no role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE user_count INT;
BEGIN
  SELECT count(*) INTO user_count FROM public.profiles;

  IF user_count = 0 THEN
    -- First user ever: bootstrap admin
    INSERT INTO public.profiles (id, full_name, email, status, reviewed_at)
    VALUES (NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
            NEW.email, 'approved', now());
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.profiles (id, full_name, email, status)
    VALUES (NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
            NEW.email, 'pending');
    -- Audit
    INSERT INTO public.audit_logs (actor, action, target_user, details)
    VALUES (NEW.id, 'user_registered', NEW.id,
            jsonb_build_object('email', NEW.email));
  END IF;
  RETURN NEW;
END; $$;

-- 5. Audit log
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_admin_read" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "audit_self_read" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (target_user = auth.uid() OR actor = auth.uid());

CREATE POLICY "audit_insert_auth" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_target ON public.audit_logs(target_user);

-- 6. Allow admins to update profile status
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
