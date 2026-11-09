export interface Migration {
  id: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: '001_init',
    sql: `
CREATE TABLE users (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','technician','viewer')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE clients (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX clients_name_unique ON clients (lower(name));

CREATE TABLE sites (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  UNIQUE (client_id, name)
);

CREATE TABLE devices (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  site_id text REFERENCES sites(id) ON DELETE SET NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('firewall','switch','router','server','access_point','client')),
  model text,
  serial text,
  role text CHECK (role IS NULL OR role IN ('core','distribution','access','dmz','backup')),
  mgmt_ip text,
  mgmt_gateway text,
  mgmt_port text,
  mgmt_protocols text[] NOT NULL DEFAULT '{}',
  mgmt_vlan integer CHECK (mgmt_vlan IS NULL OR mgmt_vlan BETWEEN 1 AND 4094),
  port_count integer NOT NULL DEFAULT 24 CHECK (port_count BETWEEN 0 AND 512),
  port_prefix text NOT NULL DEFAULT 'Gi1/0/',
  x double precision NOT NULL DEFAULT 0,
  y double precision NOT NULL DEFAULT 0,
  cred_username text,
  cred_password_enc text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX devices_client_idx ON devices (client_id);

CREATE TABLE links (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  source_port text NOT NULL,
  dest_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  dest_port text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('access','trunk')),
  native_vlan integer,
  dest_native_vlan integer,
  tagged_vlans integer[] NOT NULL DEFAULT '{}',
  access_vlan integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX links_client_idx ON links (client_id);
CREATE INDEX links_source_idx ON links (source_id);
CREATE INDEX links_dest_idx ON links (dest_id);

CREATE TABLE revisions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  author_id text REFERENCES users(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '',
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX revisions_client_idx ON revisions (client_id, created_at DESC);
`,
  },
  {
    id: '002_accounts_racks_media',
    sql: `
-- Cable medium: black Ethernet / orange fibre
ALTER TABLE links ADD COLUMN medium text NOT NULL DEFAULT 'ethernet' CHECK (medium IN ('ethernet','fiber'));

-- Racks (baies) and rack placement of devices
CREATE TABLE racks (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  site_id text REFERENCES sites(id) ON DELETE SET NULL,
  name text NOT NULL,
  units integer NOT NULL DEFAULT 42 CHECK (units BETWEEN 1 AND 60)
);
CREATE UNIQUE INDEX racks_name_unique ON racks (client_id, lower(name));
ALTER TABLE devices ADD COLUMN rack_id text REFERENCES racks(id) ON DELETE SET NULL;
ALTER TABLE devices ADD COLUMN rack_pos integer CHECK (rack_pos IS NULL OR rack_pos BETWEEN 1 AND 100);
ALTER TABLE devices ADD COLUMN rack_units integer NOT NULL DEFAULT 1 CHECK (rack_units BETWEEN 1 AND 48);

-- Per-client access: a user only sees the clients they are a member of (global admins see all)
CREATE TABLE client_members (
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('technician','viewer')),
  PRIMARY KEY (client_id, user_id)
);
CREATE INDEX client_members_user_idx ON client_members (user_id);
-- Keep existing technicians/viewers working: they become members of every existing client.
INSERT INTO client_members (client_id, user_id, role)
  SELECT c.id, u.id, u.role FROM users u CROSS JOIN clients c WHERE u.role IN ('technician','viewer');

CREATE TABLE invitations (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('technician','viewer')),
  token_hash text NOT NULL UNIQUE,
  invited_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz
);
CREATE INDEX invitations_client_idx ON invitations (client_id);

CREATE TABLE password_resets (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);
-- Tokens issued before this moment are refused (set when a password is reset).
ALTER TABLE users ADD COLUMN password_changed_at timestamptz;

CREATE TABLE app_settings (key text PRIMARY KEY, value jsonb NOT NULL);

CREATE TABLE library_items (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  label text NOT NULL,
  type text NOT NULL CHECK (type IN ('firewall','switch','router','server','access_point','client')),
  model text NOT NULL,
  port_count integer NOT NULL CHECK (port_count BETWEEN 0 AND 512),
  port_prefix text NOT NULL DEFAULT '',
  role text CHECK (role IS NULL OR role IN ('core','distribution','access','dmz','backup')),
  rack_units integer NOT NULL DEFAULT 1 CHECK (rack_units BETWEEN 1 AND 48),
  created_at timestamptz NOT NULL DEFAULT now()
);
`,
  },
];
