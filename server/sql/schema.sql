CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'Asesor',
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Example seed (password: "demo1234")
-- INSERT INTO users (email, role, password_hash)
-- VALUES (
--   'asesor@fivesa.com',
--   'Asesor',
--   '$2a$10$8v7d7B8j/2vUXO91R3BIfujJ9vtWE8D3TQy20t5lrmV2pNhT8J/8y'
-- );
