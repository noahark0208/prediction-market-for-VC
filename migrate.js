/**
 * migrate.js — 数据库迁移脚本
 * 每次 Railway 部署时自动运行，所有操作均幂等（已存在则跳过）
 */
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./prediction.db');

const runSQL = (sql, label) => new Promise((resolve) => {
  db.run(sql, (err) => {
    if (err) console.log(`⏭  跳过（已存在）: ${label}`);
    else console.log(`✅ ${label}`);
    resolve();
  });
});

async function migrate() {
  console.log('🚀 开始数据库迁移...\n');
  // ── users 表
  await runSQL(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'other'`, 'users.role');
  await runSQL(`ALTER TABLE users ADD COLUMN bio TEXT`, 'users.bio');
  await runSQL(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`, 'users.is_admin');

  // ── topics 表
  await runSQL(`ALTER TABLE topics ADD COLUMN category TEXT DEFAULT 'other'`, 'topics.category');
  await runSQL(`ALTER TABLE topics ADD COLUMN settlement_date TEXT`, 'topics.settlement_date');
  await runSQL(`ALTER TABLE topics ADD COLUMN settlement_result TEXT`, 'topics.settlement_result');
  await runSQL(`ALTER TABLE topics ADD COLUMN status TEXT DEFAULT 'active'`, 'topics.status');
  await runSQL(`ALTER TABLE topics ADD COLUMN total_participants INTEGER DEFAULT 0`, 'topics.total_participants');

  // ── 新建表
  await runSQL(`CREATE TABLE IF NOT EXISTS follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_id INTEGER NOT NULL,
    following_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (follower_id) REFERENCES users(id),
    FOREIGN KEY (following_id) REFERENCES users(id),
    UNIQUE(follower_id, following_id)
  )`, 'follows 表');

  await runSQL(`CREATE TABLE IF NOT EXISTS vote_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER NOT NULL,
    yes_votes INTEGER DEFAULT 0,
    no_votes INTEGER DEFAULT 0,
    snapshot_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (topic_id) REFERENCES topics(id)
  )`, 'vote_snapshots 表');

  await runSQL(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    topic_id INTEGER,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`, 'notifications 表');

  console.log('\n🎉 数据库迁移完成！\n');
}

migrate().then(() => {
  db.close();
  process.exit(0);
}).catch((err) => {
  console.error('❌ 迁移失败:', err);
  db.close();
  process.exit(1);
});
