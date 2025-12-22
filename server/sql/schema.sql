CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'Asesor',
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parameters (
  id integer PRIMARY KEY,
  dias_mora_vencido integer NOT NULL DEFAULT 0,
  cuotas_vencido integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO parameters (id, dias_mora_vencido, cuotas_vencido)
VALUES (1, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- Example seed (password: "demo1234")
-- INSERT INTO users (email, role, password_hash)
-- VALUES (
--   'asesor@fivesa.com',
--   'Asesor',
--   '$2a$10$8v7d7B8j/2vUXO91R3BIfujJ9vtWE8D3TQy20t5lrmV2pNhT8J/8y'
-- );
