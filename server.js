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

// ─── 中间件 ────────────────────────────────────────────────────────────────

// 普通认证中间件
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

// 管理员认证中间件
const adminAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    db.get('SELECT is_admin FROM users WHERE id = ?', [req.userId], (err, user) => {
      if (err || !user || !user.is_admin) {
        return res.status(403).json({ error: '无管理员权限' });
      }
      next();
    });
  } catch (err) {
    res.status(401).json({ error: '登录已过期' });
  }
};

// ─── 用户相关 ───────────────────────────────────────────────────────────────

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
      if (err) return res.status(400).json({ error: '邮箱已存在' });
      const token = jwt.sign({ userId: this.lastID }, JWT_SECRET);
      res.json({ token, credits: 1000, email, role, id: this.lastID });
    }
  );
});

// 登录
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: '邮箱或密码错误' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: '邮箱或密码错误' });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ token, credits: user.credits, email: user.email, role: user.role || 'other', id: user.id, is_admin: user.is_admin || 0 });
  });
});

// 获取当前用户信息
app.get('/api/me', auth, (req, res) => {
  db.get('SELECT id, email, credits, role, bio, is_admin FROM users WHERE id = ?', [req.userId], (err, user) => {
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

// 获取用户主页
app.get('/api/users/:id', (req, res) => {
  db.get('SELECT id, email, role, bio, credits FROM users WHERE id = ?', [req.params.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: '用户不存在' });
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

// ─── 话题相关 ───────────────────────────────────────────────────────────────

// 获取话题列表（带热度排序 + 搜索 + 分类筛选）
app.get('/api/topics', (req, res) => {
  const { category, sort = 'hot', search } = req.query;
  let query = `
    SELECT t.*, u.email as creator_email, u.role as creator_role,
    (t.total_participants * 2 + (ABS(t.yes_votes - t.no_votes) * 0.5)) as hotness
    FROM topics t
    LEFT JOIN users u ON t.creator_id = u.id
  `;
  const conditions = [];
  const params = [];
  if (category && category !== 'all') {
    conditions.push('t.category = ?');
    params.push(category);
  }
  if (search && search.trim()) {
    conditions.push('(t.title LIKE ? OR t.description LIKE ?)');
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }
  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
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
  if (!title) return res.status(400).json({ error: '标题不能为空' });
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
  if (!['yes', 'no'].includes(vote)) return res.status(400).json({ error: '无效的投票' });

  db.get('SELECT * FROM topics WHERE id = ?', [topicId], (err, topic) => {
    if (err || !topic) return res.status(404).json({ error: '话题不存在' });
    if (topic.status === 'settled') return res.status(400).json({ error: '该话题已结算，无法投票' });

    db.get('SELECT credits FROM users WHERE id = ?', [req.userId], (err, user) => {
      if (err || !user) return res.status(404).json({ error: '用户不存在' });
      if (user.credits < 10) return res.status(400).json({ error: '积分不足' });

      db.get('SELECT * FROM votes WHERE topic_id = ? AND user_id = ?', [topicId, req.userId], (err, existingVote) => {
        if (existingVote) return res.status(400).json({ error: '已经投过票了' });

        db.run('INSERT INTO votes (topic_id, user_id, vote) VALUES (?, ?, ?)', [topicId, req.userId, vote], (err) => {
          if (err) return res.status(500).json({ error: '投票失败' });

          const voteField = vote === 'yes' ? 'yes_votes' : 'no_votes';
          db.run(`UPDATE topics SET ${voteField} = ${voteField} + 1, total_participants = total_participants + 1 WHERE id = ?`, [topicId]);
          db.run('UPDATE users SET credits = credits - 10 WHERE id = ?', [req.userId]);

          // 记录投票快照
          db.get('SELECT yes_votes, no_votes FROM topics WHERE id = ?', [topicId], (err, t) => {
            if (t) {
              db.run('INSERT INTO vote_snapshots (topic_id, yes_votes, no_votes) VALUES (?, ?, ?)',
                [topicId, t.yes_votes, t.no_votes]);
            }
          });

          // 给话题创建者发通知
          if (topic.creator_id && topic.creator_id !== req.userId) {
            db.run(`INSERT INTO notifications (user_id, type, topic_id, from_user_id, message) VALUES (?, 'vote', ?, ?, ?)`,
              [topic.creator_id, topicId, req.userId, `有人在你的话题「${topic.title.slice(0, 20)}...」上投票了`]);
          }

          res.json({ success: true, newCredits: user.credits - 10 });
        });
      });
    });
  });
});

// 获取评论
app.get('/api/topics/:id/comments', (req, res) => {
  db.all(`
    SELECT c.*, u.email as user_email, u.role as user_role, c.user_id
    FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.topic_id = ?
    ORDER BY c.created_at ASC
  `, [req.params.id], (err, comments) => {
    if (err) return res.status(500).json({ error: '获取失败' });
    res.json(comments);
  });
});

// 发表评论（支持 @提及）
app.post('/api/topics/:id/comments', auth, (req, res) => {
  const { content } = req.body;
  const topicId = req.params.id;
  if (!content) return res.status(400).json({ error: '评论内容不能为空' });

  db.run('INSERT INTO comments (topic_id, user_id, content) VALUES (?, ?, ?)',
    [topicId, req.userId, content],
    function(err) {
      if (err) return res.status(500).json({ error: '发表失败' });
      const commentId = this.lastID;

      db.get('SELECT email, role FROM users WHERE id = ?', [req.userId], (err, user) => {
        // 解析 @提及，格式为 @email
        const mentions = content.match(/@([^\s@]+@[^\s@]+)/g);
        if (mentions) {
          mentions.forEach(mention => {
            const mentionedEmail = mention.slice(1);
            db.get('SELECT id FROM users WHERE email = ?', [mentionedEmail], (err, mentionedUser) => {
              if (mentionedUser && mentionedUser.id !== req.userId) {
                db.run(`INSERT INTO notifications (user_id, type, topic_id, from_user_id, message) VALUES (?, 'mention', ?, ?, ?)`,
                  [mentionedUser.id, topicId, req.userId, `${user?.email} 在评论中 @了你`]);
              }
            });
          });
        }

        // 给话题创建者发通知（不是自己评论自己的话题）
        db.get('SELECT creator_id, title FROM topics WHERE id = ?', [topicId], (err, topic) => {
          if (topic && topic.creator_id !== req.userId) {
            db.run(`INSERT INTO notifications (user_id, type, topic_id, from_user_id, message) VALUES (?, 'comment', ?, ?, ?)`,
              [topic.creator_id, topicId, req.userId, `${user?.email} 评论了你的话题「${topic.title.slice(0, 20)}」`]);
          }
        });

        res.json({
          id: commentId,
          content,
          user_email: user?.email,
          user_role: user?.role,
          user_id: req.userId,
          created_at: new Date().toISOString()
        });
      });
    }
  );
});

// 关注用户
app.post('/api/users/:id/follow', auth, (req, res) => {
  const followingId = req.params.id;
  if (followingId == req.userId) return res.status(400).json({ error: '不能关注自己' });

  db.run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)',
    [req.userId, followingId],
    (err) => {
      if (err) return res.status(400).json({ error: '已经关注过了' });

      // 发送关注通知
      db.get('SELECT email FROM users WHERE id = ?', [req.userId], (err, fromUser) => {
        db.run(`INSERT INTO notifications (user_id, type, from_user_id, message) VALUES (?, 'follow', ?, ?)`,
          [followingId, req.userId, `${fromUser?.email} 关注了你`]);
      });

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

// ─── 话题结算 ───────────────────────────────────────────────────────────────

// 管理员结算话题（手动触发）
app.post('/api/topics/:id/settle', adminAuth, (req, res) => {
  const { result } = req.body; // 'yes' or 'no'
  const topicId = req.params.id;

  if (!['yes', 'no'].includes(result)) {
    return res.status(400).json({ error: '结算结果必须是 yes 或 no' });
  }

  db.get('SELECT * FROM topics WHERE id = ?', [topicId], (err, topic) => {
    if (err || !topic) return res.status(404).json({ error: '话题不存在' });
    if (topic.status === 'settled') return res.status(400).json({ error: '话题已经结算过了' });

    // 获取所有投票
    db.all('SELECT * FROM votes WHERE topic_id = ?', [topicId], (err, votes) => {
      if (err) return res.status(500).json({ error: '结算失败' });

      const winners = votes.filter(v => v.vote === result);
      const losers = votes.filter(v => v.vote !== result);

      // 总奖池 = 所有人消耗的积分（每票10分）
      const totalPool = votes.length * 10;
      const winnerCount = winners.length;

      // 更新话题状态
      db.run('UPDATE topics SET status = ?, settlement_result = ? WHERE id = ?',
        ['settled', result, topicId],
        (err) => {
          if (err) return res.status(500).json({ error: '结算失败' });

          if (winnerCount === 0) {
            // 无人猜对，退还所有人积分
            votes.forEach(v => {
              db.run('UPDATE users SET credits = credits + 10 WHERE id = ?', [v.user_id]);
            });
            return res.json({ success: true, message: '无人猜对，已退还所有积分', winners: 0, reward: 0 });
          }

          // 每位胜者获得的积分 = 总奖池 / 胜者数（保留整数）
          const rewardPerWinner = Math.floor(totalPool / winnerCount);
          const remainder = totalPool - rewardPerWinner * winnerCount;

          winners.forEach((v, idx) => {
            const bonus = idx === 0 ? rewardPerWinner + remainder : rewardPerWinner;
            db.run('UPDATE users SET credits = credits + ? WHERE id = ?', [bonus, v.user_id]);

            // 发送结算通知给胜者
            db.run(`INSERT INTO notifications (user_id, type, topic_id, message) VALUES (?, 'settle_win', ?, ?)`,
              [v.user_id, topicId, `🎉 话题「${topic.title.slice(0, 20)}」已结算，你猜对了！获得 ${bonus} 积分`]);
          });

          // 发送结算通知给败者
          losers.forEach(v => {
            db.run(`INSERT INTO notifications (user_id, type, topic_id, message) VALUES (?, 'settle_lose', ?, ?)`,
              [v.user_id, topicId, `话题「${topic.title.slice(0, 20)}」已结算，很遗憾你没有猜对`]);
          });

          res.json({
            success: true,
            message: `结算完成！${winnerCount} 人猜对，每人获得 ${rewardPerWinner} 积分`,
            winners: winnerCount,
            losers: losers.length,
            rewardPerWinner,
            totalPool
          });
        }
      );
    });
  });
});

// ─── 排行榜 ─────────────────────────────────────────────────────────────────

// 获取用户排行榜（按积分排序）
app.get('/api/leaderboard', (req, res) => {
  db.all(`
    SELECT u.id, u.email, u.role, u.credits,
      COUNT(v.id) as total_votes,
      SUM(CASE WHEN v.vote = 'yes' THEN 1 ELSE 0 END) as yes_count,
      (SELECT COUNT(*) FROM votes v2
        JOIN topics t ON v2.topic_id = t.id
        WHERE v2.user_id = u.id AND t.status = 'settled' AND v2.vote = t.settlement_result
      ) as correct_count,
      (SELECT COUNT(*) FROM votes v3
        JOIN topics t ON v3.topic_id = t.id
        WHERE v3.user_id = u.id AND t.status = 'settled'
      ) as settled_votes
    FROM users u
    LEFT JOIN votes v ON u.id = v.user_id
    WHERE u.id != 1
    GROUP BY u.id
    ORDER BY u.credits DESC
    LIMIT 50
  `, [], (err, users) => {
    if (err) return res.status(500).json({ error: '获取失败' });
    res.json(users);
  });
});

// ─── 通知系统 ───────────────────────────────────────────────────────────────

// 获取当前用户通知列表
app.get('/api/notifications', auth, (req, res) => {
  db.all(`
    SELECT n.*, u.email as from_email, u.role as from_role
    FROM notifications n
    LEFT JOIN users u ON n.from_user_id = u.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 50
  `, [req.userId], (err, notifications) => {
    if (err) return res.status(500).json({ error: '获取失败' });
    res.json(notifications);
  });
});

// 获取未读通知数量
app.get('/api/notifications/unread-count', auth, (req, res) => {
  db.get('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
    [req.userId], (err, row) => {
      if (err) return res.status(500).json({ error: '获取失败' });
      res.json({ count: row.count });
    }
  );
});

// 标记所有通知为已读
app.put('/api/notifications/read-all', auth, (req, res) => {
  db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.userId], (err) => {
    if (err) return res.status(500).json({ error: '操作失败' });
    res.json({ success: true });
  });
});

// 标记单条通知为已读
app.put('/api/notifications/:id/read', auth, (req, res) => {
  db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [req.params.id, req.userId], (err) => {
      if (err) return res.status(500).json({ error: '操作失败' });
      res.json({ success: true });
    }
  );
});

// ─── 管理后台 ───────────────────────────────────────────────────────────────

// 获取所有话题（管理员）
app.get('/api/admin/topics', adminAuth, (req, res) => {
  db.all(`
    SELECT t.*, u.email as creator_email,
    (SELECT COUNT(*) FROM votes WHERE topic_id = t.id) as vote_count
    FROM topics t
    LEFT JOIN users u ON t.creator_id = u.id
    ORDER BY t.created_at DESC
  `, [], (err, topics) => {
    if (err) return res.status(500).json({ error: '获取失败' });
    res.json(topics);
  });
});

// 获取所有用户（管理员）
app.get('/api/admin/users', adminAuth, (req, res) => {
  db.all(`
    SELECT u.id, u.email, u.role, u.credits, u.is_admin, u.created_at,
    COUNT(v.id) as total_votes
    FROM users u
    LEFT JOIN votes v ON u.id = v.user_id
    WHERE u.id != 1
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `, [], (err, users) => {
    if (err) return res.status(500).json({ error: '获取失败' });
    res.json(users);
  });
});

// 删除话题（管理员）
app.delete('/api/admin/topics/:id', adminAuth, (req, res) => {
  db.run('DELETE FROM topics WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: '删除失败' });
    res.json({ success: true });
  });
});

// 调整用户积分（管理员）
app.put('/api/admin/users/:id/credits', adminAuth, (req, res) => {
  const { credits } = req.body;
  db.run('UPDATE users SET credits = ? WHERE id = ?', [credits, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: '更新失败' });
    res.json({ success: true });
  });
});

// 设置/取消管理员（管理员）
app.put('/api/admin/users/:id/admin', adminAuth, (req, res) => {
  const { is_admin } = req.body;
  db.run('UPDATE users SET is_admin = ? WHERE id = ?', [is_admin ? 1 : 0, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: '更新失败' });
    res.json({ success: true });
  });
});

// ─── 数据导出 ───────────────────────────────────────────────────────────────

// 导出话题数据（CSV 格式）
app.get('/api/export/topics', adminAuth, (req, res) => {
  db.all(`
    SELECT t.id, t.title, t.category, t.yes_votes, t.no_votes, t.total_participants,
    t.status, t.settlement_result, t.settlement_date, t.created_at,
    u.email as creator_email
    FROM topics t
    LEFT JOIN users u ON t.creator_id = u.id
    ORDER BY t.created_at DESC
  `, [], (err, topics) => {
    if (err) return res.status(500).json({ error: '导出失败' });

    const headers = ['ID', '标题', '分类', '看涨票数', '看跌票数', '参与人数', '状态', '结算结果', '结算日期', '创建时间', '创建者'];
    const rows = topics.map(t => [
      t.id, `"${(t.title || '').replace(/"/g, '""')}"`, t.category,
      t.yes_votes, t.no_votes, t.total_participants,
      t.status, t.settlement_result || '', t.settlement_date || '', t.created_at, t.creator_email || ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="topics.csv"');
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8
  });
});

// 导出用户数据（CSV 格式）
app.get('/api/export/users', adminAuth, (req, res) => {
  db.all(`
    SELECT u.id, u.email, u.role, u.credits, u.created_at,
    COUNT(v.id) as total_votes
    FROM users u
    LEFT JOIN votes v ON u.id = v.user_id
    WHERE u.id != 1
    GROUP BY u.id
    ORDER BY u.credits DESC
  `, [], (err, users) => {
    if (err) return res.status(500).json({ error: '导出失败' });

    const headers = ['ID', '邮箱', '身份', '积分', '注册时间', '总投票数'];
    const rows = users.map(u => [u.id, u.email, u.role, u.credits, u.created_at, u.total_votes]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.send('\uFEFF' + csv);
  });
});

// ─── 获取可 @ 的用户列表（用于前端自动补全）────────────────────────────────

app.get('/api/users/search', auth, (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  db.all(`SELECT id, email, role FROM users WHERE email LIKE ? AND id != ? LIMIT 10`,
    [`%${q}%`, req.userId], (err, users) => {
      if (err) return res.json([]);
      res.json(users);
    }
  );
});

// ─── 初始化管理员（一次性接口，使用 ADMIN_INIT_KEY 环境变量保护）────────────────
// 调用方式: POST /api/init-admin  body: { email, key }
app.post('/api/init-admin', (req, res) => {
  const { email, key } = req.body;
  const ADMIN_KEY = process.env.ADMIN_INIT_KEY || 'init-admin-2026';
  if (key !== ADMIN_KEY) return res.status(403).json({ error: '密钥错误' });
  db.run('UPDATE users SET is_admin = 1 WHERE email = ?', [email], function(err) {
    if (err) return res.status(500).json({ error: '操作失败' });
    if (this.changes === 0) return res.status(404).json({ error: '用户不存在' });
    res.json({ success: true, message: `${email} 已设置为管理员` });
  });
});

// ─── 启动 ────────────────────────────────────────────────────────────────────

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
