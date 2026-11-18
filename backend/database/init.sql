-- Esquema idempotente para CREDIA Loan Simulator
-- Basado en la estructura real de los esquemas us, cl, op, pa y public.user_admin_profiles

CREATE SCHEMA IF NOT EXISTS cl;
CREATE SCHEMA IF NOT EXISTS op;
CREATE SCHEMA IF NOT EXISTS pa;
CREATE SCHEMA IF NOT EXISTS us;

CREATE OR REPLACE FUNCTION public.actualizar_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.actualizado_en = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION us.generar_usuario(nombres character varying, apellidos character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    PRIMERA_LETRA CHAR(1);
    PRIMER_APELLIDO VARCHAR;
    USUARIO_BASE VARCHAR(50);
    CONTADOR INTEGER := 1;
    USUARIO_FINAL VARCHAR(50);
BEGIN
    PRIMERA_LETRA := LOWER(SUBSTRING(TRIM(NOMBRES) FROM 1 FOR 1));
    PRIMER_APELLIDO := LOWER(REPLACE(SPLIT_PART(APELLIDOS, ' ', 1), ' ', ''));
    USUARIO_BASE := PRIMERA_LETRA || PRIMER_APELLIDO;
    USUARIO_FINAL := USUARIO_BASE;

    WHILE EXISTS (SELECT 1 FROM us.usuarios WHERE usuario = USUARIO_FINAL) LOOP
        USUARIO_FINAL := USUARIO_BASE || CONTADOR::TEXT;
        CONTADOR := CONTADOR + 1;
    END LOOP;

    RETURN USUARIO_FINAL;
END;
$$;

CREATE TABLE IF NOT EXISTS us.usuarios (
    id SERIAL PRIMARY KEY,
    usuario character varying(50) NOT NULL UNIQUE,
    email character varying(255) NOT NULL UNIQUE,
    password_hash character varying(255) NOT NULL,
    rol character varying(20) DEFAULT 'ASESOR'::character varying NOT NULL,
    nombres character varying(100) NOT NULL,
    apellidos character varying(100) NOT NULL,
    telefono character varying(20),
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    actualizado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS us.accesos (
    id SERIAL PRIMARY KEY,
    usuario_id integer REFERENCES us.usuarios(id),
    accion character varying(100) NOT NULL,
    ip character varying(45),
    user_agent text,
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    exitoso boolean DEFAULT true,
    detalle text
);

CREATE TABLE IF NOT EXISTS cl.clientes (
    id SERIAL PRIMARY KEY,
    identificacion character varying(20) NOT NULL UNIQUE,
    tipo_identificacion character varying(10) DEFAULT 'DNI'::character varying,
    nombres character varying(100) NOT NULL,
    apellidos character varying(100) NOT NULL,
    fecha_nacimiento date,
    genero character varying(1),
    telefono character varying(20),
    email character varying(100),
    direccion text,
    ocupacion character varying(100),
    ingreso_mensual numeric(10,2),
    estado_civil character varying(20),
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    asesor_id integer REFERENCES us.usuarios(id)
);

CREATE TABLE IF NOT EXISTS op.creditos (
    id SERIAL PRIMARY KEY,
    codigo character varying(20) NOT NULL UNIQUE,
    cliente_id integer REFERENCES cl.clientes(id),
    monto_solicitado numeric(12,2) NOT NULL,
    tasa_interes numeric(5,2) NOT NULL,
    plazo_meses integer NOT NULL,
    tipo_credito character varying(50),
    destino character varying(100),
    estado character varying(20) DEFAULT 'PENDIENTE'::character varying,
    fecha_solicitud timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_aprobacion timestamp without time zone,
    fecha_desembolso timestamp without time zone,
    observaciones text,
    aprobado_por integer REFERENCES us.usuarios(id),
    asesor_id integer REFERENCES us.usuarios(id)
);

CREATE TABLE IF NOT EXISTS op.amortizaciones (
    id SERIAL PRIMARY KEY,
    credito_id integer REFERENCES op.creditos(id),
    numero_cuota integer NOT NULL,
    fecha_vencimiento date NOT NULL,
    capital numeric(12,2) NOT NULL,
    interes numeric(12,2) NOT NULL,
    cuota_total numeric(12,2) NOT NULL,
    saldo_capital numeric(12,2) NOT NULL,
    estado character varying(20) DEFAULT 'PENDIENTE'::character varying,
    fecha_pago date,
    monto_pagado numeric(12,2),
    dias_mora integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pa.parametros (
    id SERIAL PRIMARY KEY,
    codigo character varying(50) NOT NULL UNIQUE,
    valor text,
    tipo character varying(20) DEFAULT 'TEXTO'::character varying,
    descripcion character varying(255),
    categoria character varying(50),
    activo boolean DEFAULT true,
    actualizado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.user_admin_profiles (
    auth_source TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    company TEXT,
    access_type TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (auth_source, user_id)
);

DROP TRIGGER IF EXISTS usuarios_actualizar_timestamp ON us.usuarios;
CREATE TRIGGER usuarios_actualizar_timestamp
    BEFORE UPDATE ON us.usuarios
    FOR EACH ROW
    EXECUTE FUNCTION public.actualizar_timestamp();
