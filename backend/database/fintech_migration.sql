-- Migration: Evolution to Fintech SaaS Multi-tenant
-- Author: Jules (Architect & Fintech Consultant)

-- 1. SAAS Schema and Companies
CREATE SCHEMA IF NOT EXISTS saas;

CREATE TABLE IF NOT EXISTS saas.companies (
    id SERIAL PRIMARY KEY,
    cod_empresa VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    nit VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert a default company for existing data
INSERT INTO saas.companies (cod_empresa, nombre) VALUES ('MAIN', 'Empresa Principal') ON CONFLICT DO NOTHING;

-- 2. Add cod_empresa to existing tables
-- We handle both standard and schema-based tables for compatibility

-- Schema: US (Users)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'us' AND table_name = 'usuarios') THEN
        ALTER TABLE us.usuarios ADD COLUMN IF NOT EXISTS cod_empresa VARCHAR(20) DEFAULT 'MAIN' REFERENCES saas.companies(cod_empresa);
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cod_empresa VARCHAR(20) DEFAULT 'MAIN' REFERENCES saas.companies(cod_empresa);
    END IF;
END $$;

-- Schema: CL (Clients)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'cl' AND table_name = 'clientes') THEN
        ALTER TABLE cl.clientes ADD COLUMN IF NOT EXISTS cod_empresa VARCHAR(20) DEFAULT 'MAIN' REFERENCES saas.companies(cod_empresa);
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
        ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cod_empresa VARCHAR(20) DEFAULT 'MAIN' REFERENCES saas.companies(cod_empresa);
    END IF;
END $$;

-- Schema: OP (Operations - Loans & Amortization)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'op' AND table_name = 'creditos') THEN
        ALTER TABLE op.creditos ADD COLUMN IF NOT EXISTS cod_empresa VARCHAR(20) DEFAULT 'MAIN' REFERENCES saas.companies(cod_empresa);
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans') THEN
        ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS cod_empresa VARCHAR(20) DEFAULT 'MAIN' REFERENCES saas.companies(cod_empresa);
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'op' AND table_name = 'amortizaciones') THEN
        ALTER TABLE op.amortizaciones ADD COLUMN IF NOT EXISTS cod_empresa VARCHAR(20) DEFAULT 'MAIN' REFERENCES saas.companies(cod_empresa);
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loan_payments') THEN
        ALTER TABLE public.loan_payments ADD COLUMN IF NOT EXISTS cod_empresa VARCHAR(20) DEFAULT 'MAIN' REFERENCES saas.companies(cod_empresa);
    END IF;
END $$;

-- Schema: PA (Parameters)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'pa' AND table_name = 'parametros') THEN
        ALTER TABLE pa.parametros ADD COLUMN IF NOT EXISTS cod_empresa VARCHAR(20) DEFAULT 'MAIN' REFERENCES saas.companies(cod_empresa);
    END IF;
END $$;

-- 3. Digital Dossier (cl.documentos)
CREATE TABLE IF NOT EXISTS cl.documentos (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL,
    cod_empresa VARCHAR(20) NOT NULL REFERENCES saas.companies(cod_empresa),
    tipo_documento VARCHAR(50) NOT NULL, -- e.g., 'ID_FRONT', 'ID_BACK', 'CONTRACT', 'UTILITY_BILL'
    nombre_archivo VARCHAR(255) NOT NULL,
    mimetype VARCHAR(100),
    size_bytes BIGINT,
    storage_path TEXT NOT NULL, -- URL or internal path
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Advanced Parameters (Mora and Grace Periods)
-- These will be managed via the existing pa.parametros system, but scoped by company
INSERT INTO pa.parametros (codigo, valor, cod_empresa, descripcion) VALUES
('MORA_TASA_DIARIA_PCT', '0.1', 'MAIN', 'Tasa de mora diaria porcentual'),
('MORA_CARGO_FIJO', '50.00', 'MAIN', 'Cargo fijo por pago tardio'),
('GRACE_PERIOD_MAX_MONTHS', '3', 'MAIN', 'Maximo de meses de periodo de gracia permitido')
ON CONFLICT DO NOTHING;

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_users_empresa ON us.usuarios(cod_empresa) WHERE cod_empresa IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_empresa ON cl.clientes(cod_empresa) WHERE cod_empresa IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loans_empresa ON op.creditos(cod_empresa) WHERE cod_empresa IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_client ON cl.documentos(cliente_id);
