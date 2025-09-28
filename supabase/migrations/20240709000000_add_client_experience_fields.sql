DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_kind') THEN
    CREATE TYPE appointment_kind AS ENUM ('aplicacao', 'reaplicacao', 'manutencao');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_tecnica') THEN
    CREATE TYPE appointment_tecnica AS ENUM ('volume_russo', 'volume_brasileiro', 'fox_eyes');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_densidade') THEN
    CREATE TYPE appointment_densidade AS ENUM ('natural', 'intermediario', 'cheio');
  END IF;
END
$$;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS tipo appointment_kind,
  ADD COLUMN IF NOT EXISTS tecnica appointment_tecnica,
  ADD COLUMN IF NOT EXISTS densidade appointment_densidade,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS preco_total numeric(10, 2),
  ADD COLUMN IF NOT EXISTS valor_sinal numeric(10, 2),
  ADD COLUMN IF NOT EXISTS cliente_id uuid GENERATED ALWAYS AS (customer_id) STORED;

UPDATE appointments
SET scheduled_at = COALESCE(scheduled_at, starts_at)
WHERE scheduled_at IS NULL AND starts_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS appointments_scheduled_at_idx ON appointments (scheduled_at);

CREATE OR REPLACE FUNCTION appointments_set_scheduled_at()
RETURNS trigger AS $$
BEGIN
  IF NEW.scheduled_at IS NULL THEN
    NEW.scheduled_at := NEW.starts_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appointments_set_scheduled_at ON appointments;
CREATE TRIGGER trg_appointments_set_scheduled_at
BEFORE INSERT OR UPDATE OF starts_at, scheduled_at ON appointments
FOR EACH ROW
EXECUTE FUNCTION appointments_set_scheduled_at();
