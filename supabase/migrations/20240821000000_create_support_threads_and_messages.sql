-- Support threads and messages
CREATE TABLE IF NOT EXISTS public.support_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'escalated')),
  last_message_preview text,
  last_actor text CHECK (last_actor IN ('user', 'staff', 'assistant')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_threads_user_id_idx ON public.support_threads(user_id);
CREATE INDEX IF NOT EXISTS support_threads_status_created_at_idx ON public.support_threads(status, created_at);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('user', 'staff', 'assistant')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_messages_thread_id_created_at_idx ON public.support_messages(thread_id, created_at);

-- row level security
ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support_threads' AND policyname = 'support_threads_select'
  ) THEN
    CREATE POLICY support_threads_select
      ON public.support_threads
      FOR SELECT
      USING (user_id = auth.uid() OR is_admin(auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support_threads' AND policyname = 'support_threads_insert'
  ) THEN
    CREATE POLICY support_threads_insert
      ON public.support_threads
      FOR INSERT
      WITH CHECK (user_id = auth.uid() OR is_admin(auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support_threads' AND policyname = 'support_threads_update'
  ) THEN
    CREATE POLICY support_threads_update
      ON public.support_threads
      FOR UPDATE
      USING (user_id = auth.uid() OR is_admin(auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support_messages' AND policyname = 'support_messages_select'
  ) THEN
    CREATE POLICY support_messages_select
      ON public.support_messages
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.support_threads t
          WHERE t.id = thread_id AND (t.user_id = auth.uid() OR is_admin(auth.uid()))
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support_messages' AND policyname = 'support_messages_insert'
  ) THEN
    CREATE POLICY support_messages_insert
      ON public.support_messages
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.support_threads t
          WHERE t.id = thread_id AND (t.user_id = auth.uid() OR is_admin(auth.uid()))
        )
      );
  END IF;
END
$$;
