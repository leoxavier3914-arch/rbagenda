-- Ensure support admin listing works with RLS-aware joins

-- profiles: split policies so admin roles bypass user-only filters during joins
DROP POLICY IF EXISTS profiles_self ON public.profiles;
DROP POLICY IF EXISTS profiles_self_insert ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_access ON public.profiles;

CREATE POLICY profiles_self
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY profiles_admin_access
  ON public.profiles
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY profiles_self_insert
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));

-- support threads
DROP POLICY IF EXISTS support_threads_select ON public.support_threads;
DROP POLICY IF EXISTS support_threads_insert ON public.support_threads;
DROP POLICY IF EXISTS support_threads_update ON public.support_threads;

CREATE POLICY support_threads_select
  ON public.support_threads
  FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY support_threads_insert
  ON public.support_threads
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY support_threads_update
  ON public.support_threads
  FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- support messages (keeps thread-level enforcement for admins)
DROP POLICY IF EXISTS support_messages_select ON public.support_messages;
DROP POLICY IF EXISTS support_messages_insert ON public.support_messages;

CREATE POLICY support_messages_select
  ON public.support_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_threads t
      WHERE t.id = thread_id AND (t.user_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

CREATE POLICY support_messages_insert
  ON public.support_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_threads t
      WHERE t.id = thread_id AND (t.user_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );
