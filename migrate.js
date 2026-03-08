const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./prediction.db');

db.serialize(() => {
  // 添加用户身份字段
  db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'other'`, (err) => {
    if (err) console.log('role字段已存在');
    else console.log('✅ 添加用户身份字段');
  });

  // 添加用户简介
  db.run(`ALTER TABLE users ADD COLUMN bio TEXT`, (err) => {
    if (err) console.log('bio字段已存在');
    else console.log('✅ 添加用户简介字段');
  });

  // 添加话题分类
  db.run(`ALTER TABLE topics ADD COLUMN category TEXT DEFAULT 'other'`, (err) => {
    if (err) console.log('category字段已存在');
    else console.log('✅ 添加话题分类字段');
  });

  // 添加话题结算时间
  db.run(`ALTER TABLE topics ADD COLUMN settlement_date TEXT`, (err) => {
    if (err) console.log('settlement_date字段已存在');
    else console.log('✅ 添加结算时间字段');
  });

  // 添加话题结算结果
  db.run(`ALTER TABLE topics ADD COLUMN settlement_result TEXT`, (err) => {
    if (err) console.log('settlement_result字段已存在');
    else console.log('✅ 添加结算结果字段');
  });

  // 创建关注表
  db.run(`CREATE TABLE IF NOT EXISTS follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_id INTEGER NOT NULL,
    following_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (follower_id) REFERENCES users(id),
    FOREIGN KEY (following_id) REFERENCES users(id),
    UNIQUE(follower_id, following_id)
  )`, (err) => {
    if (err) console.log('follows表已存在');
    else console.log('✅ 创建关注表');
  });

  // 创建投票历史表（用于趋势图）
  db.run(`CREATE TABLE IF NOT EXISTS vote_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER NOT NULL,
    yes_votes INTEGER DEFAULT 0,
    no_votes INTEGER DEFAULT 0,
    snapshot_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (topic_id) REFERENCES topics(id)
  )`, (err) => {
    if (err) console.log('vote_snapshots表已存在');
    else console.log('✅ 创建投票快照表');
  });

  console.log('\n🎉 数据库升级完成！');
  
  setTimeout(() => {
    db.close();
    process.exit(0);
  }, 1000);
});
