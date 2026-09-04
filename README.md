# ✨ 小星星积分乐园

给小学生的积分奖励系统，部署在 Cloudflare Workers 上。

## 功能

- **积分展示** — 大号数字 + 呼吸光效动画，实时更新
- **加分按钮** — 点击"完成作业啦！+1"，触发星星粒子飞溅动画
- **奖励阶梯** — 卡片式展示，积分达标后自动解锁兑换按钮
  - 10 分 → 去一次书店 📚
  - 20 分 → 选一家餐厅 🍽️
  - 30 分 → 买一个玩具 🧸
  - 50 分 → 去一次游乐园 🎡
  - 80 分 → 看一场电影 🎬
  - 100 分 → 实现一个愿望 🌟
- **积分消费** — 兑换奖励前弹窗确认，扣减后实时更新积分和记录
- **交易记录** — 时间线式展示所有加分（绿色 +）和消费（红色 -）记录
- **头像 & 名字** — 彩虹光环边框 + 跳动皇冠 + 渐变名字徽章
- **响应式** — 手机 H5 和 PC 端自适应

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 单页 HTML + CSS3 + 原生 JS（内嵌于 Worker） |
| 后端 | Cloudflare Worker |
| 数据库 | Cloudflare D1（边缘 SQLite） |
| 部署 | Wrangler CLI |

## 项目结构

```
reward-system/
├── src/
│   ├── index.js       # Worker 主文件（API + 前端页面）
│   └── avatar.js      # 头像 base64 数据模块
├── schema.sql         # D1 数据库初始化脚本
├── preview.html       # 本地预览版（localStorage 模拟后端）
├── avatar.jpg         # 头像原图
├── wrangler.toml      # Wrangler 部署配置
└── package.json       # 项目配置
```

## 本地预览

直接用浏览器打开 `preview.html` 即可预览页面效果，数据存储在浏览器 localStorage 中，刷新不丢失。

```bash
# 或用 Wrangler 本地开发模式
npm install
npx wrangler d1 execute reward-db --local --file=schema.sql
npx wrangler dev
```

## 部署到 Cloudflare

### 1. 安装依赖

```bash
npm install
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 创建 D1 数据库

```bash
npx wrangler d1 create reward-db
```

将输出的 `database_id` 填入 `wrangler.toml`。

### 4. 初始化数据库

```bash
npx wrangler d1 execute reward-db --remote --file=schema.sql
```

### 5. 部署

```bash
npx wrangler deploy
```

## API 接口

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/points` | 获取当前积分总数 |
| POST | `/api/points/add` | 加分（body: `{ amount, description }`） |
| GET | `/api/rewards` | 获取奖励阶梯表 |
| GET | `/api/transactions` | 获取交易记录列表 |
| POST | `/api/transactions` | 消费积分（body: `{ amount, description }`） |

## 自定义配置

### 修改奖励内容

编辑 `src/index.js` 顶部的 `REWARDS` 数组：

```js
const REWARDS = [
  { points: 10, label: "去一次书店", icon: "📚" },
  { points: 20, label: "选一家餐厅", icon: "🍽️" },
  // ... 添加更多
];
```

### 修改名字

在 `src/index.js` 的 HTML 模板中搜索 `name-badge`，将"童童"改为孩子名字。

### 替换头像

替换 `avatar.jpg` 后重新生成 base64 模块：

```bash
# PowerShell
$bytes = [System.IO.File]::ReadAllBytes('avatar.jpg')
$base64 = [System.Convert]::ToBase64String($bytes)
$content = "export const AVATAR_BASE64 = `"data:image/jpeg;base64,$base64`";"
[System.IO.File]::WriteAllText('src/avatar.js', $content, [System.Text.Encoding]::UTF8)
```

## 免费额度

Cloudflare Workers 免费计划完全够用：

| 资源 | 免费额度 | 日常使用 |
|------|----------|----------|
| Worker 请求 | 10 万次/天 | <100 次 |
| D1 读取 | 500 万行/天 | <50 行 |
| D1 写入 | 10 万行/天 | <10 行 |
| D1 存储 | 500 MB | <1 MB |

## License

MIT
