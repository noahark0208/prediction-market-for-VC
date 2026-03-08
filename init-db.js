const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./prediction.db');

async function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      // 创建用户表
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        credits INTEGER DEFAULT 1000,
        role TEXT DEFAULT 'other',
        bio TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // 创建话题表
      db.run(`CREATE TABLE IF NOT EXISTS topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        creator_id INTEGER,
        yes_votes INTEGER DEFAULT 0,
        no_votes INTEGER DEFAULT 0,
        total_participants INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        category TEXT DEFAULT 'other',
        settlement_date TEXT,
        settlement_result TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users(id)
      )`);

      // 创建投票表
      db.run(`CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id INTEGER,
        user_id INTEGER,
        vote TEXT CHECK(vote IN ('yes', 'no')),
        credits_spent INTEGER DEFAULT 10,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (topic_id) REFERENCES topics(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(topic_id, user_id)
      )`);

      // 创建评论表
      db.run(`CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id INTEGER,
        user_id INTEGER,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (topic_id) REFERENCES topics(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`);

      // 创建关注表
      db.run(`CREATE TABLE IF NOT EXISTS follows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        follower_id INTEGER NOT NULL,
        following_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (follower_id) REFERENCES users(id),
        FOREIGN KEY (following_id) REFERENCES users(id),
        UNIQUE(follower_id, following_id)
      )`);

      // 创建投票快照表
      db.run(`CREATE TABLE IF NOT EXISTS vote_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id INTEGER NOT NULL,
        yes_votes INTEGER DEFAULT 0,
        no_votes INTEGER DEFAULT 0,
        snapshot_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (topic_id) REFERENCES topics(id)
      )`, async (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // 检查是否已有数据
        db.get('SELECT COUNT(*) as count FROM users', async (err, row) => {
          if (err || row.count > 0) {
            console.log('✅ Database already initialized');
            resolve();
            return;
          }
          
          // 插入种子数据
          await insertSeedData();
          resolve();
        });
      });
    });
  });
}

async function insertSeedData() {
  const systemPassword = await bcrypt.hash('system123', 10);
  
  return new Promise((resolve) => {
    db.run(`INSERT INTO users (id, email, password, credits, role) VALUES (1, 'system@market.com', ?, 999999, 'other')`, 
      [systemPassword], 
      () => {
        console.log('✅ Created system user');
        
        const seedTopics = [
          { title: "2026年底之前会有多少家估值超过100亿人民币的机器人创业公司？", description: "考虑人形机器人、工业机器人、服务机器人等赛道，目前优必选、达闼等已接近或超过这个估值。", category: "valuation", yes_votes: 45, no_votes: 35 },
          { title: "燧原科技能否在2026年成功上市？", description: "燧原科技是国产AI芯片独角兽，已完成多轮融资。考虑当前市场环境和公司发展阶段。", category: "ipo", yes_votes: 38, no_votes: 42 },
          { title: "2026年会出现新的AI独角兽（估值>10亿美元）吗？", description: "在大模型、AI应用、AI基础设施等领域，是否还有新玩家能快速崛起？", category: "trend", yes_votes: 67, no_votes: 23 },
          { title: "小鹏汽车2026年能实现全年盈利吗？", description: "小鹏在智能驾驶领域投入巨大，但持续亏损。2026年能否扭亏为盈？", category: "trend", yes_votes: 28, no_votes: 52 },
          { title: "理想汽车会在2026年推出20万以下的车型吗？", description: "理想目前主打30-50万价格区间，是否会下探到更大众的市场？", category: "trend", yes_votes: 55, no_votes: 25 },
          { title: "2026年会有中国AI公司被海外巨头收购吗？", description: "考虑地缘政治、技术封锁等因素，中国AI创业公司是否还有可能被Google、Meta等收购？", category: "gossip", yes_votes: 15, no_votes: 65 },
          { title: "Moonshot AI（月之暗面）2026年估值能超过50亿美元吗？", description: "Kimi已经成为现象级产品，月之暗面的估值增长空间有多大？", category: "valuation", yes_votes: 72, no_votes: 18 },
          { title: "2026年会有新的万亿市值中国科技公司诞生吗？", description: "目前腾讯、阿里、字节等已达万亿级别，新势力中谁最有可能？", category: "valuation", yes_votes: 22, no_votes: 58 },
          { title: "蔚来汽车能在2026年底前实现单月交付5万辆吗？", description: "蔚来目前月交付2万辆左右，能否在2026年实现突破？", category: "trend", yes_votes: 48, no_votes: 32 },
          { title: "2026年VC市场会比2025年更活跃吗？", description: "考虑宏观经济、退出环境、募资情况等因素，一级市场是否会回暖？", category: "financing", yes_votes: 41, no_votes: 39 }
        ];
        
        let completed = 0;
        seedTopics.forEach((topic) => {
          db.run(
            `INSERT INTO topics (title, description, category, creator_id, yes_votes, no_votes, total_participants) 
             VALUES (?, ?, ?, 1, ?, ?, ?)`,
            [topic.title, topic.description, topic.category, topic.yes_votes, topic.no_votes, topic.yes_votes + topic.no_votes],
            () => {
              completed++;
              if (completed === seedTopics.length) {
                console.log('✅ Created 10 seed topics');
                resolve();
              }
            }
          );
        });
      }
    );
  });
}

module.exports = { initDatabase };
