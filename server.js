const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { initDatabase } = require('./init-db');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const allowedOrigins = [
  'http://localhost:5173',
  'https://prediction-market-for-vc.vercel.app'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

const db = new sqlite3.Database('./prediction.db');

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
  const { email, password, role = 'other' } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: '邮箱和密码不能为空' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  
  db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', 
    [email, hashedPassword, role], 
    function(err) {
      if (err) {
        return res.status(400).json({ error: '邮箱已存在' });
      }
      const token = jwt.sign({ userId: this.lastID }, JWT_SECRET);
      res.json({ token, credits: 1000, email, role });
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
    res.json({ token, credits: user.credits, email: user.email, role: user.role || 'other' });
  });
});

// 获取用户信息
app.get('/api/me', auth, (req, res) => {
  db.get('SELECT id, email, credits, role, bio FROM users WHERE id = ?', [req.userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: '用户不存在' });
    res.json(user);
  });
});

// 更新用户资料
app.put('/api/me', auth, (req, res) => {
  const { role, bio } = req.body;
  db.run('UPDATE users SET role = ?, bio = ? WHERE id = ?', 
    [role, bio, req.userId],
    (err) => {
      if (err) return res.status(500).json({ error: '更新失败' });
      res.json({ success: true });
    }
  );
});

// 获取话题列表（带热度排序）
app.get('/api/topics', (req, res) => {
  const { category, sort = 'hot' } = req.query;
  
  let query = `
    SELECT t.*, u.email as creator_email, u.role as creator_role,
    (t.total_participants * 2 + (ABS(t.yes_votes - t.no_votes) * 0.5)) as hotness
    FROM topics t 
    LEFT JOIN users u ON t.creator_id = u.id 
  `;
  
  const params = [];
  if (category && category !== 'all') {
    query += ' WHERE t.category = ?';
    params.push(category);
  }
  
  if (sort === 'hot') {
    query += ' ORDER BY hotness DESC, t.created_at DESC';
  } else {
    query += ' ORDER BY t.created_at DESC';
  }
  
  db.all(query, params, (err, topics) => {
    if (err) return res.status(500).json({ error: '获取失败' });
    res.json(topics);
  });
});

// 创建话题
app.post('/api/topics', auth, (req, res) => {
  const { title, description, category = 'other', settlement_date } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: '标题不能为空' });
  }
  
  db.run('INSERT INTO topics (title, description, category, settlement_date, creator_id) VALUES (?, ?, ?, ?, ?)',
    [title, description, category, settlement_date, req.userId],
    function(err) {
      if (err) return res.status(500).json({ error: '创建失败' });
      res.json({ id: this.lastID, title, description, category });
    }
  );
});

// 获取话题详情
app.get('/api/topics/:id', (req, res) => {
  db.get(`
    SELECT t.*, u.email as creator_email, u.role as creator_role
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
  const { vote } = req.body;
  const topicId = req.params.id;
  
  if (!['yes', 'no'].includes(vote)) {
    return res.status(400).json({ error: '无效的投票' });
  }
  
  db.get('SELECT credits FROM users WHERE id = ?', [req.userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: '用户不存在' });
    if (user.credits < 10) return res.status(400).json({ error: '积分不足' });
    
    db.get('SELECT * FROM votes WHERE topic_id = ? AND user_id = ?', 
      [topicId, req.userId], 
      (err, existingVote) => {
        if (existingVote) {
          return res.status(400).json({ error: '已经投过票了' });
        }
        
        db.run('INSERT INTO votes (topic_id, user_id, vote) VALUES (?, ?, ?)',
          [topicId, req.userId, vote],
          (err) => {
            if (err) return res.status(500).json({ error: '投票失败' });
            
            const voteField = vote === 'yes' ? 'yes_votes' : 'no_votes';
            db.run(`UPDATE topics SET ${voteField} = ${voteField} + 1, total_participants = total_participants + 1 WHERE id = ?`,
              [topicId]
            );
            
            db.run('UPDATE users SET credits = credits - 10 WHERE id = ?', [req.userId]);
            
            // 记录投票快照
            db.get('SELECT yes_votes, no_votes FROM topics WHERE id = ?', [topicId], (err, topic) => {
              if (topic) {
                db.run('INSERT INTO vote_snapshots (topic_id, yes_votes, no_votes) VALUES (?, ?, ?)',
                  [topicId, topic.yes_votes, topic.no_votes]
                );
              }
            });
            
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
    SELECT c.*, u.email as user_email, u.role as user_role, c.user_id
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
      
      db.get('SELECT email, role FROM users WHERE id = ?', [req.userId], (err, user) => {
        res.json({ 
          id: this.lastID, 
          content, 
          user_email: user?.email,
          user_role: user?.role,
          created_at: new Date().toISOString()
        });
      });
    }
  );
});

// 关注用户
app.post('/api/users/:id/follow', auth, (req, res) => {
  const followingId = req.params.id;
  
  if (followingId == req.userId) {
    return res.status(400).json({ error: '不能关注自己' });
  }
  
  db.run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)',
    [req.userId, followingId],
    (err) => {
      if (err) return res.status(400).json({ error: '已经关注过了' });
      res.json({ success: true });
    }
  );
});

// 取消关注
app.delete('/api/users/:id/follow', auth, (req, res) => {
  db.run('DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
    [req.userId, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: '取消失败' });
      res.json({ success: true });
    }
  );
});

// 获取用户主页
app.get('/api/users/:id', (req, res) => {
  db.get('SELECT id, email, role, bio, credits FROM users WHERE id = ?', [req.params.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: '用户不存在' });
    
    // 获取投票统计
    db.get(`
      SELECT COUNT(*) as total_votes,
      SUM(CASE WHEN v.vote = 'yes' THEN 1 ELSE 0 END) as yes_count,
      SUM(CASE WHEN v.vote = 'no' THEN 1 ELSE 0 END) as no_count
      FROM votes v WHERE v.user_id = ?
    `, [req.params.id], (err, stats) => {
      user.stats = stats || { total_votes: 0, yes_count: 0, no_count: 0 };
      res.json(user);
    });
  });
});

// 获取投票趋势
app.get('/api/topics/:id/trend', (req, res) => {
  db.all(`
    SELECT yes_votes, no_votes, snapshot_time 
    FROM vote_snapshots 
    WHERE topic_id = ? 
    ORDER BY snapshot_time ASC
  `, [req.params.id], (err, snapshots) => {
    if (err) return res.status(500).json({ error: '获取失败' });
    res.json(snapshots);
  });
});

// 初始化数据库并启动服务器
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
