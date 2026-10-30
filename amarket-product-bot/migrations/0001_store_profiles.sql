CREATE TABLE IF NOT EXISTS store_profiles (
  telegram_user_id TEXT PRIMARY KEY,
  store_name TEXT NOT NULL DEFAULT 'Мой магазин',
  legal_footer TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  telegram_contact TEXT NOT NULL DEFAULT '',
  channel_id TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 0,
  subscription_until TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_store_profiles_active_until
  ON store_profiles(active, subscription_until);
