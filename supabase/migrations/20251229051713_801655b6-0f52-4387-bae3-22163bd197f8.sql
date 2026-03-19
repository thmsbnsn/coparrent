-- Fix: Extension installed in public schema (pg_net)
-- pg_net is non-relocatable, so we reinstall it with the correct target schema.

CREATE SCHEMA IF NOT EXISTS extensions;

-- Reinstall pg_net so the extension itself is not owned by the public schema.
-- NOTE: This will drop/recreate the extension-managed objects (net.*), so run during low-traffic.
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
