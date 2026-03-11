/**
 * migrate.js — PostgreSQL 数据库迁移脚本
 * 每次 Railway 部署时自动运行，所有操作均幂等（IF NOT EXISTS / ADD COLUMN IF NOT EXISTS）
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false
});

async function migrate() {
  console.log('🚀 开始数据库迁移...');

  // ── users ──────────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'other',
      bio TEXT DEFAULT '',
      credits INTEGER DEFAULT 1000,
      is_admin INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ users 表');

  // ── topics ─────────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS topics (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'other',
      topic_type TEXT DEFAULT 'binary',
      yes_votes NUMERIC DEFAULT 0,
      no_votes NUMERIC DEFAULT 0,
      total_participants INTEGER DEFAULT 0,
      total_pool NUMERIC DEFAULT 0,
      creator_id INTEGER REFERENCES users(id),
      settlement_date TEXT,
      status TEXT DEFAULT 'active',
      settlement_result TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // 补充旧表可能缺失的字段
  await pool.query(`ALTER TABLE topics ADD COLUMN IF NOT EXISTS topic_type TEXT DEFAULT 'binary'`);
  await pool.query(`ALTER TABLE topics ADD COLUMN IF NOT EXISTS total_pool NUMERIC DEFAULT 0`);
  await pool.query(`ALTER TABLE topics ADD COLUMN IF NOT EXISTS yes_votes NUMERIC DEFAULT 0`);
  await pool.query(`ALTER TABLE topics ADD COLUMN IF NOT EXISTS no_votes NUMERIC DEFAULT 0`);
  console.log('✅ topics 表');

  // ── topic_options ──────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS topic_options (
      id SERIAL PRIMARY KEY,
      topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      vote_count NUMERIC DEFAULT 0,
      display_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // 补充旧表可能缺失的字段
  await pool.query(`ALTER TABLE topic_options ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE topic_options ADD COLUMN IF NOT EXISTS vote_count NUMERIC DEFAULT 0`);
  console.log('✅ topic_options 表');

  // ── votes ──────────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      vote TEXT NOT NULL,
      option_id INTEGER REFERENCES topic_options(id) ON DELETE SET NULL,
      credits_spent NUMERIC DEFAULT 10,
      shares NUMERIC DEFAULT 1,
      avg_price NUMERIC DEFAULT 0.5,
      is_closed INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // 补充旧表可能缺失的字段
  await pool.query(`ALTER TABLE votes ADD COLUMN IF NOT EXISTS option_id INTEGER REFERENCES topic_options(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE votes ADD COLUMN IF NOT EXISTS shares NUMERIC DEFAULT 1`);
  await pool.query(`ALTER TABLE votes ADD COLUMN IF NOT EXISTS avg_price NUMERIC DEFAULT 0.5`);
  await pool.query(`ALTER TABLE votes ADD COLUMN IF NOT EXISTS is_closed INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE votes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
  // 移除旧的唯一约束（如果存在），允许同一用户追加投票
  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'votes_topic_id_user_id_key'
      ) THEN
        ALTER TABLE votes DROP CONSTRAINT votes_topic_id_user_id_key;
      END IF;
    END $$
  `);
  console.log('✅ votes 表');

  // ── trades ─────────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trades (
      id SERIAL PRIMARY KEY,
      topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      vote_id INTEGER REFERENCES votes(id) ON DELETE SET NULL,
      action TEXT NOT NULL DEFAULT 'open',
      vote TEXT NOT NULL,
      option_id INTEGER REFERENCES topic_options(id) ON DELETE SET NULL,
      credits NUMERIC NOT NULL,
      shares NUMERIC DEFAULT 1,
      price NUMERIC NOT NULL DEFAULT 0.5,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ trades 表');

  // ── comments ───────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ comments 表');

  // ── follows ────────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS follows (
      id SERIAL PRIMARY KEY,
      follower_id INTEGER REFERENCES users(id),
      following_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(follower_id, following_id)
    )
  `);
  console.log('✅ follows 表');

  // ── vote_snapshots ─────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vote_snapshots (
      id SERIAL PRIMARY KEY,
      topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
      yes_votes NUMERIC DEFAULT 0,
      no_votes NUMERIC DEFAULT 0,
      snapshot_time TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ vote_snapshots 表');

  // ── notifications ──────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      type TEXT NOT NULL,
      topic_id INTEGER,
      from_user_id INTEGER,
      message TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ notifications 表');

  console.log('🎉 数据库迁移完成！');
  await pool.end();
}

migrate().catch(err => {
  console.error('❌ 迁移失败:', err.message);
  process.exit(1);
});
