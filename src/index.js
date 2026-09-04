// ============================================================
// 积分奖励系统 - Cloudflare Worker
// 同时承担 API 服务和前端页面托管
// ============================================================

import { AVATAR_BASE64 } from './avatar.js';

// 奖励阶梯配置
const REWARDS = [
  { points: 10, label: "去一次书店", icon: "📚" },
  { points: 20, label: "选一家餐厅", icon: "🍽️" },
  { points: 30, label: "买一个玩具", icon: "🧸" },
  { points: 50, label: "去一次游乐园", icon: "🎡" },
  { points: 80, label: "看一场电影", icon: "🎬" },
  { points: 100, label: "实现一个愿望", icon: "🌟" },
];

// ============================================================
// API 路由处理
// ============================================================

async function handleApi(request, env, path) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // GET /api/points - 获取当前积分
    if (path === "/api/points" && request.method === "GET") {
      const row = await env.DB.prepare("SELECT total FROM points WHERE id = 1").first();
      const total = row ? row.total : 0;
      return jsonResponse({ total }, corsHeaders);
    }

    // POST /api/points/add - 加分
    if (path === "/api/points/add" && request.method === "POST") {
      const body = await request.json();
      const { amount = 1, description = "完成作业" } = body;

      if (amount <= 0 || !Number.isInteger(amount)) {
        return jsonResponse({ error: "积分数量必须为正整数" }, corsHeaders, 400);
      }

      // 更新积分总数
      await env.DB.prepare("UPDATE points SET total = total + ? WHERE id = 1").bind(amount).run();
      // 记录交易
      await env.DB.prepare(
        "INSERT INTO transactions (type, amount, description) VALUES ('add', ?, ?)"
      ).bind(amount, description).run();

      const row = await env.DB.prepare("SELECT total FROM points WHERE id = 1").first();
      return jsonResponse({ total: row.total, added: amount }, corsHeaders);
    }

    // GET /api/rewards - 获取奖励阶梯
    if (path === "/api/rewards" && request.method === "GET") {
      return jsonResponse({ rewards: REWARDS }, corsHeaders);
    }

    // GET /api/transactions - 获取交易记录
    if (path === "/api/transactions" && request.method === "GET") {
      const url = new URL(request.url);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
      const rows = await env.DB.prepare(
        "SELECT * FROM transactions ORDER BY created_at DESC LIMIT ?"
      ).bind(limit).all();
      return jsonResponse({ transactions: rows.results }, corsHeaders);
    }

    // POST /api/transactions - 消费积分
    if (path === "/api/transactions" && request.method === "POST") {
      const body = await request.json();
      const { amount, description } = body;

      if (!amount || amount <= 0 || !Number.isInteger(amount)) {
        return jsonResponse({ error: "消费积分数必须为正整数" }, corsHeaders, 400);
      }
      if (!description || description.trim() === "") {
        return jsonResponse({ error: "消费描述不能为空" }, corsHeaders, 400);
      }

      // 检查积分是否足够
      const row = await env.DB.prepare("SELECT total FROM points WHERE id = 1").first();
      const currentTotal = row ? row.total : 0;

      if (currentTotal < amount) {
        return jsonResponse({ error: "积分不足", current: currentTotal, required: amount }, corsHeaders, 400);
      }

      // 扣减积分
      await env.DB.prepare("UPDATE points SET total = total - ? WHERE id = 1").bind(amount).run();
      // 记录消费
      await env.DB.prepare(
        "INSERT INTO transactions (type, amount, description) VALUES ('consume', ?, ?)"
      ).bind(amount, description).run();

      const updated = await env.DB.prepare("SELECT total FROM points WHERE id = 1").first();
      return jsonResponse({ total: updated.total, consumed: amount }, corsHeaders);
    }

    return jsonResponse({ error: "接口不存在" }, corsHeaders, 404);
  } catch (err) {
    return jsonResponse({ error: err.message }, corsHeaders, 500);
  }
}

function jsonResponse(data, headers, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

// ============================================================
// 前端 HTML 页面
// ============================================================

function getHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>✨ 小星星积分乐园 ✨</title>
<style>
/* ====== 基础重置 & 全局 ====== */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --pink: #ff6b9d;
  --pink-light: #ffa0c0;
  --purple: #9b59b6;
  --purple-light: #c39bd3;
  --blue: #85c1e9;
  --yellow: #f9e547;
  --rainbow-1: #ff6b6b;
  --rainbow-2: #ffa500;
  --rainbow-3: #f9e547;
  --rainbow-4: #7bed9f;
  --rainbow-5: #70a1ff;
  --rainbow-6: #a29bfe;
  --rainbow-7: #fd79a8;
  --bg-gradient: linear-gradient(135deg, #fce4ec 0%, #f3e5f5 30%, #e8eaf6 60%, #e0f7fa 100%);
  --card-bg: rgba(255, 255, 255, 0.85);
  --card-shadow: 0 8px 32px rgba(155, 89, 182, 0.15);
  --radius: 20px;
  --font-main: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

body {
  font-family: var(--font-main);
  background: var(--bg-gradient);
  min-height: 100vh;
  overflow-x: hidden;
  position: relative;
  color: #4a235a;
}

/* ====== 背景装饰 ====== */
.bg-decor {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.cloud {
  position: absolute;
  background: rgba(255,255,255,0.6);
  border-radius: 50px;
  animation: floatCloud linear infinite;
}
.cloud::before, .cloud::after {
  content: '';
  position: absolute;
  background: rgba(255,255,255,0.6);
  border-radius: 50%;
}
.cloud-1 { width: 120px; height: 40px; top: 8%; left: -150px; animation-duration: 25s; }
.cloud-1::before { width: 50px; height: 50px; top: -25px; left: 20px; }
.cloud-1::after  { width: 70px; height: 60px; top: -30px; left: 50px; }
.cloud-2 { width: 90px; height: 30px; top: 20%; left: -120px; animation-duration: 35s; animation-delay: 5s; }
.cloud-2::before { width: 40px; height: 40px; top: -20px; left: 15px; }
.cloud-2::after  { width: 55px; height: 45px; top: -22px; left: 40px; }
.cloud-3 { width: 100px; height: 35px; top: 45%; left: -130px; animation-duration: 30s; animation-delay: 10s; }
.cloud-3::before { width: 45px; height: 45px; top: -22px; left: 18px; }
.cloud-3::after  { width: 60px; height: 50px; top: -25px; left: 45px; }

@keyframes floatCloud {
  from { transform: translateX(0); }
  to   { transform: translateX(calc(100vw + 200px)); }
}

.star {
  position: absolute;
  font-size: 18px;
  animation: twinkle 2s ease-in-out infinite alternate;
}
.star:nth-child(4)  { top: 10%; left: 15%; animation-delay: 0s; }
.star:nth-child(5)  { top: 25%; left: 80%; animation-delay: 0.5s; }
.star:nth-child(6)  { top: 50%; left: 10%; animation-delay: 1s; }
.star:nth-child(7)  { top: 70%; left: 90%; animation-delay: 1.5s; }
.star:nth-child(8)  { top: 85%; left: 30%; animation-delay: 0.3s; }
.star:nth-child(9)  { top: 15%; left: 60%; animation-delay: 0.8s; }
.star:nth-child(10) { top: 60%; left: 75%; animation-delay: 1.2s; }
.star:nth-child(11) { top: 35%; left: 45%; animation-delay: 0.6s; }
.star:nth-child(12) { top: 90%; left: 55%; animation-delay: 1.8s; }

@keyframes twinkle {
  0%   { opacity: 0.3; transform: scale(0.8) rotate(0deg); }
  100% { opacity: 1;   transform: scale(1.2) rotate(20deg); }
}

/* ====== 主容器 ====== */
.container {
  position: relative;
  z-index: 1;
  max-width: 600px;
  margin: 0 auto;
  padding: 20px 16px 40px;
}

/* ====== 标题区 ====== */
.header {
  text-align: center;
  padding: 24px 0 16px;
}
.header h1 {
  font-size: 2rem;
  background: linear-gradient(135deg, var(--rainbow-1), var(--rainbow-2), var(--rainbow-3), var(--rainbow-4), var(--rainbow-5), var(--rainbow-6), var(--rainbow-7));
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: rainbowShift 3s linear infinite;
  text-shadow: none;
  letter-spacing: 2px;
}
.header .subtitle {
  font-size: 0.95rem;
  color: var(--purple);
  margin-top: 6px;
  opacity: 0.8;
}
@keyframes rainbowShift {
  0%   { background-position: 0% center; }
  100% { background-position: 200% center; }
}

/* ====== 头像 & 名字 ====== */
.profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
}
.avatar-wrap {
  position: relative;
  width: 110px;
  height: 110px;
  margin-bottom: 10px;
}
.avatar-ring {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--rainbow-1), var(--rainbow-3), var(--rainbow-5), var(--rainbow-7));
  background-size: 200% auto;
  animation: rainbowShift 3s linear infinite;
  padding: 4px;
}
.avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid #fff;
  box-shadow: 0 4px 16px rgba(155, 89, 182, 0.25);
  position: relative;
  z-index: 1;
}
.avatar-crown {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1.8rem;
  z-index: 2;
  animation: crownBounce 2s ease-in-out infinite;
}
@keyframes crownBounce {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50%      { transform: translateX(-50%) translateY(-4px); }
}
.profile-name {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--purple);
  display: flex;
  align-items: center;
  gap: 4px;
  text-shadow: 0 2px 4px rgba(255, 107, 157, 0.15);
}
.profile-name .name-badge {
  background: linear-gradient(135deg, var(--pink), var(--purple));
  color: #fff;
  padding: 4px 16px;
  border-radius: 20px;
  font-size: 1.1rem;
  box-shadow: 0 3px 10px rgba(155, 89, 182, 0.25);
}

/* ====== 积分展示卡 ====== */
.points-card {
  background: var(--card-bg);
  backdrop-filter: blur(10px);
  border-radius: var(--radius);
  box-shadow: var(--card-shadow);
  padding: 32px 24px;
  text-align: center;
  margin-bottom: 20px;
  border: 2px solid rgba(255, 107, 157, 0.2);
  position: relative;
  overflow: hidden;
}
.points-card::before {
  content: '';
  position: absolute;
  top: -2px; left: -2px; right: -2px; bottom: -2px;
  background: linear-gradient(135deg, var(--rainbow-1), var(--rainbow-3), var(--rainbow-5), var(--rainbow-7));
  border-radius: var(--radius);
  z-index: -1;
  opacity: 0.3;
  animation: borderGlow 4s linear infinite;
}
@keyframes borderGlow {
  0%, 100% { opacity: 0.3; }
  50%      { opacity: 0.6; }
}

.points-label {
  font-size: 1rem;
  color: var(--purple);
  margin-bottom: 8px;
  font-weight: 600;
}
.points-value {
  font-size: 4rem;
  font-weight: 800;
  background: linear-gradient(135deg, var(--pink), var(--purple));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1.1;
  transition: transform 0.3s ease;
}
.points-value.bounce {
  animation: pointBounce 0.6s ease;
}
@keyframes pointBounce {
  0%   { transform: scale(1); }
  30%  { transform: scale(1.3); }
  50%  { transform: scale(0.9); }
  70%  { transform: scale(1.1); }
  100% { transform: scale(1); }
}
.points-unit {
  font-size: 1.2rem;
  color: var(--purple-light);
  margin-top: 4px;
}

/* ====== 加分按钮 ====== */
.add-section {
  text-align: center;
  margin-bottom: 24px;
}
.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 16px 36px;
  font-size: 1.2rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--pink), var(--purple));
  border: none;
  border-radius: 50px;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(155, 89, 182, 0.35);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  font-family: var(--font-main);
}
.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(155, 89, 182, 0.45);
}
.add-btn:active {
  transform: translateY(0);
}
.add-btn .btn-icon { font-size: 1.4rem; }

/* 加分成功粒子效果容器 */
.particles-container {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none;
  z-index: 999;
}
.particle {
  position: absolute;
  font-size: 24px;
  animation: particleFly 1s ease-out forwards;
  pointer-events: none;
}
@keyframes particleFly {
  0%   { opacity: 1; transform: translate(0, 0) scale(1) rotate(0deg); }
  100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0.3) rotate(360deg); }
}

/* ====== 通用卡片 ====== */
.card {
  background: var(--card-bg);
  backdrop-filter: blur(10px);
  border-radius: var(--radius);
  box-shadow: var(--card-shadow);
  padding: 24px;
  margin-bottom: 20px;
  border: 1px solid rgba(255, 255, 255, 0.5);
}
.card-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--purple);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-title .icon { font-size: 1.3rem; }

/* ====== 奖励阶梯表 ====== */
.reward-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.reward-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(255,107,157,0.08), rgba(155,89,182,0.08));
  border-radius: 14px;
  border: 1px solid rgba(255,107,157,0.15);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.reward-item:hover {
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(155,89,182,0.1);
}
.reward-icon {
  font-size: 1.8rem;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.8);
  border-radius: 12px;
  flex-shrink: 0;
}
.reward-info { flex: 1; }
.reward-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: #4a235a;
}
.reward-points {
  font-size: 0.8rem;
  color: var(--pink);
  font-weight: 600;
  margin-top: 2px;
}
.reward-action {
  flex-shrink: 0;
}
.consume-btn {
  padding: 8px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--purple);
  background: rgba(255,255,255,0.8);
  border: 2px solid var(--purple-light);
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: var(--font-main);
}
.consume-btn:hover {
  background: var(--purple);
  color: #fff;
}
.consume-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.consume-btn:disabled:hover {
  background: rgba(255,255,255,0.8);
  color: var(--purple);
}

/* ====== 消费记录 ====== */
.record-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}
.record-list::-webkit-scrollbar { width: 6px; }
.record-list::-webkit-scrollbar-track { background: transparent; }
.record-list::-webkit-scrollbar-thumb { background: var(--purple-light); border-radius: 3px; }

.record-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 0.9rem;
  animation: slideIn 0.3s ease;
}
.record-item.add {
  background: rgba(123, 237, 159, 0.12);
  border: 1px solid rgba(123, 237, 159, 0.25);
}
.record-item.consume {
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.2);
}
@keyframes slideIn {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.record-icon {
  font-size: 1.3rem;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
}
.record-item.add .record-icon    { background: rgba(123,237,159,0.2); }
.record-item.consume .record-icon { background: rgba(255,107,107,0.15); }
.record-info { flex: 1; }
.record-desc { font-weight: 500; color: #4a235a; }
.record-time { font-size: 0.78rem; color: #999; margin-top: 2px; }
.record-amount {
  font-weight: 700;
  font-size: 1rem;
  flex-shrink: 0;
}
.record-item.add .record-amount    { color: #27ae60; }
.record-item.consume .record-amount { color: #e74c3c; }

.empty-records {
  text-align: center;
  padding: 30px;
  color: #bbb;
  font-size: 0.9rem;
}
.empty-records .empty-icon {
  font-size: 2.5rem;
  margin-bottom: 8px;
  display: block;
}

/* ====== 底部 ====== */
.footer {
  text-align: center;
  padding: 20px 0;
  font-size: 0.8rem;
  color: var(--purple-light);
  opacity: 0.6;
}

/* ====== Toast 提示 ====== */
.toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%) translateY(-100px);
  padding: 14px 28px;
  border-radius: 50px;
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
  z-index: 10000;
  transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  white-space: nowrap;
}
.toast.show {
  transform: translateX(-50%) translateY(0);
}
.toast.success { background: linear-gradient(135deg, #27ae60, #2ecc71); }
.toast.error   { background: linear-gradient(135deg, #e74c3c, #c0392b); }
.toast.info    { background: linear-gradient(135deg, var(--pink), var(--purple)); }

/* ====== 确认弹窗 ====== */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}
.modal-overlay.show {
  opacity: 1;
  pointer-events: auto;
}
.modal {
  background: #fff;
  border-radius: var(--radius);
  padding: 28px 24px;
  max-width: 360px;
  width: 90%;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  transform: scale(0.8);
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.modal-overlay.show .modal {
  transform: scale(1);
}
.modal-icon { font-size: 3rem; margin-bottom: 12px; }
.modal-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--purple);
  margin-bottom: 8px;
}
.modal-desc {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 20px;
  line-height: 1.5;
}
.modal-btns {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.modal-btn {
  padding: 10px 24px;
  border-radius: 25px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
  font-family: var(--font-main);
}
.modal-btn.cancel {
  background: #f0f0f0;
  color: #666;
}
.modal-btn.cancel:hover { background: #e0e0e0; }
.modal-btn.confirm {
  background: linear-gradient(135deg, var(--pink), var(--purple));
  color: #fff;
}
.modal-btn.confirm:hover {
  box-shadow: 0 4px 16px rgba(155,89,182,0.35);
}

/* ====== 响应式 ====== */
@media (max-width: 480px) {
  .container { padding: 12px 12px 30px; }
  .header h1 { font-size: 1.6rem; }
  .avatar-wrap { width: 88px; height: 88px; }
  .profile-name { font-size: 1.1rem; }
  .points-card { padding: 24px 16px; }
  .points-value { font-size: 3rem; }
  .add-btn { padding: 14px 28px; font-size: 1.05rem; }
  .card { padding: 18px; }
  .reward-item { padding: 12px; }
  .reward-icon { width: 38px; height: 38px; font-size: 1.5rem; }
}
@media (min-width: 768px) {
  .container { padding: 30px 24px 50px; }
  .header h1 { font-size: 2.4rem; }
  .avatar-wrap { width: 130px; height: 130px; }
  .profile-name { font-size: 1.5rem; }
  .points-value { font-size: 5rem; }
}
</style>
</head>
<body>

<!-- 背景装饰 -->
<div class="bg-decor">
  <div class="cloud cloud-1"></div>
  <div class="cloud cloud-2"></div>
  <div class="cloud cloud-3"></div>
  <span class="star">⭐</span>
  <span class="star">✨</span>
  <span class="star">💫</span>
  <span class="star">⭐</span>
  <span class="star">✨</span>
  <span class="star">💫</span>
  <span class="star">⭐</span>
  <span class="star">✨</span>
  <span class="star">💫</span>
</div>

<!-- 粒子效果容器 -->
<div class="particles-container" id="particles"></div>

<!-- Toast 提示 -->
<div class="toast" id="toast"></div>

<!-- 确认弹窗 -->
<div class="modal-overlay" id="modal">
  <div class="modal">
    <div class="modal-icon" id="modalIcon">🎁</div>
    <div class="modal-title" id="modalTitle">确认兑换</div>
    <div class="modal-desc" id="modalDesc">确定要消费积分吗？</div>
    <div class="modal-btns">
      <button class="modal-btn cancel" onclick="closeModal()">再想想</button>
      <button class="modal-btn confirm" onclick="confirmConsume()">确认兑换</button>
    </div>
  </div>
</div>

<!-- 主内容 -->
<div class="container">
  <!-- 标题 -->
  <div class="header">
    <h1>✨ 小星星积分乐园 ✨</h1>
    <div class="subtitle">每天进步一点点，奖励就在前方！</div>
  </div>

  <!-- 头像 & 名字 -->
  <div class="profile">
    <div class="avatar-wrap">
      <div class="avatar-ring"></div>
      <div class="avatar-crown">👑</div>
      <img class="avatar" src="${AVATAR_BASE64}" alt="童童的头像">
    </div>
    <div class="profile-name">
      <span class="name-badge">童童</span>
    </div>
  </div>

  <!-- 积分展示 -->
  <div class="points-card">
    <div class="points-label">🌟 我的积分</div>
    <div class="points-value" id="pointsValue">0</div>
    <div class="points-unit">颗小星星</div>
  </div>

  <!-- 加分按钮 -->
  <div class="add-section">
    <button class="add-btn" id="addBtn" onclick="addPoints()">
      <span class="btn-icon">📝</span>
      <span>完成作业啦！+1</span>
    </button>
  </div>

  <!-- 奖励阶梯 -->
  <div class="card">
    <div class="card-title"><span class="icon">🎁</span> 奖励阶梯</div>
    <div class="reward-list" id="rewardList"></div>
  </div>

  <!-- 消费记录 -->
  <div class="card">
    <div class="card-title"><span class="icon">📋</span> 积分记录</div>
    <div class="record-list" id="recordList">
      <div class="empty-records">
        <span class="empty-icon">🌈</span>
        还没有记录哦，快去完成作业赚积分吧！
      </div>
    </div>
  </div>

  <div class="footer">小星星积分乐园 · 用努力点亮每一天 ✨</div>
</div>

<script>
// ============================================================
// 全局状态
// ============================================================
let currentPoints = 0;
let pendingConsume = null;

// ============================================================
// 初始化
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadPoints();
  loadRewards();
  loadTransactions();
});

// ============================================================
// API 调用
// ============================================================
async function apiGet(url) {
  const res = await fetch(url);
  return res.json();
}
async function apiPost(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

// ============================================================
// 加载积分
// ============================================================
async function loadPoints() {
  try {
    const data = await apiGet('/api/points');
    currentPoints = data.total || 0;
    updatePointsDisplay(currentPoints);
  } catch (e) {
    console.error('加载积分失败:', e);
  }
}

function updatePointsDisplay(value) {
  const el = document.getElementById('pointsValue');
  el.textContent = value;
  el.classList.remove('bounce');
  void el.offsetWidth; // 触发 reflow
  el.classList.add('bounce');
}

// ============================================================
// 加分
// ============================================================
async function addPoints() {
  const btn = document.getElementById('addBtn');
  btn.disabled = true;
  btn.style.opacity = '0.6';

  try {
    const data = await apiPost('/api/points/add', {
      amount: 1,
      description: '完成作业',
    });

    if (data.error) {
      showToast(data.error, 'error');
      return;
    }

    currentPoints = data.total;
    updatePointsDisplay(currentPoints);
    showToast('太棒了！+1 ⭐', 'success');
    spawnParticles(btn);
    loadRewards();
    loadTransactions();
  } catch (e) {
    showToast('操作失败，请重试', 'error');
  } finally {
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

// ============================================================
// 粒子效果
// ============================================================
function spawnParticles(anchor) {
  const container = document.getElementById('particles');
  const rect = anchor.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const emojis = ['⭐', '✨', '💫', '🌟', '💖', '🌈', '🦄'];

  for (let i = 0; i < 12; i++) {
    const p = document.createElement('span');
    p.className = 'particle';
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    p.style.left = cx + 'px';
    p.style.top = cy + 'px';
    const angle = (Math.PI * 2 * i) / 12;
    const dist = 60 + Math.random() * 80;
    p.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
    p.style.setProperty('--ty', Math.sin(angle) * dist - 40 + 'px');
    container.appendChild(p);
    setTimeout(() => p.remove(), 1000);
  }
}

// ============================================================
// 加载奖励阶梯
// ============================================================
async function loadRewards() {
  try {
    const data = await apiGet('/api/rewards');
    const list = document.getElementById('rewardList');
    list.innerHTML = data.rewards.map(r => \`
      <div class="reward-item">
        <div class="reward-icon">\${r.icon}</div>
        <div class="reward-info">
          <div class="reward-name">\${r.label}</div>
          <div class="reward-points">需要 \${r.points} 积分</div>
        </div>
        <div class="reward-action">
          <button class="consume-btn"
            onclick="requestConsume(\${r.points}, '\${r.label}', '\${r.icon}')"
            \${currentPoints < r.points ? 'disabled' : ''}>
            兑换
          </button>
        </div>
      </div>
    \`).join('');
  } catch (e) {
    console.error('加载奖励失败:', e);
  }
}

// ============================================================
// 消费积分
// ============================================================
function requestConsume(points, name, icon) {
  if (currentPoints < points) {
    showToast('积分不够哦，继续加油！💪', 'info');
    return;
  }
  pendingConsume = { points, name, icon };
  document.getElementById('modalIcon').textContent = icon;
  document.getElementById('modalTitle').textContent = '兑换「' + name + '」';
  document.getElementById('modalDesc').textContent =
    '将消费 ' + points + ' 积分\\n当前积分：' + currentPoints + ' → ' + (currentPoints - points);
  document.getElementById('modal').classList.add('show');
}

function closeModal() {
  document.getElementById('modal').classList.remove('show');
  pendingConsume = null;
}

async function confirmConsume() {
  if (!pendingConsume) return;
  const { points, name } = pendingConsume;
  closeModal();

  try {
    const data = await apiPost('/api/transactions', {
      amount: points,
      description: name,
    });

    if (data.error) {
      showToast(data.error, 'error');
      return;
    }

    currentPoints = data.total;
    updatePointsDisplay(currentPoints);
    showToast('兑换成功！🎉', 'success');
    loadTransactions();
    loadRewards(); // 刷新按钮状态
  } catch (e) {
    showToast('兑换失败，请重试', 'error');
  }
}

// ============================================================
// 加载交易记录
// ============================================================
async function loadTransactions() {
  try {
    const data = await apiGet('/api/transactions');
    const list = document.getElementById('recordList');
    const txns = data.transactions || [];

    if (txns.length === 0) {
      list.innerHTML = \`
        <div class="empty-records">
          <span class="empty-icon">🌈</span>
          还没有记录哦，快去完成作业赚积分吧！
        </div>
      \`;
      return;
    }

    list.innerHTML = txns.map(t => {
      const isAdd = t.type === 'add';
      const icon = isAdd ? '⭐' : '🎁';
      const sign = isAdd ? '+' : '-';
      const cls = isAdd ? 'add' : 'consume';
      const time = formatTime(t.created_at);
      return \`
        <div class="record-item \${cls}">
          <div class="record-icon">\${icon}</div>
          <div class="record-info">
            <div class="record-desc">\${t.description}</div>
            <div class="record-time">\${time}</div>
          </div>
          <div class="record-amount">\${sign}\${t.amount}</div>
        </div>
      \`;
    }).join('');
  } catch (e) {
    console.error('加载记录失败:', e);
  }
}

function formatTime(str) {
  if (!str) return '';
  // str 格式: "2026-09-04 10:30:00"
  const d = new Date(str.replace(' ', 'T') + '+08:00');
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  // 超过1天显示日期
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return mm + '-' + dd + ' ' + hh + ':' + mi;
}

// ============================================================
// Toast 提示
// ============================================================
let toastTimer = null;
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + type;
  clearTimeout(toastTimer);
  requestAnimationFrame(() => {
    el.classList.add('show');
    toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
  });
}
</script>
</body>
</html>`;
}

// ============================================================
// Worker 主入口
// ============================================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API 路由
    if (path.startsWith("/api/")) {
      return handleApi(request, env, path);
    }

    // 微信域名校验文件
    if (path === "/0deaeb62dc13b844556b869b1c8a2eab.txt") {
      return new Response("31afb1406ce696b52ff86f2bcad777472ee12572", {
        headers: { "Content-Type": "text/plain" },
      });
    }

    // 所有其他请求返回前端页面
    return new Response(getHTML(), {
      headers: { "Content-Type": "text/html;charset=UTF-8" },
    });
  },
};
