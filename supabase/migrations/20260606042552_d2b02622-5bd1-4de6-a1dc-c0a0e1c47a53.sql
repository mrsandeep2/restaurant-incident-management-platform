
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'staff');
CREATE TYPE public.incident_category AS ENUM ('pos','delivery','inventory','kitchen','customer','staff','hygiene','safety','payment','other');
CREATE TYPE public.severity_level AS ENUM ('low','medium','high','critical');
CREATE TYPE public.incident_status AS ENUM ('open','under_review','in_progress','escalated','resolved','closed');

-- Updated-at helper
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_higher(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE POLICY "roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- STORES
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  location TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stores_select_all" ON public.stores FOR SELECT TO authenticated USING (true);
CREATE POLICY "stores_admin_manage" ON public.stores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- INCIDENTS
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category public.incident_category NOT NULL,
  severity public.severity_level NOT NULL,
  status public.incident_status NOT NULL DEFAULT 'open',
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reported_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_phone TEXT,
  contact_email TEXT,
  assigned_manager UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ai_summary TEXT,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX incidents_status_idx ON public.incidents(status);
CREATE INDEX incidents_severity_idx ON public.incidents(severity);
CREATE INDEX incidents_category_idx ON public.incidents(category);
CREATE INDEX incidents_reporter_idx ON public.incidents(reported_by);
CREATE INDEX incidents_store_idx ON public.incidents(store_id);
CREATE INDEX incidents_created_idx ON public.incidents(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incidents_select_authed" ON public.incidents FOR SELECT TO authenticated USING (
  reported_by = auth.uid()
  OR public.has_role(auth.uid(),'manager')
  OR public.has_role(auth.uid(),'admin')
);
CREATE POLICY "incidents_insert_self" ON public.incidents FOR INSERT TO authenticated WITH CHECK (reported_by = auth.uid());
CREATE POLICY "incidents_update_self_or_mgr" ON public.incidents FOR UPDATE TO authenticated USING (
  reported_by = auth.uid()
  OR public.has_role(auth.uid(),'manager')
  OR public.has_role(auth.uid(),'admin')
);
CREATE POLICY "incidents_delete_admin" ON public.incidents FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER incidents_updated_at BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ATTACHMENTS
CREATE TABLE public.incident_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  name TEXT,
  mime TEXT,
  size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.incident_attachments TO authenticated;
GRANT ALL ON public.incident_attachments TO service_role;
ALTER TABLE public.incident_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attachments_select" ON public.incident_attachments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.incidents i WHERE i.id = incident_id AND (
    i.reported_by = auth.uid() OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'admin')
  ))
);
CREATE POLICY "attachments_insert" ON public.incident_attachments FOR INSERT TO authenticated WITH CHECK (
  uploaded_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.incidents i WHERE i.id = incident_id AND (
      i.reported_by = auth.uid() OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'admin')
    )
  )
);
CREATE POLICY "attachments_delete" ON public.incident_attachments FOR DELETE TO authenticated USING (
  uploaded_by = auth.uid() OR public.has_role(auth.uid(),'admin')
);

-- EVENTS / TIMELINE
CREATE TABLE public.incident_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  actor UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  from_status public.incident_status,
  to_status public.incident_status,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX events_incident_idx ON public.incident_events(incident_id, created_at);
GRANT SELECT, INSERT ON public.incident_events TO authenticated;
GRANT ALL ON public.incident_events TO service_role;
ALTER TABLE public.incident_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select" ON public.incident_events FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.incidents i WHERE i.id = incident_id AND (
    i.reported_by = auth.uid() OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'admin')
  ))
);
CREATE POLICY "events_insert" ON public.incident_events FOR INSERT TO authenticated WITH CHECK (
  actor = auth.uid() AND EXISTS (
    SELECT 1 FROM public.incidents i WHERE i.id = incident_id AND (
      i.reported_by = auth.uid() OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'admin')
    )
  )
);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  incident_id UUID REFERENCES public.incidents(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notif_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifs_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifs_update_own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- AUTO PROFILE + ROLE on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.email);

  SELECT count(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- STATUS CHANGE -> event + notification to reporter
CREATE OR REPLACE FUNCTION public.log_status_change() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.incident_events (incident_id, actor, kind, from_status, to_status)
    VALUES (NEW.id, auth.uid(), 'status_change', OLD.status, NEW.status);

    IF NEW.reported_by IS NOT NULL AND NEW.reported_by <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notifications (user_id, type, title, body, incident_id)
      VALUES (NEW.reported_by, 'status_update',
        'Incident status updated', 'Your incident "'||NEW.title||'" is now '||NEW.status::text, NEW.id);
    END IF;

    IF NEW.status = 'resolved' AND NEW.resolved_at IS NULL THEN
      NEW.resolved_at = now();
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER incidents_status_change BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.log_status_change();
