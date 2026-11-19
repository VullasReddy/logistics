-- =====================================================================
-- TTC Fleet360 - Database Schema (PostgreSQL)
-- ---------------------------------------------------------------------
-- Run order: this file creates every table the application needs.
-- It is safe to run on an empty database. To reset, drop the schema:
--   DROP SCHEMA public CASCADE; CREATE SCHEMA public;
--
-- Naming conventions (follow these for any new table):
--   * table names  : plural, snake_case        (users, audit_logs)
--   * primary key  : id                         (SERIAL / BIGSERIAL)
--   * foreign key  : <singular>_id             (role_id, branch_id)
--   * timestamps   : created_at, updated_at    (TIMESTAMPTZ)
-- =====================================================================

-- ---------------------------------------------------------------------
-- MODULE 3: Role-Based Access Control
-- ---------------------------------------------------------------------

-- A permission is one small action, e.g. USER_CREATE.
-- Permissions are fixed by developers (seeded), not created from the UI,
-- because backend code checks for these exact codes.
CREATE TABLE permissions (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(60)  NOT NULL UNIQUE,   -- e.g. 'USER_CREATE'
    module      VARCHAR(40)  NOT NULL,          -- e.g. 'USERS' (used to group in UI)
    description VARCHAR(255) NOT NULL
);

-- A role is a named group of permissions, e.g. "Branch Manager".
CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(60)  NOT NULL UNIQUE,
    description VARCHAR(255),
    is_system   BOOLEAN      NOT NULL DEFAULT FALSE, -- system roles cannot be deleted
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Many-to-many link: which permissions each role has.
CREATE TABLE role_permissions (
    role_id       INT NOT NULL REFERENCES roles(id)       ON DELETE CASCADE,
    permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ---------------------------------------------------------------------
-- MODULE 4: Branch and Location Management
-- ---------------------------------------------------------------------
CREATE TABLE branches (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    code        VARCHAR(20)  NOT NULL UNIQUE,   -- short code, e.g. 'HYD01'
    city        VARCHAR(80)  NOT NULL,
    state       VARCHAR(80)  NOT NULL,
    address     VARCHAR(255),
    pincode     VARCHAR(10),
    phone       VARCHAR(20),
    email       VARCHAR(120),
    latitude    NUMERIC(9,6),                   -- used to place the pin on the map
    longitude   NUMERIC(9,6),
    status      VARCHAR(10)  NOT NULL DEFAULT 'ACTIVE'
                CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- A branch can have several physical locations (warehouse, hub, office).
CREATE TABLE locations (
    id          SERIAL PRIMARY KEY,
    branch_id   INT          NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name        VARCHAR(120) NOT NULL,
    type        VARCHAR(20)  NOT NULL DEFAULT 'WAREHOUSE'
                CHECK (type IN ('WAREHOUSE', 'HUB', 'OFFICE', 'PARKING')),
    address     VARCHAR(255),
    city        VARCHAR(80),
    pincode     VARCHAR(10),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- MODULE 1 + 2: Users (login accounts)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id                    SERIAL PRIMARY KEY,
    full_name             VARCHAR(120) NOT NULL,
    email                 VARCHAR(120) NOT NULL UNIQUE,   -- stored in lower case
    phone                 VARCHAR(20),
    password_hash         VARCHAR(100) NOT NULL,          -- bcrypt hash, never the plain password
    role_id               INT NOT NULL REFERENCES roles(id),
    branch_id             INT REFERENCES branches(id) ON DELETE SET NULL, -- NULL = head office
    is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
    must_change_password  BOOLEAN      NOT NULL DEFAULT FALSE, -- TRUE after admin reset
    last_login_at         TIMESTAMPTZ,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_role   ON users(role_id);
CREATE INDEX idx_users_branch ON users(branch_id);

-- ---------------------------------------------------------------------
-- MODULE 5: Company Profile (exactly one row, id = 1)
-- ---------------------------------------------------------------------
CREATE TABLE company_profile (
    id                 INT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- forces a single row
    name               VARCHAR(150) NOT NULL,
    legal_name         VARCHAR(200),
    tagline            VARCHAR(200),
    logo_url           VARCHAR(500),
    email              VARCHAR(120),
    phone              VARCHAR(20),
    website            VARCHAR(200),
    address            VARCHAR(255),
    city               VARCHAR(80),
    state              VARCHAR(80),
    country            VARCHAR(80) DEFAULT 'India',
    pincode            VARCHAR(10),
    gstin              VARCHAR(15),   -- GST Identification Number (15 chars)
    pan                VARCHAR(10),   -- PAN (10 chars)
    cin                VARCHAR(21),   -- Company Identification Number (21 chars)
    registration_date  DATE,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- MODULE 6: Subscription Management
-- ---------------------------------------------------------------------

-- The plans we sell (Basic / Premium / Enterprise ...)
CREATE TABLE subscription_plans (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(60)   NOT NULL UNIQUE,
    description    VARCHAR(255),
    price_monthly  NUMERIC(10,2) NOT NULL CHECK (price_monthly >= 0), -- in INR
    duration_days  INT           NOT NULL DEFAULT 30 CHECK (duration_days > 0),
    max_users      INT           NOT NULL DEFAULT 10,
    max_vehicles   INT           NOT NULL DEFAULT 10,
    features       JSONB         NOT NULL DEFAULT '[]'::jsonb,  -- list of feature strings
    is_popular     BOOLEAN       NOT NULL DEFAULT FALSE,        -- shows "Most Popular" badge
    is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- A customer (client company) subscribed to a plan for a period.
CREATE TABLE subscriptions (
    id              SERIAL PRIMARY KEY,
    customer_name   VARCHAR(150) NOT NULL,
    customer_email  VARCHAR(120),
    plan_id         INT          NOT NULL REFERENCES subscription_plans(id),
    active_users    INT          NOT NULL DEFAULT 0,
    start_date      DATE         NOT NULL,
    end_date        DATE         NOT NULL,
    auto_renew      BOOLEAN      NOT NULL DEFAULT FALSE,
    status          VARCHAR(10)  NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE', 'CANCELLED')),
                    -- "EXPIRED" is not stored: it is calculated from end_date,
                    -- so it is never out of date.
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CHECK (end_date >= start_date)
);
CREATE INDEX idx_subscriptions_end_date ON subscriptions(end_date);

-- History of every renewal (renewal tracking).
CREATE TABLE subscription_renewals (
    id               SERIAL PRIMARY KEY,
    subscription_id  INT           NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    plan_id          INT           NOT NULL REFERENCES subscription_plans(id),
    previous_end     DATE          NOT NULL,
    new_end          DATE          NOT NULL,
    amount           NUMERIC(10,2) NOT NULL,
    renewed_by       INT REFERENCES users(id) ON DELETE SET NULL,
    renewed_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- MODULE 7: Configuration and System Settings (key / value store)
-- ---------------------------------------------------------------------
CREATE TABLE settings (
    key         VARCHAR(80) PRIMARY KEY,          -- e.g. 'app.timezone'
    value       JSONB       NOT NULL,             -- any JSON value: string, number, boolean
    category    VARCHAR(20) NOT NULL
                CHECK (category IN ('APPLICATION', 'NOTIFICATION', 'OPERATIONAL', 'PREFERENCE')),
    label       VARCHAR(120) NOT NULL,            -- human readable name for the UI
    value_type  VARCHAR(10) NOT NULL DEFAULT 'string'
                CHECK (value_type IN ('string', 'number', 'boolean', 'select')),
    options     JSONB,                            -- allowed values when value_type = 'select'
    updated_by  INT REFERENCES users(id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- MODULE 8: Audit Logs (append-only: rows are never updated or deleted)
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
    id           BIGSERIAL PRIMARY KEY,
    user_id      INT REFERENCES users(id) ON DELETE SET NULL,
    user_email   VARCHAR(120),        -- copied so the log survives if the user is deleted
    action       VARCHAR(20) NOT NULL
                 CHECK (action IN ('LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'CREATE',
                                   'UPDATE', 'DELETE', 'PASSWORD_CHANGE', 'STATUS_CHANGE')),
    entity_type  VARCHAR(40),         -- e.g. 'USER', 'BRANCH'
    entity_id    VARCHAR(40),
    description  VARCHAR(255) NOT NULL,
    details      JSONB,               -- extra info, e.g. which fields changed
    ip_address   VARCHAR(45),
    user_agent   VARCHAR(255),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_user       ON audit_logs(user_id);
CREATE INDEX idx_audit_action     ON audit_logs(action);

-- ---------------------------------------------------------------------
-- DASHBOARD SUPPORT: vehicles and trips
-- These two tables only feed the dashboard cards and the Fleet
-- Performance chart. A full Fleet/Trip module can be built on them later.
-- ---------------------------------------------------------------------
CREATE TABLE vehicles (
    id            SERIAL PRIMARY KEY,
    reg_number    VARCHAR(20) NOT NULL UNIQUE,   -- e.g. 'TS09AB1234'
    model         VARCHAR(80),
    type          VARCHAR(20) NOT NULL DEFAULT 'TRUCK',
    branch_id     INT REFERENCES branches(id) ON DELETE SET NULL,
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE trips (
    id             SERIAL PRIMARY KEY,
    vehicle_id     INT  NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    trip_date      DATE NOT NULL,
    delivered_on_time BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_trips_date ON trips(trip_date);
