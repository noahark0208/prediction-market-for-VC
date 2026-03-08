const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3001;
const JWT_SECRET = 'your-secret-key-change-in-production';

app.use(cors());
app.use(express.json());

// 初始化数据库
const db = new sqlite3.Database('./prediction.db');

db.serialize(() => {
  // 用户表
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    credits INTEGER DEFAULT 1000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 话题表
  db.run(`CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    creator_id INTEGER,
    yes_votes INTEGER DEFAULT 0,
    no_votes INTEGER DEFAULT 0,
    total_participants INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id)
  )`);

  // 投票表
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

  // 评论表
  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER,
    user_id INTEGER,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (topic_id) REFERENCES topics(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
});

// 认证中间件
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未登录' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: '登录已过期' });
  }
};

// 注册
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: '邮箱和密码不能为空' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  
  db.run('INSERT INTO users (email, password) VALUES (?, ?)', 
    [email, hashedPassword], 
    function(err) {
      if (err) {
        return res.status(400).json({ error: '邮箱已存在' });
      }
      const token = jwt.sign({ userId: this.lastID }, JWT_SECRET);
      res.json({ token, credits: 1000, email });
    }
  );
});

// 登录
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) {
      return res.status(400).json({ error: '邮箱或密码错误' });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ error: '邮箱或密码错误' });
    }
    
    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ token, credits: user.credits, email: user.email });
  });
});

// 获取用户信息
app.get('/api/me', auth, (req, res) => {
  db.get('SELECT id, email, credits FROM users WHERE id = ?', [req.userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: '用户不存在' });
    res.json(user);
  });
});

// 获取话题列表
app.get('/api/topics', (req, res) => {
  db.all(`
    SELECT t.*, u.email as creator_email 
    FROM topics t 
    LEFT JOIN users u ON t.creator_id = u.id 
    ORDER BY t.created_at DESC
  `, (err, topics) => {
    if (err) return res.status(500).json({ error: '获取失败' });
    res.json(topics);
  });
});

// 创建话题
app.post('/api/topics', auth, (req, res) => {
  const { title, description } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: '标题不能为空' });
  }
  
  db.run('INSERT INTO topics (title, description, creator_id) VALUES (?, ?, ?)',
    [title, description, req.userId],
    function(err) {
      if (err) return res.status(500).json({ error: '创建失败' });
      res.json({ id: this.lastID, title, description });
    }
  );
});

// 获取话题详情
app.get('/api/topics/:id', (req, res) => {
  db.get(`
    SELECT t.*, u.email as creator_email 
    FROM topics t 
    LEFT JOIN users u ON t.creator_id = u.id 
    WHERE t.id = ?
  `, [req.params.id], (err, topic) => {
    if (err || !topic) return res.status(404).json({ error: '话题不存在' });
    res.json(topic);
  });
});

// 投票
app.post('/api/topics/:id/vote', auth, (req, res) => {
  const { vote } = req.body; // 'yes' or 'no'
  const topicId = req.params.id;
  
  if (!['yes', 'no'].includes(vote)) {
    return res.status(400).json({ error: '无效的投票' });
  }
  
  // 检查用户积分
  db.get('SELECT credits FROM users WHERE id = ?', [req.userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: '用户不存在' });
    if (user.credits < 10) return res.status(400).json({ error: '积分不足' });
    
    // 检查是否已投票
    db.get('SELECT * FROM votes WHERE topic_id = ? AND user_id = ?', 
      [topicId, req.userId], 
      (err, existingVote) => {
        if (existingVote) {
          return res.status(400).json({ error: '已经投过票了' });
        }
        
        // 插入投票
        db.run('INSERT INTO votes (topic_id, user_id, vote) VALUES (?, ?, ?)',
          [topicId, req.userId, vote],
          (err) => {
            if (err) return res.status(500).json({ error: '投票失败' });
            
            // 更新话题统计
            const voteField = vote === 'yes' ? 'yes_votes' : 'no_votes';
            db.run(`UPDATE topics SET ${voteField} = ${voteField} + 1, total_participants = total_participants + 1 WHERE id = ?`,
              [topicId]
            );
            
            // 扣除积分
            db.run('UPDATE users SET credits = credits - 10 WHERE id = ?', [req.userId]);
            
            res.json({ success: true, newCredits: user.credits - 10 });
          }
        );
      }
    );
  });
});

// 获取评论
app.get('/api/topics/:id/comments', (req, res) => {
  db.all(`
    SELECT c.*, u.email as user_email 
    FROM comments c 
    LEFT JOIN users u ON c.user_id = u.id 
    WHERE c.topic_id = ? 
    ORDER BY c.created_at DESC
  `, [req.params.id], (err, comments) => {
    if (err) return res.status(500).json({ error: '获取失败' });
    res.json(comments);
  });
});

// 发表评论
app.post('/api/topics/:id/comments', auth, (req, res) => {
  const { content } = req.body;
  const topicId = req.params.id;
  
  if (!content) {
    return res.status(400).json({ error: '评论内容不能为空' });
  }
  
  db.run('INSERT INTO comments (topic_id, user_id, content) VALUES (?, ?, ?)',
    [topicId, req.userId, content],
    function(err) {
      if (err) return res.status(500).json({ error: '发表失败' });
      
      db.get('SELECT email FROM users WHERE id = ?', [req.userId], (err, user) => {
        res.json({ 
          id: this.lastID, 
          content, 
          user_email: user?.email,
          created_at: new Date().toISOString()
        });
      });
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
