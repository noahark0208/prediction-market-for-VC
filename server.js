const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false
});

const db = {
  query: (text, params) => pool.query(text, params),
  get: async (text, params) => {
    const res = await pool.query(text, params);
    return res.rows[0] || null;
  },
  all: async (text, params) => {
    const res = await pool.query(text, params);
    return res.rows;
  },
  run: async (text, params) => {
    const res = await pool.query(text, params);
    return res;
  }
};

// ─── 数据库初始化 ─────────────────────────────────────────────────────────────

async function initDatabase() {
  // 用户表
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

  // 话题表（新增 topic_type 字段：binary=二选一, multi=多选项）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS topics (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'other',
      topic_type TEXT DEFAULT 'binary',
      yes_votes INTEGER DEFAULT 0,
      no_votes INTEGER DEFAULT 0,
      total_participants INTEGER DEFAULT 0,
      total_pool INTEGER DEFAULT 0,
      creator_id INTEGER REFERENCES users(id),
      settlement_date TEXT,
      status TEXT DEFAULT 'active',
      settlement_result TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 多选项表（仅 multi 类型话题使用）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS topic_options (
      id SERIAL PRIMARY KEY,
      topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      vote_count INTEGER DEFAULT 0,
      display_order INTEGER DEFAULT 0
    )
  `);

  // 投票/持仓表（扩展：支持多选项、追加、平仓）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      vote TEXT NOT NULL,
      option_id INTEGER REFERENCES topic_options(id) ON DELETE SET NULL,
      credits_spent INTEGER DEFAULT 10,
      shares NUMERIC DEFAULT 1,
      avg_price NUMERIC DEFAULT 0.5,
      is_closed INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 交易记录表（每次追加/平仓都记录）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trades (
      id SERIAL PRIMARY KEY,
      topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      vote_id INTEGER REFERENCES votes(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      vote TEXT NOT NULL,
      option_id INTEGER,
      credits INTEGER NOT NULL,
      shares NUMERIC NOT NULL,
      price NUMERIC NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS follows (
      id SERIAL PRIMARY KEY,
      follower_id INTEGER REFERENCES users(id),
      following_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(follower_id, following_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vote_snapshots (
      id SERIAL PRIMARY KEY,
      topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
      yes_votes INTEGER DEFAULT 0,
      no_votes INTEGER DEFAULT 0,
      snapshot_time TIMESTAMP DEFAULT NOW()
    )
  `);

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

  console.log('✅ PostgreSQL 数据库初始化完成');
}

// ─── 价格计算（LMSR 简化版）────────────────────────────────────────────────────
// 基于当前 yes/no 票数计算隐含概率（市场价格）
function calcPrice(yesVotes, noVotes) {
  const total = yesVotes + noVotes;
  if (total === 0) return { yes: 0.5, no: 0.5 };
  return {
    yes: parseFloat((yesVotes / total).toFixed(4)),
    no: parseFloat((noVotes / total).toFixed(4))
  };
}

function calcOptionPrice(optionVotes, totalVotes) {
  if (totalVotes === 0) return 0.5;
  return parseFloat((optionVotes / totalVotes).toFixed(4));
}

// ─── 中间件 ────────────────────────────────────────────────────────────────

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

const adminAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    const user = await db.get('SELECT is_admin FROM users WHERE id = $1', [req.userId]);
    if (!user || !user.is_admin) {
      return res.status(403).json({ error: '无管理员权限' });
    }
    next();
  } catch (err) {
    res.status(401).json({ error: '登录已过期' });
  }
};

// ─── 用户相关 ───────────────────────────────────────────────────────────────

app.post('/api/register', async (req, res) => {
  const { email, password, role = 'other' } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: '邮箱和密码不能为空' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id',
      [email, hashedPassword, role]
    );
    const userId = result.rows[0].id;
    const token = jwt.sign({ userId }, JWT_SECRET);
    res.json({ token, credits: 1000, email, role, id: userId });
  } catch (err) {
    res.status(400).json({ error: '邮箱已存在' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await db.get('SELECT * FROM users WHERE email = $1', [email]);
    if (!user) return res.status(400).json({ error: '邮箱或密码错误' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: '邮箱或密码错误' });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ token, credits: user.credits, email: user.email, role: user.role || 'other', id: user.id, is_admin: user.is_admin || 0 });
  } catch (err) {
    res.status(500).json({ error: '登录失败' });
  }
});

app.get('/api/me', auth, async (req, res) => {
  try {
    const user = await db.get('SELECT id, email, credits, role, bio, is_admin FROM users WHERE id = $1', [req.userId]);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: '获取失败' });
  }
});

app.put('/api/me', auth, async (req, res) => {
  const { role, bio } = req.body;
  try {
    await db.run('UPDATE users SET role = $1, bio = $2 WHERE id = $3', [role, bio, req.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '更新失败' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await db.get('SELECT id, email, role, bio, credits FROM users WHERE id = $1', [req.params.id]);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const stats = await db.get(`
      SELECT COUNT(*) as total_votes,
      SUM(CASE WHEN v.vote = 'yes' THEN 1 ELSE 0 END) as yes_count,
      SUM(CASE WHEN v.vote = 'no' THEN 1 ELSE 0 END) as no_count
      FROM votes v WHERE v.user_id = $1 AND v.is_closed = 0
    `, [req.params.id]);
    user.stats = stats || { total_votes: 0, yes_count: 0, no_count: 0 };
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: '获取失败' });
  }
});

// ─── 话题相关 ───────────────────────────────────────────────────────────────

app.get('/api/topics', async (req, res) => {
  const { category, sort = 'hot', search } = req.query;
  let query = `
    SELECT t.*, u.email as creator_email, u.role as creator_role,
    (t.total_participants * 2 + (ABS(t.yes_votes - t.no_votes) * 0.5)) as hotness
    FROM topics t
    LEFT JOIN users u ON t.creator_id = u.id
  `;
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (category && category !== 'all') {
    conditions.push(`t.category = $${paramIdx++}`);
    params.push(category);
  }
  if (search && search.trim()) {
    conditions.push(`(t.title ILIKE $${paramIdx} OR t.description ILIKE $${paramIdx + 1})`);
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    paramIdx += 2;
  }
  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
  query += sort === 'hot' ? ' ORDER BY hotness DESC, t.created_at DESC' : ' ORDER BY t.created_at DESC';

  try {
    const topics = await db.all(query, params);
    res.json(topics);
  } catch (err) {
    res.status(500).json({ error: '获取失败' });
  }
});

// 创建话题（支持 binary 和 multi 两种类型）
app.post('/api/topics', auth, async (req, res) => {
  const { title, description, category = 'other', settlement_date, topic_type = 'binary', options = [] } = req.body;
  if (!title) return res.status(400).json({ error: '标题不能为空' });
  if (topic_type === 'multi' && options.length < 2) {
    return res.status(400).json({ error: '多选项话题至少需要2个选项' });
  }
  try {
    const result = await db.query(
      'INSERT INTO topics (title, description, category, settlement_date, creator_id, topic_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [title, description, category, settlement_date, req.userId, topic_type]
    );
    const topicId = result.rows[0].id;

    if (topic_type === 'multi') {
      for (let i = 0; i < options.length; i++) {
        await db.query(
          'INSERT INTO topic_options (topic_id, label, display_order) VALUES ($1, $2, $3)',
          [topicId, options[i], i]
        );
      }
    }

    res.json({ id: topicId, title, description, category, topic_type });
  } catch (err) {
    res.status(500).json({ error: '创建失败' });
  }
});

// 获取话题详情（含选项、当前价格、用户持仓）
app.get('/api/topics/:id', async (req, res) => {
  try {
    const topic = await db.get(`
      SELECT t.*, u.email as creator_email, u.role as creator_role
      FROM topics t
      LEFT JOIN users u ON t.creator_id = u.id
      WHERE t.id = $1
    `, [req.params.id]);
    if (!topic) return res.status(404).json({ error: '话题不存在' });

    // 附加选项（multi 类型）
    if (topic.topic_type === 'multi') {
      topic.options = await db.all(
        'SELECT * FROM topic_options WHERE topic_id = $1 ORDER BY display_order',
        [req.params.id]
      );
      const totalOptionVotes = topic.options.reduce((s, o) => s + (o.vote_count || 0), 0);
      topic.options = topic.options.map(o => ({
        ...o,
        price: calcOptionPrice(o.vote_count, totalOptionVotes)
      }));
    }

    // 附加当前市场价格
    topic.prices = calcPrice(topic.yes_votes, topic.no_votes);

    res.json(topic);
  } catch (err) {
    res.status(500).json({ error: '获取失败' });
  }
});

// 编辑话题（管理员）
app.put('/api/topics/:id', adminAuth, async (req, res) => {
  const { title, description, category, settlement_date } = req.body;
  try {
    await db.query(
      'UPDATE topics SET title=$1, description=$2, category=$3, settlement_date=$4 WHERE id=$5',
      [title, description, category, settlement_date, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '更新失败' });
  }
});

// 获取用户在某话题的持仓
app.get('/api/topics/:id/position', auth, async (req, res) => {
  try {
    const votes = await db.all(`
      SELECT v.*, o.label as option_label
      FROM votes v
      LEFT JOIN topic_options o ON v.option_id = o.id
      WHERE v.topic_id = $1 AND v.user_id = $2
      ORDER BY v.created_at ASC
    `, [req.params.id, req.userId]);

    const topic = await db.get('SELECT yes_votes, no_votes, topic_type FROM topics WHERE id = $1', [req.params.id]);
    const prices = calcPrice(topic.yes_votes, topic.no_votes);

    // 汇总持仓
    const positions = {};
    for (const v of votes) {
      if (v.is_closed) continue;
      const key = v.option_id ? `option_${v.option_id}` : v.vote;
      if (!positions[key]) {
        positions[key] = {
          vote: v.vote,
          option_id: v.option_id,
          option_label: v.option_label,
          total_credits: 0,
          total_shares: 0,
          avg_price: 0
        };
      }
      positions[key].total_credits += v.credits_spent;
      positions[key].total_shares += parseFloat(v.shares);
    }

    // 计算均价和当前市值
    const positionList = Object.values(positions).map(p => {
      p.avg_price = p.total_shares > 0 ? p.total_credits / p.total_shares / 10 : 0;
      const currentPrice = p.option_id ? 0.5 : prices[p.vote];
      p.current_price = currentPrice;
      p.current_value = Math.round(p.total_shares * currentPrice * 10);
      p.pnl = p.current_value - p.total_credits;
      return p;
    });

    res.json({ positions: positionList, prices });
  } catch (err) {
    res.status(500).json({ error: '获取失败' });
  }
});

// ─── 投票（首次建仓）────────────────────────────────────────────────────────

app.post('/api/topics/:id/vote', auth, async (req, res) => {
  const { vote, option_id, credits = 10 } = req.body;
  const topicId = req.params.id;

  try {
    const topic = await db.get('SELECT * FROM topics WHERE id = $1', [topicId]);
    if (!topic) return res.status(404).json({ error: '话题不存在' });
    if (topic.status === 'settled') return res.status(400).json({ error: '该话题已结算，无法投票' });

    const user = await db.get('SELECT credits FROM users WHERE id = $1', [req.userId]);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    const betCredits = Math.max(10, parseInt(credits) || 10);
    if (user.credits < betCredits) return res.status(400).json({ error: '积分不足' });

    if (topic.topic_type === 'multi') {
      // 多选项话题
      if (!option_id) return res.status(400).json({ error: '请选择一个选项' });
      const option = await db.get('SELECT * FROM topic_options WHERE id = $1 AND topic_id = $2', [option_id, topicId]);
      if (!option) return res.status(400).json({ error: '选项不存在' });

      // 检查是否已投此选项（允许追加，不允许重复建仓同一选项）
      const existingVote = await db.get(
        'SELECT * FROM votes WHERE topic_id = $1 AND user_id = $2 AND option_id = $3 AND is_closed = 0',
        [topicId, req.userId, option_id]
      );

      const totalOptionVotes = await db.get('SELECT SUM(vote_count) as total FROM topic_options WHERE topic_id = $1', [topicId]);
      const totalVotes = parseInt(totalOptionVotes?.total || 0);
      const currentPrice = calcOptionPrice(option.vote_count, totalVotes);
      const shares = betCredits / (currentPrice * 10 || 1);

      if (existingVote) {
        // 追加仓位
        await db.run(
          'UPDATE votes SET credits_spent = credits_spent + $1, shares = shares + $2, updated_at = NOW() WHERE id = $3',
          [betCredits, shares, existingVote.id]
        );
        await db.run(
          'INSERT INTO trades (topic_id, user_id, vote_id, action, vote, option_id, credits, shares, price) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [topicId, req.userId, existingVote.id, 'add', option.label, option_id, betCredits, shares, currentPrice]
        );
      } else {
        // 新建仓
        const voteResult = await db.query(
          'INSERT INTO votes (topic_id, user_id, vote, option_id, credits_spent, shares, avg_price) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
          [topicId, req.userId, option.label, option_id, betCredits, shares, currentPrice]
        );
        await db.run(
          'INSERT INTO trades (topic_id, user_id, vote_id, action, vote, option_id, credits, shares, price) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [topicId, req.userId, voteResult.rows[0].id, 'open', option.label, option_id, betCredits, shares, currentPrice]
        );
        // 新参与者
        await db.run('UPDATE topics SET total_participants = total_participants + 1 WHERE id = $1', [topicId]);
      }

      await db.run('UPDATE topic_options SET vote_count = vote_count + $1 WHERE id = $2', [shares, option_id]);
      await db.run('UPDATE topics SET total_pool = total_pool + $1 WHERE id = $2', [betCredits, topicId]);
      await db.run('UPDATE users SET credits = credits - $1 WHERE id = $2', [betCredits, req.userId]);

    } else {
      // 二元话题（binary）
      if (!['yes', 'no'].includes(vote)) return res.status(400).json({ error: '无效的投票' });

      const existingVote = await db.get(
        'SELECT * FROM votes WHERE topic_id = $1 AND user_id = $2 AND is_closed = 0',
        [topicId, req.userId]
      );

      const prices = calcPrice(topic.yes_votes, topic.no_votes);
      const currentPrice = prices[vote];
      const shares = betCredits / (currentPrice * 10 || 5);

      if (existingVote) {
        if (existingVote.vote !== vote) {
          return res.status(400).json({ error: '已持有反向仓位，请先平仓再建仓' });
        }
        // 追加同向仓位
        await db.run(
          'UPDATE votes SET credits_spent = credits_spent + $1, shares = shares + $2, updated_at = NOW() WHERE id = $3',
          [betCredits, shares, existingVote.id]
        );
        await db.run(
          'INSERT INTO trades (topic_id, user_id, vote_id, action, vote, credits, shares, price) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [topicId, req.userId, existingVote.id, 'add', vote, betCredits, shares, currentPrice]
        );
      } else {
        // 新建仓
        const voteResult = await db.query(
          'INSERT INTO votes (topic_id, user_id, vote, credits_spent, shares, avg_price) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
          [topicId, req.userId, vote, betCredits, shares, currentPrice]
        );
        await db.run(
          'INSERT INTO trades (topic_id, user_id, vote_id, action, vote, credits, shares, price) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [topicId, req.userId, voteResult.rows[0].id, 'open', vote, betCredits, shares, currentPrice]
        );
        await db.run('UPDATE topics SET total_participants = total_participants + 1 WHERE id = $1', [topicId]);
      }

      const voteField = vote === 'yes' ? 'yes_votes' : 'no_votes';
      await db.run(`UPDATE topics SET ${voteField} = ${voteField} + $1, total_pool = total_pool + $2 WHERE id = $3`,
        [shares, betCredits, topicId]);
      await db.run('UPDATE users SET credits = credits - $1 WHERE id = $2', [betCredits, req.userId]);

      // 记录快照
      const updatedTopic = await db.get('SELECT yes_votes, no_votes FROM topics WHERE id = $1', [topicId]);
      if (updatedTopic) {
        await db.run('INSERT INTO vote_snapshots (topic_id, yes_votes, no_votes) VALUES ($1, $2, $3)',
          [topicId, updatedTopic.yes_votes, updatedTopic.no_votes]);
      }

      // 通知话题创建者
      if (topic.creator_id && topic.creator_id !== req.userId) {
        await db.run(
          `INSERT INTO notifications (user_id, type, topic_id, from_user_id, message) VALUES ($1, 'vote', $2, $3, $4)`,
          [topic.creator_id, topicId, req.userId, `有人在你的话题「${topic.title.slice(0, 20)}」上投票了`]
        );
      }
    }

    const updatedUser = await db.get('SELECT credits FROM users WHERE id = $1', [req.userId]);
    res.json({ success: true, newCredits: updatedUser.credits });
  } catch (err) {
    console.error('投票失败:', err);
    res.status(500).json({ error: '投票失败: ' + err.message });
  }
});

// ─── 平仓（卖出持仓）────────────────────────────────────────────────────────

app.post('/api/topics/:id/close-position', auth, async (req, res) => {
  const { vote, option_id } = req.body;
  const topicId = req.params.id;

  try {
    const topic = await db.get('SELECT * FROM topics WHERE id = $1', [topicId]);
    if (!topic) return res.status(404).json({ error: '话题不存在' });
    if (topic.status === 'settled') return res.status(400).json({ error: '话题已结算，无法平仓' });

    let existingVote;
    if (option_id) {
      existingVote = await db.get(
        'SELECT * FROM votes WHERE topic_id = $1 AND user_id = $2 AND option_id = $3 AND is_closed = 0',
        [topicId, req.userId, option_id]
      );
    } else {
      existingVote = await db.get(
        'SELECT * FROM votes WHERE topic_id = $1 AND user_id = $2 AND vote = $3 AND is_closed = 0',
        [topicId, req.userId, vote]
      );
    }

    if (!existingVote) return res.status(404).json({ error: '没有找到持仓' });

    // 按当前市场价格计算平仓收益
    let currentPrice;
    if (option_id) {
      const option = await db.get('SELECT vote_count FROM topic_options WHERE id = $1', [option_id]);
      const totalOptionVotes = await db.get('SELECT SUM(vote_count) as total FROM topic_options WHERE topic_id = $1', [topicId]);
      currentPrice = calcOptionPrice(option.vote_count, parseInt(totalOptionVotes?.total || 0));
    } else {
      const prices = calcPrice(topic.yes_votes, topic.no_votes);
      currentPrice = prices[vote];
    }

    const shares = parseFloat(existingVote.shares);
    const returnCredits = Math.round(shares * currentPrice * 10);

    // 平仓：标记为已关闭，退还按市价计算的积分
    await db.run('UPDATE votes SET is_closed = 1, updated_at = NOW() WHERE id = $1', [existingVote.id]);
    await db.run('UPDATE users SET credits = credits + $1 WHERE id = $2', [returnCredits, req.userId]);

    // 更新话题票数（减去平仓份额）
    if (option_id) {
      await db.run('UPDATE topic_options SET vote_count = GREATEST(0, vote_count - $1) WHERE id = $2', [shares, option_id]);
    } else {
      const voteField = vote === 'yes' ? 'yes_votes' : 'no_votes';
      await db.run(`UPDATE topics SET ${voteField} = GREATEST(0, ${voteField} - $1) WHERE id = $2`, [shares, topicId]);
    }
    await db.run('UPDATE topics SET total_pool = GREATEST(0, total_pool - $1) WHERE id = $2',
      [existingVote.credits_spent, topicId]);

    // 记录交易
    await db.run(
      'INSERT INTO trades (topic_id, user_id, vote_id, action, vote, option_id, credits, shares, price) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [topicId, req.userId, existingVote.id, 'close', vote || existingVote.vote, option_id || null, returnCredits, shares, currentPrice]
    );

    const updatedUser = await db.get('SELECT credits FROM users WHERE id = $1', [req.userId]);
    const pnl = returnCredits - existingVote.credits_spent;
    res.json({
      success: true,
      returnCredits,
      pnl,
      newCredits: updatedUser.credits,
      message: `平仓成功，获得 ${returnCredits} 积分（${pnl >= 0 ? '+' : ''}${pnl}）`
    });
  } catch (err) {
    console.error('平仓失败:', err);
    res.status(500).json({ error: '平仓失败: ' + err.message });
  }
});

// 获取话题交易历史
app.get('/api/topics/:id/trades', async (req, res) => {
  try {
    const trades = await db.all(`
      SELECT tr.*, u.email as user_email, u.role as user_role
      FROM trades tr
      LEFT JOIN users u ON tr.user_id = u.id
      WHERE tr.topic_id = $1
      ORDER BY tr.created_at DESC
      LIMIT 50
    `, [req.params.id]);
    res.json(trades);
  } catch (err) {
    res.status(500).json({ error: '获取失败' });
  }
});

// 获取评论
app.get('/api/topics/:id/comments', async (req, res) => {
  try {
    const comments = await db.all(`
      SELECT c.*, u.email as user_email, u.role as user_role, c.user_id
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.topic_id = $1
      ORDER BY c.created_at ASC
    `, [req.params.id]);
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: '获取失败' });
  }
});

// 发表评论（支持 @提及）
app.post('/api/topics/:id/comments', auth, async (req, res) => {
  const { content } = req.body;
  const topicId = req.params.id;
  if (!content) return res.status(400).json({ error: '评论内容不能为空' });

  try {
    const result = await db.query(
      'INSERT INTO comments (topic_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
      [topicId, req.userId, content]
    );
    const commentId = result.rows[0].id;
    const user = await db.get('SELECT email, role FROM users WHERE id = $1', [req.userId]);

    const mentions = content.match(/@([^\s@]+@[^\s@]+)/g);
    if (mentions) {
      for (const mention of mentions) {
        const mentionedEmail = mention.slice(1);
        const mentionedUser = await db.get('SELECT id FROM users WHERE email = $1', [mentionedEmail]);
        if (mentionedUser && mentionedUser.id !== req.userId) {
          await db.run(
            `INSERT INTO notifications (user_id, type, topic_id, from_user_id, message) VALUES ($1, 'mention', $2, $3, $4)`,
            [mentionedUser.id, topicId, req.userId, `${user?.email} 在评论中 @了你`]
          );
        }
      }
    }

    const topic = await db.get('SELECT creator_id, title FROM topics WHERE id = $1', [topicId]);
    if (topic && topic.creator_id !== req.userId) {
      await db.run(
        `INSERT INTO notifications (user_id, type, topic_id, from_user_id, message) VALUES ($1, 'comment', $2, $3, $4)`,
        [topic.creator_id, topicId, req.userId, `${user?.email} 评论了你的话题「${topic.title.slice(0, 20)}」`]
      );
    }

    res.json({
      id: commentId,
      content,
      user_email: user?.email,
      user_role: user?.role,
      user_id: req.userId,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: '发表失败' });
  }
});

// 关注用户
app.post('/api/users/:id/follow', auth, async (req, res) => {
  const followingId = req.params.id;
  if (followingId == req.userId) return res.status(400).json({ error: '不能关注自己' });
  try {
    await db.run('INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)', [req.userId, followingId]);
    const fromUser = await db.get('SELECT email FROM users WHERE id = $1', [req.userId]);
    await db.run(
      `INSERT INTO notifications (user_id, type, from_user_id, message) VALUES ($1, 'follow', $2, $3)`,
      [followingId, req.userId, `${fromUser?.email} 关注了你`]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: '已经关注过了' });
  }
});

app.delete('/api/users/:id/follow', auth, async (req, res) => {
  try {
    await db.run('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [req.userId, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '取消失败' });
  }
});

// 获取投票趋势
app.get('/api/topics/:id/trend', async (req, res) => {
  try {
    const snapshots = await db.all(`
      SELECT yes_votes, no_votes, snapshot_time
      FROM vote_snapshots
      WHERE topic_id = $1
      ORDER BY snapshot_time ASC
    `, [req.params.id]);
    res.json(snapshots);
  } catch (err) {
    res.status(500).json({ error: '获取失败' });
  }
});

// ─── 话题结算 ───────────────────────────────────────────────────────────────

app.post('/api/topics/:id/settle', adminAuth, async (req, res) => {
  const { result, option_id } = req.body;
  const topicId = req.params.id;

  try {
    const topic = await db.get('SELECT * FROM topics WHERE id = $1', [topicId]);
    if (!topic) return res.status(404).json({ error: '话题不存在' });
    if (topic.status === 'settled') return res.status(400).json({ error: '话题已经结算过了' });

    if (topic.topic_type === 'multi') {
      // 多选项结算
      if (!option_id) return res.status(400).json({ error: '请指定获胜选项' });
      const winOption = await db.get('SELECT * FROM topic_options WHERE id = $1 AND topic_id = $2', [option_id, topicId]);
      if (!winOption) return res.status(400).json({ error: '选项不存在' });

      const allVotes = await db.all('SELECT * FROM votes WHERE topic_id = $1 AND is_closed = 0', [topicId]);
      const winners = allVotes.filter(v => v.option_id == option_id);
      const losers = allVotes.filter(v => v.option_id != option_id);
      const totalPool = allVotes.reduce((s, v) => s + v.credits_spent, 0);
      const winnerCount = winners.length;

      await db.run('UPDATE topics SET status = $1, settlement_result = $2 WHERE id = $3',
        ['settled', winOption.label, topicId]);

      if (winnerCount === 0) {
        for (const v of allVotes) {
          await db.run('UPDATE users SET credits = credits + $1 WHERE id = $2', [v.credits_spent, v.user_id]);
        }
        return res.json({ success: true, message: '无人猜对，已退还所有积分', winners: 0 });
      }

      const rewardPerShare = totalPool / winners.reduce((s, v) => s + parseFloat(v.shares), 0);
      for (const v of winners) {
        const reward = Math.round(parseFloat(v.shares) * rewardPerShare);
        await db.run('UPDATE users SET credits = credits + $1 WHERE id = $2', [reward, v.user_id]);
        await db.run(
          `INSERT INTO notifications (user_id, type, topic_id, message) VALUES ($1, 'settle_win', $2, $3)`,
          [v.user_id, topicId, `🎉 话题「${topic.title.slice(0, 20)}」已结算，你押中了「${winOption.label}」！获得 ${reward} 积分`]
        );
      }
      for (const v of losers) {
        await db.run(
          `INSERT INTO notifications (user_id, type, topic_id, message) VALUES ($1, 'settle_lose', $2, $3)`,
          [v.user_id, topicId, `话题「${topic.title.slice(0, 20)}」已结算，获胜选项是「${winOption.label}」，很遗憾你没有猜对`]
        );
      }
      res.json({ success: true, message: `结算完成！获胜选项：${winOption.label}，${winnerCount} 人猜对`, winners: winnerCount });

    } else {
      // 二元结算
      if (!['yes', 'no'].includes(result)) {
        return res.status(400).json({ error: '结算结果必须是 yes 或 no' });
      }

      const votes = await db.all('SELECT * FROM votes WHERE topic_id = $1 AND is_closed = 0', [topicId]);
      const winners = votes.filter(v => v.vote === result);
      const losers = votes.filter(v => v.vote !== result);
      const totalPool = votes.reduce((s, v) => s + v.credits_spent, 0);
      const winnerCount = winners.length;

      await db.run('UPDATE topics SET status = $1, settlement_result = $2 WHERE id = $3',
        ['settled', result, topicId]);

      if (winnerCount === 0) {
        for (const v of votes) {
          await db.run('UPDATE users SET credits = credits + $1 WHERE id = $2', [v.credits_spent, v.user_id]);
        }
        return res.json({ success: true, message: '无人猜对，已退还所有积分', winners: 0, reward: 0 });
      }

      const totalWinnerShares = winners.reduce((s, v) => s + parseFloat(v.shares), 0);
      const rewardPerShare = totalPool / totalWinnerShares;

      for (const v of winners) {
        const bonus = Math.round(parseFloat(v.shares) * rewardPerShare);
        await db.run('UPDATE users SET credits = credits + $1 WHERE id = $2', [bonus, v.user_id]);
        await db.run(
          `INSERT INTO notifications (user_id, type, topic_id, message) VALUES ($1, 'settle_win', $2, $3)`,
          [v.user_id, topicId, `🎉 话题「${topic.title.slice(0, 20)}」已结算，你猜对了！获得 ${bonus} 积分`]
        );
      }
      for (const v of losers) {
        await db.run(
          `INSERT INTO notifications (user_id, type, topic_id, message) VALUES ($1, 'settle_lose', $2, $3)`,
          [v.user_id, topicId, `话题「${topic.title.slice(0, 20)}」已结算，很遗憾你没有猜对`]
        );
      }

      res.json({
        success: true,
        message: `结算完成！${winnerCount} 人猜对`,
        winners: winnerCount,
        losers: losers.length,
        totalPool
      });
    }
  } catch (err) {
    res.status(500).json({ error: '结算失败: ' + err.message });
  }
});

// ─── 排行榜 ─────────────────────────────────────────────────────────────────

app.get('/api/leaderboard', async (req, res) => {
  try {
    const users = await db.all(`
      SELECT u.id, u.email, u.role, u.credits,
        COUNT(v.id) as total_votes,
        (SELECT COUNT(*) FROM votes v2
          JOIN topics t ON v2.topic_id = t.id
          WHERE v2.user_id = u.id AND t.status = 'settled' AND v2.vote = t.settlement_result AND v2.is_closed = 0
        ) as correct_count,
        (SELECT COUNT(*) FROM votes v3
          JOIN topics t ON v3.topic_id = t.id
          WHERE v3.user_id = u.id AND t.status = 'settled' AND v3.is_closed = 0
        ) as settled_votes
      FROM users u
      LEFT JOIN votes v ON u.id = v.user_id AND v.is_closed = 0
      GROUP BY u.id
      ORDER BY u.credits DESC
      LIMIT 50
    `, []);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: '获取失败' });
  }
});

// ─── 通知系统 ───────────────────────────────────────────────────────────────

app.get('/api/notifications', auth, async (req, res) => {
  try {
    const notifications = await db.all(`
      SELECT n.*, u.email as from_email, u.role as from_role
      FROM notifications n
      LEFT JOIN users u ON n.from_user_id = u.id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [req.userId]);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: '获取失败' });
  }
});

app.get('/api/notifications/unread-count', auth, async (req, res) => {
  try {
    const row = await db.get('SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = 0', [req.userId]);
    res.json({ count: parseInt(row.count) });
  } catch (err) {
    res.status(500).json({ error: '获取失败' });
  }
});

app.put('/api/notifications/read-all', auth, async (req, res) => {
  try {
    await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = $1', [req.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '操作失败' });
  }
});

app.put('/api/notifications/:id/read', auth, async (req, res) => {
  try {
    await db.run('UPDATE notifications SET is_read = 1 WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '操作失败' });
  }
});

// ─── 管理后台 ───────────────────────────────────────────────────────────────

app.get('/api/admin/topics', adminAuth, async (req, res) => {
  try {
    const topics = await db.all(`
      SELECT t.*, u.email as creator_email,
      (SELECT COUNT(*) FROM votes WHERE topic_id = t.id AND is_closed = 0) as vote_count
      FROM topics t
      LEFT JOIN users u ON t.creator_id = u.id
      ORDER BY t.created_at DESC
    `, []);
    res.json(topics);
  } catch (err) {
    res.status(500).json({ error: '获取失败' });
  }
});

app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const users = await db.all(`
      SELECT u.id, u.email, u.role, u.credits, u.is_admin, u.created_at,
      COUNT(v.id) as total_votes
      FROM users u
      LEFT JOIN votes v ON u.id = v.user_id AND v.is_closed = 0
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `, []);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: '获取失败' });
  }
});

app.delete('/api/admin/topics/:id', adminAuth, async (req, res) => {
  try {
    await db.run('DELETE FROM topics WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '删除失败' });
  }
});

app.put('/api/admin/users/:id/credits', adminAuth, async (req, res) => {
  const { credits } = req.body;
  try {
    await db.run('UPDATE users SET credits = $1 WHERE id = $2', [credits, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '更新失败' });
  }
});

app.put('/api/admin/users/:id/admin', adminAuth, async (req, res) => {
  const { is_admin } = req.body;
  try {
    await db.run('UPDATE users SET is_admin = $1 WHERE id = $2', [is_admin ? 1 : 0, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '更新失败' });
  }
});

// ─── 数据导出 ───────────────────────────────────────────────────────────────

app.get('/api/export/topics', adminAuth, async (req, res) => {
  try {
    const topics = await db.all(`
      SELECT t.id, t.title, t.category, t.topic_type, t.yes_votes, t.no_votes, t.total_participants,
      t.total_pool, t.status, t.settlement_result, t.settlement_date, t.created_at,
      u.email as creator_email
      FROM topics t
      LEFT JOIN users u ON t.creator_id = u.id
      ORDER BY t.created_at DESC
    `, []);

    const headers = ['ID', '标题', '分类', '类型', '看涨票数', '看跌票数', '参与人数', '总积分池', '状态', '结算结果', '结算日期', '创建时间', '创建者'];
    const rows = topics.map(t => [
      t.id, `"${(t.title || '').replace(/"/g, '""')}"`, t.category, t.topic_type,
      t.yes_votes, t.no_votes, t.total_participants, t.total_pool,
      t.status, t.settlement_result || '', t.settlement_date || '', t.created_at, t.creator_email || ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="topics.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(500).json({ error: '导出失败' });
  }
});

app.get('/api/export/users', adminAuth, async (req, res) => {
  try {
    const users = await db.all(`
      SELECT u.id, u.email, u.role, u.credits, u.created_at,
      COUNT(v.id) as total_votes
      FROM users u
      LEFT JOIN votes v ON u.id = v.user_id AND v.is_closed = 0
      GROUP BY u.id
      ORDER BY u.credits DESC
    `, []);

    const headers = ['ID', '邮箱', '身份', '积分', '注册时间', '总投票数'];
    const rows = users.map(u => [u.id, u.email, u.role, u.credits, u.created_at, u.total_votes]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(500).json({ error: '导出失败' });
  }
});

// ─── 获取可 @ 的用户列表 ────────────────────────────────────────────────────

app.get('/api/users/search', auth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  try {
    const users = await db.all(
      `SELECT id, email, role FROM users WHERE email ILIKE $1 AND id != $2 LIMIT 10`,
      [`%${q}%`, req.userId]
    );
    res.json(users);
  } catch (err) {
    res.json([]);
  }
});

// ─── 初始化管理员（一次性接口）────────────────────────────────────────────────

app.post('/api/init-admin', async (req, res) => {
  const { email, key } = req.body;
  const ADMIN_KEY = process.env.ADMIN_INIT_KEY || 'init-admin-2026';
  if (key !== ADMIN_KEY) return res.status(403).json({ error: '密钥错误' });
  try {
    const result = await db.run('UPDATE users SET is_admin = 1 WHERE email = $1', [email]);
    if (result.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    res.json({ success: true, message: `${email} 已设置为管理员` });
  } catch (err) {
    res.status(500).json({ error: '操作失败' });
  }
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
