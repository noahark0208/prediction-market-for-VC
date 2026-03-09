/**
 * migrate.js — PostgreSQL 数据库迁移脚本
 * 每次 Railway 部署时自动运行，所有操作均幂等（IF NOT EXISTS）
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS topics (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'other',
      yes_votes INTEGER DEFAULT 0,
      no_votes INTEGER DEFAULT 0,
      total_participants INTEGER DEFAULT 0,
      creator_id INTEGER REFERENCES users(id),
      settlement_date TEXT,
      status TEXT DEFAULT 'active',
      settlement_result TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ topics 表');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      vote TEXT NOT NULL,
      credits_spent INTEGER DEFAULT 10,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(topic_id, user_id)
    )
  `);
  console.log('✅ votes 表');

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vote_snapshots (
      id SERIAL PRIMARY KEY,
      topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
      yes_votes INTEGER DEFAULT 0,
      no_votes INTEGER DEFAULT 0,
      snapshot_time TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ vote_snapshots 表');

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
