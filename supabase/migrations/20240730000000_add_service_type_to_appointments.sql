ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES service_types(id) ON DELETE SET NULL;

UPDATE appointments AS a
SET service_type_id = (
  SELECT sta.service_type_id
  FROM service_type_assignments AS sta
  WHERE sta.service_id = a.service_id
  ORDER BY sta.created_at NULLS LAST, sta.service_type_id
  LIMIT 1
)
WHERE a.service_id IS NOT NULL
  AND a.service_type_id IS NULL;

CREATE INDEX IF NOT EXISTS appointments_service_type_idx ON appointments(service_type_id);
