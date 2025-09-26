create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ensure custom enums exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
    CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'canceled', 'completed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('pending', 'approved', 'failed', 'refunded', 'partially_refunded');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_kind') THEN
    CREATE TYPE payment_kind AS ENUM ('deposit', 'balance', 'full');
  END IF;
END
$$;

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  role text NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin')),
  full_name text,
  email text,
  whatsapp text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_idx ON profiles (lower(email)) WHERE email IS NOT NULL;

-- branches / services / staff
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_min int NOT NULL CHECK (duration_min > 0),
  price_cents int NOT NULL CHECK (price_cents >= 0),
  deposit_cents int NOT NULL DEFAULT 0 CHECK (deposit_cents >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS services_branch_idx ON services(branch_id);

CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  color text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_branch_idx ON staff(branch_id);

-- hours and blackouts
CREATE TABLE IF NOT EXISTS business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  weekday int NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  open_time time NOT NULL,
  close_time time NOT NULL,
  UNIQUE (branch_id, weekday)
);

CREATE TABLE IF NOT EXISTS staff_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE,
  weekday int NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  UNIQUE (staff_id, weekday)
);

CREATE TABLE IF NOT EXISTS blackouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text
);

CREATE INDEX IF NOT EXISTS blackouts_staff_time_idx ON blackouts(staff_id, starts_at, ends_at);

-- appointments & payments
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES profiles(id) ON DELETE RESTRICT,
  staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  service_id uuid REFERENCES services(id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status appointment_status NOT NULL DEFAULT 'pending',
  total_cents int NOT NULL DEFAULT 0,
  deposit_cents int NOT NULL DEFAULT 0,
  paid_in_full boolean NOT NULL DEFAULT false,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, starts_at, ends_at)
);

CREATE INDEX IF NOT EXISTS appointments_customer_idx ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS appointments_staff_time_idx ON appointments(staff_id, starts_at);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_payment_id text,
  kind payment_kind NOT NULL,
  covers_deposit boolean NOT NULL DEFAULT false,
  status payment_status NOT NULL DEFAULT 'pending',
  amount_cents int NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'BRL',
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_payment_id)
);

CREATE INDEX IF NOT EXISTS payments_appt_idx ON payments(appointment_id);

CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  UNIQUE(provider, event_id)
);

-- reminders queue
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES appointments(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  to_address text NOT NULL,
  template text NOT NULL,
  message text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','error')),
  attempts int NOT NULL DEFAULT 0,
  last_error text
);

CREATE INDEX IF NOT EXISTS reminders_sched_idx ON reminders(scheduled_at) WHERE status = 'pending';

-- paid totals view
CREATE OR REPLACE VIEW appointment_payment_totals AS
SELECT
  a.id AS appointment_id,
  COALESCE(SUM(
    CASE
      WHEN p.status IN ('approved', 'partially_refunded') THEN p.amount_cents
      ELSE 0
    END
  ), 0) AS paid_cents
FROM appointments a
LEFT JOIN payments p ON p.appointment_id = a.id
GROUP BY a.id;

-- trigger to keep appointments.paid_in_full in sync
CREATE OR REPLACE FUNCTION sync_paid_full()
RETURNS trigger AS $$
BEGIN
  UPDATE appointments a
  SET paid_in_full = (
    SELECT t.paid_cents
    FROM appointment_payment_totals t
    WHERE t.appointment_id = a.id
  ) >= a.total_cents
  WHERE a.id = NEW.appointment_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payments_after_change ON payments;
CREATE TRIGGER trg_payments_after_change
AFTER INSERT OR UPDATE OF status, amount_cents ON payments
FOR EACH ROW EXECUTE FUNCTION sync_paid_full();

-- row level security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_admin(uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result boolean;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  SELECT EXISTS(
    SELECT 1
    FROM profiles
    WHERE id = uid
      AND role = 'admin'
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION is_admin(uuid) TO PUBLIC;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_self'
  ) THEN
    CREATE POLICY profiles_self ON profiles
    FOR SELECT
    USING (
      auth.uid() = id OR is_admin(auth.uid())
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_self_insert'
  ) THEN
    CREATE POLICY profiles_self_insert ON profiles
    FOR INSERT
    WITH CHECK (
      auth.uid() = id OR is_admin(auth.uid())
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointments'
      AND policyname = 'appt_select'
  ) THEN
    CREATE POLICY appt_select ON appointments
    FOR SELECT
    USING (
      customer_id = auth.uid() OR is_admin(auth.uid())
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointments'
      AND policyname = 'appt_insert'
  ) THEN
    CREATE POLICY appt_insert ON appointments
    FOR INSERT
    WITH CHECK (
      customer_id = auth.uid() OR is_admin(auth.uid())
    );
  END IF;
END $$;
