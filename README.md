# 预测市场项目 - 开发文档

## 项目概述
一级市场预测平台，面向 VC/FA/创业者的知识型预测市场。

**在线地址：**
- 前端：https://prediction-market-for-vc.vercel.app
- 后端：https://prediction-market-for-vc-production.up.railway.app
- GitHub：https://github.com/noahark0208/prediction-market-for-VC

## 技术栈
- **后端**：Node.js + Express + SQLite
- **前端**：React + Vite + Tailwind CSS
- **部署**：Railway (后端) + Vercel (前端)

## 项目结构
```
prediction-market/
├── server.js              # 后端主文件
├── init-db.js            # 数据库初始化
├── seed.js               # 种子数据
├── package.json          # 后端依赖
├── client/               # 前端目录
│   ├── src/
│   │   ├── App.jsx       # 主应用
│   │   ├── components/
│   │   │   ├── Topics.jsx          # 话题列表
│   │   │   ├── TopicDetail.jsx     # 话题详情
│   │   │   ├── UserProfile.jsx     # 用户主页
│   │   │   ├── VoteTrend.jsx       # 投票趋势图
│   │   │   ├── LoginModal.jsx      # 登录模态框
│   │   │   └── CreateTopicModal.jsx # 创建话题
│   │   └── index.css     # 全局样式
│   └── package.json      # 前端依赖
└── prediction.db         # SQLite 数据库
```

## 数据库结构

### users 表
- id, email, password, credits, role, bio, created_at

### topics 表
- id, title, description, category, creator_id, yes_votes, no_votes, total_participants, settlement_date, settlement_result, created_at

### votes 表
- id, topic_id, user_id, vote, credits_spent, created_at

### comments 表
- id, topic_id, user_id, content, created_at

### follows 表
- id, follower_id, following_id, created_at

### vote_snapshots 表
- id, topic_id, yes_votes, no_votes, snapshot_time

## 核心功能

### 1. 用户系统
- 邮箱注册/登录
- 身份选择：VC/FA/创业者/其他
- 初始积分：1000
- 个人主页：显示投票统计、看涨比例

### 2. 话题系统
- 6个分类：融资/上市/估值/趋势/八卦/其他
- 创建话题（需登录）
- Yes/No 投票（10积分/次）
- 热度算法：参与人数 × 2 + 争议度 × 0.5

### 3. 社交功能
- 评论讨论
- 关注用户
- 点击用户名查看主页

### 4. 数据可视化
- 投票趋势图（实时更新）
- 百分比进度条

## API 接口

### 用户相关
- POST /api/register - 注册
- POST /api/login - 登录
- GET /api/me - 获取当前用户
- PUT /api/me - 更新用户资料
- GET /api/users/:id - 获取用户主页

### 话题相关
- GET /api/topics - 获取话题列表（支持分类筛选）
- POST /api/topics - 创建话题
- GET /api/topics/:id - 获取话题详情
- POST /api/topics/:id/vote - 投票
- GET /api/topics/:id/trend - 获取投票趋势

### 评论相关
- GET /api/topics/:id/comments - 获取评论
- POST /api/topics/:id/comments - 发表评论

### 关注相关
- POST /api/users/:id/follow - 关注用户
- DELETE /api/users/:id/follow - 取消关注

## 环境变量

### 后端 (.env)
```
PORT=3001
JWT_SECRET=your-secret-key
```

### 前端 (.env.production)
```
VITE_API_URL=https://prediction-market-for-vc-production.up.railway.app/api
```

## 本地开发

### 后端
```bash
cd prediction-market
npm install
node server.js
```

### 前端
```bash
cd prediction-market/client
npm install
npm run dev
```

## 部署

### 后端（Railway）
1. 推送代码到 GitHub
2. Railway 自动检测并部署
3. 设置环境变量：JWT_SECRET

### 前端（Vercel）
1. 连接 GitHub 仓库
2. Root Directory: `client`
3. 环境变量：VITE_API_URL

## 常见修改场景

### 添加新功能
1. 后端：在 server.js 添加新 API
2. 前端：在 components/ 创建新组件
3. 更新 App.jsx 引入新组件

### 修改 UI 样式
- 全局样式：client/src/index.css
- 组件样式：使用 Tailwind CSS 类名
- 颜色主题：渐变色 from-blue-600 to-purple-600

### 修改数据库
1. 更新 init-db.js
2. 重新部署后端
3. Railway 会自动运行初始化

## 待实现功能（可以让 AI 做）
- [ ] 话题结算机制
- [ ] 用户排行榜
- [ ] 话题搜索
- [ ] @提及功能
- [ ] 通知系统
- [ ] 数据导出
- [ ] 管理后台

## 联系方式
- GitHub: https://github.com/noahark0208/prediction-market-for-VC
- 问题反馈：在 GitHub 提 Issue
