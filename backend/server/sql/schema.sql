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

CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES loan_requests(id) ON DELETE SET NULL,
  credit_number integer UNIQUE NOT NULL,
  currency text NOT NULL,
  amount numeric NOT NULL,
  term_months integer NOT NULL,
  monthly_rate numeric NOT NULL,
  payment_frequency text NOT NULL,
  commission_type text NOT NULL,
  commission_value numeric NOT NULL,
  effective_date date NOT NULL,
  first_payment_date date NOT NULL,
  payment_days text,
  status text NOT NULL DEFAULT 'Activo',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loan_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  due_date date NOT NULL,
  principal numeric NOT NULL,
  interest numeric NOT NULL,
  commission numeric NOT NULL,
  total_payment numeric NOT NULL,
  balance numeric NOT NULL,
  status text NOT NULL DEFAULT 'Pendiente',
  paid_date date,
  paid_amount numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loan_id, installment_number)
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
