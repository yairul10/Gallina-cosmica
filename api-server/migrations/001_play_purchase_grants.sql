-- Run only against the intended D1 database before enabling purchase verification.
-- No plaintext purchase token or Google credential is stored.
-- Existing progress rows start at revision 0. Purchase credit increments it;
-- old clients cannot overwrite a newer paid credit with stale progress.
ALTER TABLE player_progress ADD COLUMN purchase_revision INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS play_purchase_grants (
  token_hash TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  coins INTEGER NOT NULL CHECK (coins >= 0),
  entitlement TEXT,
  order_id TEXT NOT NULL DEFAULT '',
  is_test INTEGER NOT NULL DEFAULT 0 CHECK (is_test IN (0, 1)),
  credited_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_play_purchase_grants_player
  ON play_purchase_grants (player_id);

-- Los paquetes son compras permanentes: un jugador sólo puede reclamar
-- cada paquete una vez, aunque Google devuelva un token diferente.
CREATE UNIQUE INDEX IF NOT EXISTS idx_play_purchase_grants_unique_pack
  ON play_purchase_grants (player_id, product_id)
  WHERE product_id IN ('pack_inicial', 'pack_pvp');
