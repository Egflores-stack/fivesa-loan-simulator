-- Base de datos para CREDIA - Sistema de GestiÃ³n de PrÃ©stamos
-- Creado: 2024-01-25

-- Eliminar tablas si existen (para desarrollo)
DROP TABLE IF EXISTS loan_payments CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Tabla de usuarios (asesores/administradores)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'asesor' CHECK (role IN ('admin', 'asesor', 'supervisor')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de clientes
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    dpi VARCHAR(20) UNIQUE, -- Documento de identificaciÃ³n
    birth_date DATE,
    address TEXT,
    employment_status VARCHAR(50) CHECK (employment_status IN ('employed', 'self_employed', 'unemployed', 'retired')),
    monthly_income DECIMAL(12, 2),
    credit_score INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de prÃ©stamos
CREATE TABLE loans (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    loan_type VARCHAR(50) NOT NULL CHECK (loan_type IN ('personal', 'hipotecario', 'automotriz', 'negocios', 'educacion')),
    amount_requested DECIMAL(12, 2) NOT NULL,
    amount_approved DECIMAL(12, 2),
    down_payment DECIMAL(12, 2) DEFAULT 0,
    term_months INTEGER NOT NULL,
    annual_interest_rate DECIMAL(5, 2) NOT NULL,
    monthly_payment DECIMAL(12, 2),
    commission_type VARCHAR(20) DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
    commission_value DECIMAL(8, 2) DEFAULT 0,
    payment_frequency VARCHAR(20) DEFAULT 'monthly' CHECK (payment_frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly')),
    currency VARCHAR(3) DEFAULT 'NIO' CHECK (currency IN ('NIO', 'USD')),
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'completed', 'defaulted')),
    purpose TEXT,
    approval_date TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de pagos de prÃ©stamos
CREATE TABLE loan_payments (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL REFERENCES loans(id),
    payment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    principal_amount DECIMAL(12, 2) NOT NULL,
    interest_amount DECIMAL(12, 2) NOT NULL,
    commission_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    balance_after_payment DECIMAL(12, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'partial')),
    paid_date TIMESTAMP,
    paid_amount DECIMAL(12, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear Ã­ndices para mejor rendimiento
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_dpi ON clients(dpi);
CREATE INDEX idx_loans_client_id ON loans(client_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_created_by ON loans(created_by);
CREATE INDEX idx_loan_payments_loan_id ON loan_payments(loan_id);
CREATE INDEX idx_loan_payments_due_date ON loan_payments(due_date);

-- Crear funciÃ³n para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Crear triggers para updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insertar usuario administrador por defecto
INSERT INTO users (email, password_hash, first_name, last_name, role) 
VALUES (
    'admin@credia.com', 
    '$2a$10$LQDM411N8USg7B3zUtr0mOQ8paDgYaGIPNFuAtS8712VJ2oe.A0Kq', -- password: admin123
    'Administrador', 
    'Sistema', 
    'admin'
);

-- Insertar datos de ejemplo para desarrollo
INSERT INTO clients (first_name, last_name, email, phone, dpi, monthly_income, employment_status, created_by) VALUES
('Juan', 'PÃ©rez', 'juan.perez@email.com', '5555-1234', '1234567890101', 15000.00, 'employed', 1),
('MarÃ­a', 'GarcÃ­a', 'maria.garcia@email.com', '5555-5678', '2345678901234', 25000.00, 'employed', 1),
('Carlos', 'LÃ³pez', 'carlos.lopez@email.com', '5555-9012', '3456789012345', 18000.00, 'self_employed', 1);

INSERT INTO loans (client_id, created_by, loan_type, amount_requested, amount_approved, down_payment, term_months, annual_interest_rate, monthly_payment, commission_type, commission_value, payment_frequency, currency, status, purpose) VALUES
(1, 1, 'personal', 15000.00, 15000.00, 1000.00, 24, 15.5, 725.50, 'percentage', 2.0, 'monthly', 'NIO', 'approved', 'ConsolidaciÃ³n de deudas'),
(2, 1, 'hipotecario', 50000.00, 50000.00, 5000.00, 60, 12.0, 1125.00, 'percentage', 1.5, 'monthly', 'NIO', 'pending', 'Compra de vivienda'),
(3, 1, 'automotriz', 25000.00, 25000.00, 2000.00, 36, 18.0, 895.25, 'fixed', 500.00, 'monthly', 'NIO', 'rejected', 'VehÃ­culo nuevo - Ingreso insuficiente');

-- Vista para estadÃ­sticas del dashboard
CREATE VIEW dashboard_stats AS
SELECT 
    COUNT(DISTINCT c.id) as total_clients,
    COUNT(DISTINCT l.id) as total_loans,
    COUNT(DISTINCT CASE WHEN l.status = 'approved' THEN l.id END) as approved_loans,
    COUNT(DISTINCT CASE WHEN l.status = 'pending' THEN l.id END) as pending_loans,
    COUNT(DISTINCT CASE WHEN l.status = 'rejected' THEN l.id END) as rejected_loans,
    COALESCE(SUM(CASE WHEN l.status = 'approved' THEN l.amount_approved END), 0) as total_approved_amount,
    COALESCE(AVG(CASE WHEN l.status = 'approved' THEN l.amount_approved END), 0) as avg_loan_amount,
    COALESCE(AVG(CASE WHEN l.status = 'approved' THEN l.term_months END), 0) as avg_term_months
FROM clients c
LEFT JOIN loans l ON c.id = l.client_id;

-- Comentarios para documentaciÃ³n
COMMENT ON TABLE users IS 'Usuarios del sistema (asesores, administradores)';
COMMENT ON TABLE clients IS 'Clientes que solicitan prÃ©stamos';
COMMENT ON TABLE loans IS 'PrÃ©stamos solicitados por los clientes';
COMMENT ON TABLE loan_payments IS 'Tabla de amortizaciÃ³n y pagos de los prÃ©stamos';
COMMENT ON VIEW dashboard_stats IS 'Vista con estadÃ­sticas para el dashboard';
