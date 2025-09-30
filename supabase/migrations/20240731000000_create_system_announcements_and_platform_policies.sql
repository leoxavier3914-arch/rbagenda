DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'system_announcements'
  ) THEN
    CREATE TABLE public.system_announcements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text,
      message text,
      audience text,
      status text,
      publish_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'platform_policies'
  ) THEN
    CREATE TABLE public.platform_policies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text UNIQUE NOT NULL,
      value jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_platform_policies_updated_at ON public.platform_policies;
CREATE TRIGGER trg_platform_policies_updated_at
BEFORE UPDATE ON public.platform_policies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_policies ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS system_announcements_adminmaster_rw ON public.system_announcements;
CREATE POLICY system_announcements_adminmaster_rw
  ON public.system_announcements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'adminmaster'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'adminmaster'
    )
  );


DROP POLICY IF EXISTS platform_policies_adminmaster_rw ON public.platform_policies;
CREATE POLICY platform_policies_adminmaster_rw
  ON public.platform_policies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'adminmaster'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'adminmaster'
    )
  );

INSERT INTO public.platform_policies (name, value)
VALUES
  ('booking_rules', '{}'::jsonb),
  ('integrations', '{}'::jsonb)
ON CONFLICT (name) DO NOTHING;
