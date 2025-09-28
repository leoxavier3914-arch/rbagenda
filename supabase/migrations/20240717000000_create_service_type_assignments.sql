DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'service_type_assignments'
  ) THEN
    CREATE TABLE service_type_assignments (
      service_id uuid REFERENCES services(id) ON DELETE CASCADE,
      service_type_id uuid REFERENCES service_types(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (service_id, service_type_id)
    );
  END IF;
END
$$;

INSERT INTO service_type_assignments (service_id, service_type_id)
SELECT id, service_type_id
FROM services
WHERE service_type_id IS NOT NULL
ON CONFLICT DO NOTHING;

DROP INDEX IF EXISTS services_service_type_idx;

ALTER TABLE services
  DROP COLUMN IF EXISTS service_type_id;
