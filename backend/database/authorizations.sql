-- Migration: Authorization Module and SaaS Auditing
-- Schema: SAAS (Audit Logs) and OP (Authorizations)

-- 1. SaaS Audit Logs Table
CREATE TABLE IF NOT EXISTS saas.audit_logs (
    id SERIAL PRIMARY KEY,
    cod_empresa VARCHAR(20) NOT NULL REFERENCES saas.companies(cod_empresa),
    usuario_id INTEGER, -- Refers to users table (public.users or us.usuarios)
    accion VARCHAR(100) NOT NULL, -- e.g., 'DISBURSEMENT_REQUEST', 'CANCELLATION_REQUEST', 'LOGIN'
    entidad VARCHAR(50), -- e.g., 'LOAN', 'CLIENT'
    entidad_id INTEGER,
    detalles JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Operations Authorizations Table
CREATE TABLE IF NOT EXISTS op.authorizations (
    id SERIAL PRIMARY KEY,
    cod_empresa VARCHAR(20) NOT NULL REFERENCES saas.companies(cod_empresa),
    solicitante_id INTEGER NOT NULL, -- User who requested the action
    autorizador_id INTEGER, -- User who approved/rejected
    tipo_accion VARCHAR(50) NOT NULL, -- 'DISBURSEMENT', 'CANCELLATION', 'WAIVER'
    estado VARCHAR(20) DEFAULT 'PENDING' CHECK (estado IN ('PENDING', 'APPROVED', 'REJECTED')),
    entidad_tipo VARCHAR(50) NOT NULL, -- 'LOAN', 'INSTALLMENT'
    entidad_id INTEGER NOT NULL,
    datos_solicitud JSONB, -- Context data for the request
    observaciones TEXT,
    fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_resolucion TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance and auditing
CREATE INDEX IF NOT EXISTS idx_audit_empresa ON saas.audit_logs(cod_empresa);
CREATE INDEX IF NOT EXISTS idx_audit_action ON saas.audit_logs(accion);
CREATE INDEX IF NOT EXISTS idx_auth_empresa ON op.authorizations(cod_empresa);
CREATE INDEX IF NOT EXISTS idx_auth_status ON op.authorizations(estado);

-- Add missing column for amortization method to credit tables
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'op' AND table_name = 'creditos') THEN
        ALTER TABLE op.creditos ADD COLUMN IF NOT EXISTS metodo_amortizacion VARCHAR(20) DEFAULT 'FRENCH';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans') THEN
        ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS metodo_amortizacion VARCHAR(20) DEFAULT 'FRENCH';
    END IF;
END $$;
