DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_types') THEN
    CREATE TABLE service_types (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
      name text NOT NULL,
      slug text UNIQUE,
      description text,
      active boolean NOT NULL DEFAULT true,
      order_index int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END
$$;

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES service_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS buffer_min int DEFAULT 15;

UPDATE services
SET buffer_min = COALESCE(buffer_min, 15);

ALTER TABLE services
  ALTER COLUMN buffer_min SET DEFAULT 15,
  ALTER COLUMN buffer_min SET NOT NULL;

CREATE INDEX IF NOT EXISTS services_service_type_idx ON services(service_type_id);

ALTER TABLE appointments
  DROP COLUMN IF EXISTS densidade;

ALTER TABLE appointments
  DROP COLUMN IF EXISTS tipo,
  DROP COLUMN IF EXISTS tecnica;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_densidade') THEN
    DROP TYPE appointment_densidade;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_kind') THEN
    DROP TYPE appointment_kind;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_tecnica') THEN
    DROP TYPE appointment_tecnica;
  END IF;
END
$$;
