# 部署指南

## 后端部署（Railway）

1. 访问 https://railway.app/
2. 用 GitHub 登录
3. 点击 "New Project" → "Deploy from GitHub repo"
4. 选择你的仓库
5. 设置环境变量：
   - `JWT_SECRET`: 随机生成的密钥
   - `PORT`: 3001
6. 部署完成后会得到一个 URL，例如：`https://your-app.railway.app`

## 前端部署（Vercel）

1. 访问 https://vercel.com/
2. 用 GitHub 登录
3. 点击 "Add New" → "Project"
4. 选择你的仓库
5. 设置：
   - Framework Preset: Vite
   - Root Directory: `client`
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. 环境变量：
   - `VITE_API_URL`: Railway 后端的 URL + `/api`
   - 例如：`https://your-app.railway.app/api`
7. 部署完成后会得到一个 URL，例如：`https://your-app.vercel.app`

## 本地测试

```bash
# 后端
cd ~/prediction-market
npm install
node server.js

# 前端
cd ~/prediction-market/client
npm install
npm run dev
```

## 注意事项

- 部署前需要先推送代码到 GitHub
- Railway 和 Vercel 都有免费额度
- 记得在 Railway 设置环境变量
- 前端的 VITE_API_URL 要指向后端地址
