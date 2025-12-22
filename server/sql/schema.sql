CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'Asesor',
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  currency text NOT NULL,
  amount numeric NOT NULL,
  term_months integer NOT NULL,
  monthly_rate numeric NOT NULL,
  payment_frequency text NOT NULL,
  commission_type text NOT NULL,
  commission_value numeric NOT NULL,
  previous_balance numeric,
  responsible text NOT NULL,
  manager text NOT NULL,
  payment_dates text,
  request_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Example seed (password: "demo1234")
-- INSERT INTO users (email, role, password_hash)
-- VALUES (
--   'asesor@fivesa.com',
--   'Asesor',
--   '$2a$10$8v7d7B8j/2vUXO91R3BIfujJ9vtWE8D3TQy20t5lrmV2pNhT8J/8y'
-- );
