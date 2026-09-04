-- 积分总表（单行记录）
CREATE TABLE IF NOT EXISTS points (
  id INTEGER PRIMARY KEY DEFAULT 1,
  total INTEGER NOT NULL DEFAULT 0
);

-- 初始化积分（如果不存在则插入）
INSERT OR IGNORE INTO points (id, total) VALUES (1, 0);

-- 交易流水表
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('add', 'consume')),
  amount INTEGER NOT NULL CHECK(amount > 0),
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))
);

-- 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
