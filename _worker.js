const COOKIE_NAME = 'sunny_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; 
const MAX_QUESTIONS = 16;
const MAX_OPTIONS = 8;
const MAX_TEXT_LEN = 32;
const MAX_FEEDBACK_LEN = 520;
const MIN_QUESTIONS = 4;
const MIN_OPTIONS = 2;

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = crypto.getRandomValues(new Uint8Array(1))[0] & 0xf;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

function isValidUUID(uuid) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

function getCookie(request, name) {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(new RegExp('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name, value, maxAge) {
    return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function clearCookie(name) {
    return `${name}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

function htmlEscape(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function textResponse(text, status = 200) {
    return new Response(text, {
        status,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
}

function htmlResponse(html, status = 200) {
    return new Response(html, {
        status,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}

function redirectResponse(url, status = 302) {
    return new Response(null, {
        status,
        headers: { 'Location': url }
    });
}

async function getChatData(env, uuid) {
    const data = await env.SUNNY_DATA_MAIN.get(uuid);
    if (!data) return null;
    return JSON.parse(data);
}

async function setChatData(env, uuid, data) {
    await env.SUNNY_DATA_MAIN.put(uuid, JSON.stringify(data));
}

async function getFeedbackData(env, uuid) {
    const data = await env.SUNNY_DATA_FEEDBACK.get(uuid);
    if (!data) return null;
    return JSON.parse(data);
}

async function setFeedbackData(env, uuid, data) {
    await env.SUNNY_DATA_FEEDBACK.put(uuid, JSON.stringify(data));
}

async function getAllFeedback(env) {
    const list = await env.SUNNY_DATA_FEEDBACK.list();
    const result = [];
    for (const key of list.keys) {
        const data = await getFeedbackData(env, key.name);
        if (data) {
            result.push({ uuid: key.name, ...data });
        }
    }
    return result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

async function getAllChats(env) {
    const list = await env.SUNNY_DATA_MAIN.list();
    const result = [];
    for (const key of list.keys) {
        const data = await getChatData(env, key.name);
        if (data) {
            result.push({ uuid: key.name, ...data });
        }
    }
    return result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

async function getActiveChat(env) {
    const all = await getAllChats(env);
    return all.find(c => c.active === true) || null;
}

function validateQuestion(question) {
    if (!question.text || question.text.length > MAX_TEXT_LEN) return false;
    if (!question.options || !Array.isArray(question.options)) return false;
    if (question.options.length < MIN_OPTIONS || question.options.length > MAX_OPTIONS) return false;
    for (const opt of question.options) {
        if (!opt || opt.length > MAX_TEXT_LEN) return false;
    }
    return true;
}

function validateChatData(data) {
    if (!data.questions || !Array.isArray(data.questions)) return false;
    if (data.questions.length < MIN_QUESTIONS || data.questions.length > MAX_QUESTIONS) return false;
    for (const q of data.questions) {
        if (!validateQuestion(q)) return false;
    }
    return true;
}

function isChatEditable(chat) {
    if (chat.completedAt) return false;
    if (chat.exitCount && chat.exitCount > 0) return false;
    if (chat.answers && Object.keys(chat.answers).length > 0) return false;
    return true;
}

function renderLoginPage() {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>身份验证</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#0b0e14;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
.card{background:#1a1f2b;border-radius:24px;padding:48px 40px;width:100%;max-width:420px;box-shadow:0 25px 60px rgba(0,0,0,0.6);border:1px solid #2a3140;}
.card h1{color:#f0f2f5;font-size:26px;font-weight:600;letter-spacing:-0.3px;margin-bottom:8px;}
.card p{color:#8a94a6;font-size:15px;margin-bottom:32px;}
.input-group{position:relative;margin-bottom:24px;}
.input-group input{width:100%;padding:16px 18px;background:#0e121c;border:1.5px solid #2a3140;border-radius:14px;color:#f0f2f5;font-size:16px;outline:none;transition:border-color 0.2s,box-shadow 0.2s;}
.input-group input:focus{border-color:#6c8cff;box-shadow:0 0 0 4px rgba(108,140,255,0.15);}
.input-group input::placeholder{color:#4a5268;}
.btn{width:100%;padding:16px;background:#6c8cff;border:none;border-radius:14px;color:#fff;font-size:17px;font-weight:600;cursor:pointer;transition:background 0.2s,transform 0.1s;}
.btn:hover{background:#5a7ae8;}
.btn:active{transform:scale(0.98);}
.error{color:#ff6b6b;font-size:14px;margin-top:12px;display:none;}
</style>
</head>
<body>
<div class="card">
  <h1>🔐 身份验证</h1>
  <p>请输入管理密钥以访问控制面板</p>
  <form id="loginForm">
    <div class="input-group">
      <input type="password" id="keyInput" placeholder="请输入文本" autofocus />
    </div>
    <button type="submit" class="btn">验证并进入</button>
    <div class="error" id="errorMsg">密钥错误 ×</div>
  </form>
</div>
<script>
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = document.getElementById('keyInput').value.trim();
  if (!key) return;
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key })
  });
  if (res.ok) {
    window.location.href = '/administrator';
  } else {
    document.getElementById('errorMsg').style.display = 'block';
    document.getElementById('keyInput').value = '';
    document.getElementById('keyInput').focus();
  }
});
</script>
</body>
</html>`;
}

function renderAdminPage() {
    return '<!DOCTYPE html>\n' +
'<html lang="zh-CN">\n' +
'<head>\n' +
'<meta charset="UTF-8" />\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
'<title>❤️管理面板</title>\n' +
'<style>\n' +
'*{margin:0;padding:0;box-sizing:border-box;}\n' +
':root{--bg:#0b0e14;--surface:#151c28;--surface2:#1f2838;--border:#2a3448;--text:#e8ecf4;--text2:#9aa8be;--primary:#6c8cff;--primary-hover:#5a7ae8;--success:#4cd9a0;--danger:#ff6b7a;--radius:16px;--shadow:0 8px 32px rgba(0,0,0,0.5);}\n' +
'body.light{--bg:#f2f5fa;--surface:#ffffff;--surface2:#eef2f7;--border:#d0d8e4;--text:#1a1f2b;--text2:#5a667a;--shadow:0 8px 32px rgba(0,0,0,0.08);}\n' +
'body{background:var(--bg);color:var(--text);font-family:\'Inter\',-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;transition:background 0.3s,color 0.3s;padding:24px;min-height:100vh;}\n' +
'.container{max-width:1200px;margin:0 auto;}\n' +
'.header{display:flex;align-items:center;justify-content:space-between;padding:16px 0 24px;flex-wrap:wrap;gap:12px;}\n' +
'.header h1{font-size:28px;font-weight:700;letter-spacing:-0.5px;display:flex;align-items:center;gap:10px;}\n' +
'.header h1 span{background:var(--primary);color:#fff;font-size:14px;font-weight:500;padding:2px 12px;border-radius:20px;}\n' +
'.header-actions{display:flex;gap:10px;align-items:center;}\n' +
'.theme-toggle,.logout-btn{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:8px 16px;color:var(--text);font-size:14px;cursor:pointer;transition:0.2s;display:flex;align-items:center;gap:6px;}\n' +
'.theme-toggle:hover,.logout-btn:hover{background:var(--border);}\n' +
'.main-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;}\n' +
'@media (max-width:800px){.main-grid{grid-template-columns:1fr;}}\n' +
'.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px 28px;box-shadow:var(--shadow);}\n' +
'.card h3{font-size:17px;font-weight:600;margin-bottom:8px;color:var(--text);}\n' +
'.card p{font-size:14px;color:var(--text2);margin-bottom:16px;line-height:1.5;}\n' +
'.card .btn{background:var(--primary);border:none;border-radius:10px;padding:10px 20px;color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:0.2s;}\n' +
'.card .btn:hover{background:var(--primary-hover);}\n' +
'.card .btn.secondary{background:var(--surface2);color:var(--text);}\n' +
'.card .btn.secondary:hover{background:var(--border);}\n' +
'.card .btn.danger{background:var(--danger);}\n' +
'.card .btn.danger:hover{background:#e55a6a;}\n' +
'.card .btn.success{background:var(--success);color:#0b0e14;}\n' +
'.card .btn.success:hover{background:#3bc58a;}\n' +
'.chat-list{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px 28px;box-shadow:var(--shadow);margin-bottom:24px;}\n' +
'.chat-list .header-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;}\n' +
'.chat-list .header-row h3{font-size:18px;font-weight:600;}\n' +
'.chat-list .header-row .refresh-btn{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:6px 14px;color:var(--text);cursor:pointer;font-size:14px;transition:0.2s;display:flex;align-items:center;gap:6px;}\n' +
'.chat-list .header-row .refresh-btn:hover{background:var(--border);}\n' +
'.chat-item{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);}\n' +
'.chat-item:last-child{border-bottom:none;}\n' +
'.chat-item .info{flex:1;min-width:200px;}\n' +
'.chat-item .info .uuid{font-family:monospace;font-size:14px;color:var(--text2);}\n' +
'.chat-item .info .meta{font-size:13px;color:var(--text2);margin-top:2px;}\n' +
'.chat-item .status{font-size:13px;padding:4px 12px;border-radius:20px;font-weight:500;}\n' +
'.chat-item .status.active{background:var(--success);color:#0b0e14;}\n' +
'.chat-item .status.inactive{background:var(--surface2);color:var(--text2);}\n' +
'.chat-item .actions{display:flex;gap:8px;flex-wrap:wrap;}\n' +
'.chat-item .actions .btn{padding:6px 14px;font-size:13px;border-radius:8px;border:none;cursor:pointer;transition:0.2s;font-weight:500;}\n' +
'.chat-item .actions .btn-primary{background:var(--primary);color:#fff;}\n' +
'.chat-item .actions .btn-primary:hover{background:var(--primary-hover);}\n' +
'.chat-item .actions .btn-secondary{background:var(--surface2);color:var(--text);}\n' +
'.chat-item .actions .btn-secondary:hover{background:var(--border);}\n' +
'.chat-item .actions .btn-danger{background:var(--danger);color:#fff;}\n' +
'.chat-item .actions .btn-danger:hover{background:#e55a6a;}\n' +
'.chat-item .actions .btn-success{background:var(--success);color:#0b0e14;}\n' +
'.chat-item .actions .btn-success:hover{background:#3bc58a;}\n' +
'.detail-panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px 28px;box-shadow:var(--shadow);margin-bottom:24px;display:none;}\n' +
'.detail-panel.active{display:block;}\n' +
'.detail-panel .header-row{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;}\n' +
'.detail-panel .header-row h2{font-size:20px;font-weight:600;}\n' +
'.detail-panel .header-row .actions{display:flex;gap:8px;}\n' +
'.detail-panel .close-btn{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:6px 14px;color:var(--text);cursor:pointer;font-size:13px;}\n' +
'.detail-panel .copy-btn{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:6px 14px;color:var(--text);cursor:pointer;font-size:13px;display:flex;align-items:center;gap:6px;}\n' +
'.detail-panel .copy-btn:hover{background:var(--border);}\n' +
'.detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin:16px 0;}\n' +
'.detail-item{background:var(--bg);border-radius:12px;padding:14px 18px;}\n' +
'.detail-item label{font-size:12px;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;}\n' +
'.detail-item .value{font-size:15px;font-weight:500;}\n' +
'.answers-table{width:100%;border-collapse:collapse;margin-top:12px;font-size:14px;}\n' +
'.answers-table th{text-align:left;padding:8px 12px;color:var(--text2);font-weight:500;border-bottom:1px solid var(--border);}\n' +
'.answers-table td{padding:8px 12px;border-bottom:1px solid var(--border);}\n' +
'.answers-table tr:last-child td{border-bottom:none;}\n' +
'.empty-state{color:var(--text2);font-size:14px;padding:16px 0;}\n' +
'.feedback-list{display:grid;gap:12px;margin-top:12px;}\n' +
'.feedback-item{background:var(--bg);border-radius:12px;padding:16px 20px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-left:3px solid var(--primary);}\n' +
'.feedback-item .content{flex:1;}\n' +
'.feedback-item .content .meta{font-size:12px;color:var(--text2);margin-bottom:4px;}\n' +
'.feedback-item .content .text{font-size:15px;line-height:1.6;}\n' +
'.feedback-item .del-btn{background:transparent;border:none;color:var(--danger);cursor:pointer;font-size:18px;padding:4px 8px;border-radius:8px;transition:0.2s;}\n' +
'.feedback-item .del-btn:hover{background:rgba(255,107,122,0.15);}\n' +
'/* Modal */\n' +
'.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);z-index:1000;align-items:center;justify-content:center;padding:20px;}\n' +
'.modal-overlay.active{display:flex;}\n' +
'.modal{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:32px;max-width:720px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 32px 80px rgba(0,0,0,0.6);}\n' +
'.modal h2{font-size:22px;font-weight:600;margin-bottom:8px;}\n' +
'.modal .sub{color:var(--text2);font-size:14px;margin-bottom:24px;}\n' +
'.modal .form-group{margin-bottom:18px;}\n' +
'.modal .form-group label{display:block;font-size:14px;font-weight:500;margin-bottom:5px;color:var(--text2);}\n' +
'.modal .form-group input,.modal .form-group textarea{width:100%;padding:12px 16px;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;color:var(--text);font-size:15px;outline:none;transition:0.2s;font-family:inherit;}\n' +
'.modal .form-group input:focus,.modal .form-group textarea:focus{border-color:var(--primary);box-shadow:0 0 0 4px rgba(108,140,255,0.12);}\n' +
'.modal .form-group textarea{resize:vertical;min-height:80px;}\n' +
'.modal .question-block{background:var(--bg);border-radius:12px;padding:16px 18px;margin-bottom:12px;border:1px solid var(--border);}\n' +
'.modal .question-block .q-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}\n' +
'.modal .question-block .q-header .q-num{font-weight:600;font-size:15px;}\n' +
'.modal .question-block .q-header .q-del{background:transparent;border:none;color:var(--danger);cursor:pointer;font-size:16px;padding:0 4px;}\n' +
'.modal .question-block .q-input{width:100%;padding:10px 14px;background:var(--surface);border:1.5px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;outline:none;margin-bottom:8px;}\n' +
'.modal .question-block .q-input:focus{border-color:var(--primary);}\n' +
'.modal .question-block .options-group{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;}\n' +
'.modal .question-block .options-group .opt-input{flex:1;min-width:100px;padding:8px 12px;background:var(--surface);border:1.5px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;outline:none;}\n' +
'.modal .question-block .options-group .opt-input:focus{border-color:var(--primary);}\n' +
'.modal .question-block .options-group .opt-del{background:transparent;border:none;color:var(--danger);cursor:pointer;font-size:14px;padding:0 6px;}\n' +
'.modal .btn-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px;}\n' +
'.modal .btn-row .btn{padding:10px 24px;border-radius:10px;border:none;font-size:14px;font-weight:600;cursor:pointer;transition:0.2s;}\n' +
'.modal .btn-row .btn.primary{background:var(--primary);color:#fff;}\n' +
'.modal .btn-row .btn.primary:hover{background:var(--primary-hover);}\n' +
'.modal .btn-row .btn.secondary{background:var(--surface2);color:var(--text);}\n' +
'.modal .btn-row .btn.secondary:hover{background:var(--border);}\n' +
'.modal .btn-row .btn.danger{background:var(--danger);color:#fff;}\n' +
'.modal .btn-row .btn.danger:hover{background:#e55a6a;}\n' +
'.modal .hint{font-size:13px;color:var(--text2);margin-top:4px;}\n' +
'.modal .error-text{color:var(--danger);font-size:14px;margin-top:8px;display:none;}\n' +
'/* Toast */\n' +
'.toast{position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 28px;box-shadow:0 12px 40px rgba(0,0,0,0.5);font-size:15px;z-index:2000;transition:0.3s;opacity:0;pointer-events:none;color:var(--text);}\n' +
'.toast.show{opacity:1;pointer-events:auto;}\n' +
'/* Custom Confirm Modal */\n' +
'.confirm-modal .modal{max-width:420px;text-align:center;}\n' +
'.confirm-modal .modal .icon{font-size:48px;margin-bottom:8px;}\n' +
'.confirm-modal .modal .message{font-size:16px;line-height:1.6;margin-bottom:24px;}\n' +
'.confirm-modal .modal .btn-row{justify-content:center;}\n' +
'::-webkit-scrollbar{width:6px;height:6px;}\n' +
'::-webkit-scrollbar-track{background:var(--bg);}\n' +
'::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px;}\n' +
'::-webkit-scrollbar-thumb:hover{background:var(--primary);}\n' +
'@media (max-width:640px){.header{flex-direction:column;align-items:stretch;}.chat-item{flex-direction:column;align-items:stretch;}.chat-item .actions{justify-content:flex-start;}}\n' +
'</style>\n' +
'</head>\n' +
'<body>\n' +
'<div class="container">\n' +
'  <div class="header">\n' +
'    <h1>🗺️ 管理面板<span>Version 1.0.2</span></h1>\n' +
'    <div class="header-actions">\n' +
'      <button class="theme-toggle" id="themeToggle">🌓 主题切换</button>\n' +
'      <button class="logout-btn" id="logoutBtn">🚪 注销登录</button>\n' +
'    </div>\n' +
'  </div>\n' +
'\n' +
'  <div class="main-grid">\n' +
'    <div class="card">\n' +
'      <h3>✏️ 创建新对话</h3>\n' +
'      <p>构建新的调查问卷，生成专属链接密钥，寻找她最真实的情感态度。</p>\n' +
'      <button class="btn" id="newChatBtn">➕ 新建</button>\n' +
'    </div>\n' +
'    <div class="card">\n' +
'      <h3>💬 问题反馈</h3>\n' +
'      <p>探访她留下的心理印记。</p>\n' +
'      <button class="btn secondary" id="viewFeedbackBtn">📋 查看</button>\n' +
'    </div>\n' +
'  </div>\n' +
'\n' +
'  <!-- 对话列表 -->\n' +
'  <div class="chat-list" id="chatListContainer">\n' +
'    <div class="header-row">\n' +
'      <h3>📻 所有对话</h3>\n' +
'      <button class="refresh-btn" id="refreshChatListBtn">🔄 刷新</button>\n' +
'    </div>\n' +
'    <div id="chatList"></div>\n' +
'  </div>\n' +
'\n' +
'  <!-- 详情面板 -->\n' +
'  <div class="detail-panel" id="detailPanel">\n' +
'    <div class="header-row">\n' +
'      <h2 id="detailTitle">🚀 对话详情</h2>\n' +
'      <div class="actions">\n' +
'        <button class="copy-btn" id="copyLinkBtn" style="display:none;">📋 复制链接</button>\n' +
'        <button class="close-btn" id="closeDetailBtn">✕ 关闭</button>\n' +
'      </div>\n' +
'    </div>\n' +
'    <div id="detailContent"></div>\n' +
'  </div>\n' +
'\n' +
'  <!-- 反馈面板 -->\n' +
'  <div class="detail-panel" id="feedbackPanel">\n' +
'    <div class="header-row">\n' +
'      <h2>💬 反馈列表</h2>\n' +
'      <button class="close-btn" id="closeFeedbackBtn">✕ 关闭</button>\n' +
'    </div>\n' +
'    <div id="feedbackContent"></div>\n' +
'  </div>\n' +
'</div>\n' +
'\n' +
'<!-- Toast -->\n' +
'<div class="toast" id="toast"></div>\n' +
'\n' +
'<!-- 新建/编辑对话 Modal -->\n' +
'<div class="modal-overlay" id="chatModal">\n' +
'  <div class="modal">\n' +
'    <h2 id="modalTitle">✏️ 新建对话</h2>\n' +
'    <div class="sub" id="modalSub">填写问题和选项，构建一轮对话。</div>\n' +
'    <div id="modalQuestions"></div>\n' +
'    <div class="btn-row">\n' +
'      <button class="btn secondary" id="addQuestionBtn">➕ 添加问题</button>\n' +
'      <button class="btn primary" id="saveChatBtn">💾 保存</button>\n' +
'      <button class="btn secondary" id="cancelModalBtn">取消</button>\n' +
'    </div>\n' +
'    <div class="error-text" id="modalError"></div>\n' +
'    <div style="margin-top:12px;font-size:13px;color:var(--text2);" id="modalUUIDInfo"></div>\n' +
'  </div>\n' +
'</div>\n' +
'\n' +
'<!-- 自定义确认对话框 -->\n' +
'<div class="modal-overlay confirm-modal" id="confirmModal">\n' +
'  <div class="modal">\n' +
'    <div class="icon" id="confirmIcon">⚠️</div>\n' +
'    <h2 id="confirmTitle">确认</h2>\n' +
'    <div class="message" id="confirmMessage">确定执行此操作吗？</div>\n' +
'    <div class="btn-row">\n' +
'      <button class="btn secondary" id="confirmCancelBtn">取消</button>\n' +
'      <button class="btn primary" id="confirmOkBtn">确定</button>\n' +
'    </div>\n' +
'  </div>\n' +
'</div>\n' +
'\n' +
'<script>\n' +
'// ============================================================\n' +
'// 管理面板 SPA\n' +
'// ============================================================\n' +
'const state = {\n' +
'  chats: [],\n' +
'  feedbacks: [],\n' +
'  editingChat: null,\n' +
'  isNew: true,\n' +
'  currentDetailUuid: null,\n' +
'};\n' +
'\n' +
'const $ = (s) => document.querySelector(s);\n' +
'const $$ = (s) => document.querySelectorAll(s);\n' +
'\n' +
'// ---------- 自定义确认 ----------\n' +
'function showConfirm(title, message, icon = \'⚠️\') {\n' +
'  return new Promise((resolve) => {\n' +
'    const modal = $(\'#confirmModal\');\n' +
'    $(\'#confirmTitle\').textContent = title;\n' +
'    $(\'#confirmMessage\').textContent = message;\n' +
'    $(\'#confirmIcon\').textContent = icon;\n' +
'    modal.classList.add(\'active\');\n' +
'    const ok = () => { modal.classList.remove(\'active\'); resolve(true); };\n' +
'    const cancel = () => { modal.classList.remove(\'active\'); resolve(false); };\n' +
'    $(\'#confirmOkBtn\').onclick = ok;\n' +
'    $(\'#confirmCancelBtn\').onclick = cancel;\n' +
'    modal.onclick = (e) => { if (e.target === modal) cancel(); };\n' +
'  });\n' +
'}\n' +
'\n' +
'function showToast(msg, duration = 2500) {\n' +
'  const t = $(\'#toast\');\n' +
'  t.textContent = msg;\n' +
'  t.classList.add(\'show\');\n' +
'  clearTimeout(t._hide);\n' +
'  t._hide = setTimeout(() => t.classList.remove(\'show\'), duration);\n' +
'}\n' +
'\n' +
'async function apiFetch(path, opts = {}) {\n' +
'  const res = await fetch(path, {\n' +
'    ...opts,\n' +
'    headers: { \'Content-Type\': \'application/json\', ...(opts.headers || {}) },\n' +
'    body: opts.body ? JSON.stringify(opts.body) : undefined,\n' +
'  });\n' +
'  if (!res.ok) {\n' +
'    const err = await res.json().catch(() => ({}));\n' +
'    throw new Error(err.error || \'请求失败\');\n' +
'  }\n' +
'  return res.json();\n' +
'}\n' +
'\n' +
'// 主题切换\n' +
'let darkMode = true;\n' +
'function applyTheme() {\n' +
'  document.body.classList.toggle(\'light\', !darkMode);\n' +
'  localStorage.setItem(\'sunny_theme\', darkMode ? \'dark\' : \'light\');\n' +
'}\n' +
'$(\'#themeToggle\').addEventListener(\'click\', () => {\n' +
'  darkMode = !darkMode;\n' +
'  applyTheme();\n' +
'});\n' +
'if (localStorage.getItem(\'sunny_theme\') === \'light\') {\n' +
'  darkMode = false;\n' +
'  applyTheme();\n' +
'}\n' +
'\n' +
'// 退出\n' +
'$(\'#logoutBtn\').addEventListener(\'click\', async () => {\n' +
'  await fetch(\'/api/auth/logout\', { method: \'POST\' });\n' +
'  window.location.href = \'/authentication\';\n' +
'});\n' +
'\n' +
'// ---------- 加载数据 ----------\n' +
'async function loadChats() {\n' +
'  try {\n' +
'    const data = await apiFetch(\'/api/admin/chat\');\n' +
'    state.chats = data.chats || [];\n' +
'    renderChatList();\n' +
'    // 数据库保存可能有延迟，因此可以通过手动刷新重新加载\n' +
'    if (state.currentDetailUuid) {\n' +
'      const chat = state.chats.find(c => c.uuid === state.currentDetailUuid);\n' +
'      if (chat) {\n' +
'        await showDetail(chat.uuid, false); // 不重新加载列表\n' +
'      } else {\n' +
'        $(\'#detailPanel\').classList.remove(\'active\');\n' +
'      }\n' +
'    }\n' +
'  } catch (e) {\n' +
'    showToast(\'加载对话列表失败: \' + e.message);\n' +
'  }\n' +
'}\n' +
'\n' +
'// 刷新按钮\n' +
'$(\'#refreshChatListBtn\').addEventListener(\'click\', () => {\n' +
'  loadChats();\n' +
'});\n' +
'\n' +
'async function loadFeedbacks() {\n' +
'  try {\n' +
'    const data = await apiFetch(\'/api/admin/feedbacks\');\n' +
'    state.feedbacks = data.feedbacks || [];\n' +
'    renderFeedbacks();\n' +
'  } catch (e) {\n' +
'    showToast(\'加载反馈失败: \' + e.message);\n' +
'  }\n' +
'}\n' +
'\n' +
'// ---------- 渲染对话列表 ----------\n' +
'function renderChatList() {\n' +
'  const container = $(\'#chatList\');\n' +
'  if (state.chats.length === 0) {\n' +
'    container.innerHTML = \'<div class="empty-state">暂无对话，点击上方“新建对话”创建。</div>\';\n' +
'    return;\n' +
'  }\n' +
'  let html = \'\';\n' +
'  for (const chat of state.chats) {\n' +
'    const isActive = chat.active ? true : false;\n' +
'    const statusClass = isActive ? \'active\' : \'inactive\';\n' +
'    const statusText = isActive ? \'🟢 已激活\' : \'⚪ 未激活\';\n' +
'    const qCount = chat.questions ? chat.questions.length : 0;\n' +
'    const created = new Date(chat.createdAt).toLocaleString(\'zh-CN\');\n' +
'    const hasData = chat.completedAt || chat.exitCount > 0 || (chat.answers && Object.keys(chat.answers).length > 0);\n' +
'    html += \'<div class="chat-item">\' +\n' +
'      \'<div class="info">\' +\n' +
'        \'<div class="uuid">\' + chat.uuid + \'</div>\' +\n' +
'        \'<div class="meta">\' + qCount + \' 题 · 创建于 \' + created + \'</div>\' +\n' +
'      \'</div>\' +\n' +
'      \'<span class="status \' + statusClass + \'">\' + statusText + \'</span>\' +\n' +
'      \'<div class="actions">\' +\n' +
'        (isActive ? \'\' : \'<button class="btn btn-success" data-activate="\' + chat.uuid + \'">激活</button>\') +\n' +
'        (isActive ? \'<button class="btn btn-secondary" data-deactivate="\' + chat.uuid + \'">停用</button>\' : \'\') +\n' +
'        \'<button class="btn btn-primary" data-view="\' + chat.uuid + \'">详情</button>\' +\n' +
'        (isChatEditable(chat) ? \'<button class="btn btn-secondary" data-edit="\' + chat.uuid + \'">编辑</button>\' : \'\') +\n' +
'        (hasData ? \'<button class="btn btn-danger" data-reset="\' + chat.uuid + \'">删除数据</button>\' : \'\') +\n' +
'      \'</div>\' +\n' +
'    \'</div>\';\n' +
'  }\n' +
'  container.innerHTML = html;\n' +
'\n' +
'  // 事件绑定\n' +
'  container.querySelectorAll(\'[data-activate]\').forEach(btn => {\n' +
'    btn.addEventListener(\'click\', () => activateChat(btn.dataset.activate));\n' +
'  });\n' +
'  container.querySelectorAll(\'[data-deactivate]\').forEach(btn => {\n' +
'    btn.addEventListener(\'click\', () => deactivateChat(btn.dataset.deactivate));\n' +
'  });\n' +
'  container.querySelectorAll(\'[data-view]\').forEach(btn => {\n' +
'    btn.addEventListener(\'click\', () => showDetail(btn.dataset.view));\n' +
'  });\n' +
'  container.querySelectorAll(\'[data-edit]\').forEach(btn => {\n' +
'    btn.addEventListener(\'click\', () => openEditChat(btn.dataset.edit));\n' +
'  });\n' +
'  container.querySelectorAll(\'[data-reset]\').forEach(btn => {\n' +
'    btn.addEventListener(\'click\', () => resetChatData(btn.dataset.reset));\n' +
'  });\n' +
'}\n' +
'\n' +
'// ---------- 激活/停用 ----------\n' +
'async function activateChat(uuid) {\n' +
'  const confirmed = await showConfirm(\'激活对话\', \'确定要激活此对话吗？其他激活的对话将被自动停用。\', \'🔓\');\n' +
'  if (!confirmed) return;\n' +
'  try {\n' +
'    await apiFetch(\'/api/admin/chat/\' + uuid + \'/activate\', { method: \'POST\' });\n' +
'    showToast(\'✅ 对话已激活\');\n' +
'    await loadChats();\n' +
'  } catch (e) {\n' +
'    showToast(\'激活失败: \' + e.message);\n' +
'  }\n' +
'}\n' +
'\n' +
'async function deactivateChat(uuid) {\n' +
'  const confirmed = await showConfirm(\'停用对话\', \'确定要停用此对话吗？\', \'🔒\');\n' +
'  if (!confirmed) return;\n' +
'  try {\n' +
'    await apiFetch(\'/api/admin/chat/\' + uuid + \'/deactivate\', { method: \'POST\' });\n' +
'    showToast(\'✅ 对话已停用\');\n' +
'    await loadChats();\n' +
'  } catch (e) {\n' +
'    showToast(\'停用失败: \' + e.message);\n' +
'  }\n' +
'}\n' +
'\n' +
'async function resetChatData(uuid) {\n' +
'  const confirmed = await showConfirm(\'重置测试数据\', \'确定要清空此对话的所有作答相关记录吗？此操作不可恢复！\', \'🗑️\');\n' +
'  if (!confirmed) return;\n' +
'  try {\n' +
'    await apiFetch(\'/api/admin/chat/\' + uuid + \'/reset\', { method: \'POST\' });\n' +
'    showToast(\'✅ 数据已重置\');\n' +
'    await loadChats();\n' +
'  } catch (e) {\n' +
'    showToast(\'重置失败: \' + e.message);\n' +
'  }\n' +
'}\n' +
'\n' +
'// ---------- 查看详情 ----------\n' +
'async function showDetail(uuid, refreshList = true) {\n' +
'  try {\n' +
'    const chat = await apiFetch(\'/api/admin/chat/\' + uuid);\n' +
'    state.currentDetailUuid = uuid;\n' +
'    const panel = $(\'#detailPanel\');\n' +
'    const content = $(\'#detailContent\');\n' +
'    panel.classList.add(\'active\');\n' +
'    $(\'#detailTitle\').textContent = \'📋 对话详情 · \' + chat.uuid;\n' +
'\n' +
'    // 复制链接按钮\n' +
'    const copyBtn = $(\'#copyLinkBtn\');\n' +
'    if (chat.active) {\n' +
'      copyBtn.style.display = \'inline-flex\';\n' +
'      copyBtn.onclick = () => {\n' +
'        const link = window.location.origin + \'/chat/\' + chat.uuid;\n' +
'        if (navigator.clipboard && navigator.clipboard.writeText) {\n' +
'          navigator.clipboard.writeText(link).then(() => {\n' +
'            showToast(\'✅ 链接已复制\');\n' +
'          }).catch(() => {\n' +
'            fallbackCopy(link);\n' +
'          });\n' +
'        } else {\n' +
'          fallbackCopy(link);\n' +
'        }\n' +
'      };\n' +
'    } else {\n' +
'      copyBtn.style.display = \'none\';\n' +
'    }\n' +
'\n' +
'    const firstVisit = chat.firstVisit ? new Date(chat.firstVisit).toLocaleString(\'zh-CN\') : \'未访问\';\n' +
'    const completedAt = chat.completedAt ? new Date(chat.completedAt).toLocaleString(\'zh-CN\') : \'未完成\';\n' +
'    const exitCount = chat.exitCount || 0;\n' +
'    const answers = chat.answers || {};\n' +
'    const questions = chat.questions || [];\n' +
'\n' +
'    let html = \'<div class="detail-grid">\' +\n' +
'      \'<div class="detail-item"><label>创建时间</label><div class="value">\' + new Date(chat.createdAt).toLocaleString(\'zh-CN\') + \'</div></div>\' +\n' +
'      \'<div class="detail-item"><label>首次访问</label><div class="value">\' + firstVisit + \'</div></div>\' +\n' +
'      \'<div class="detail-item"><label>完成时间</label><div class="value">\' + completedAt + \'</div></div>\' +\n' +
'      \'<div class="detail-item"><label>中途退出次数</label><div class="value">\' + exitCount + \'</div></div>\' +\n' +
'      \'<div class="detail-item"><label>问题数量</label><div class="value">\' + questions.length + \'</div></div>\' +\n' +
'      \'<div class="detail-item"><label>状态</label><div class="value">\' + (chat.active ? \'🟢 已激活\' : \'🔴 未激活\') + \'</div></div>\' +\n' +
'    \'</div>\';\n' +
'\n' +
'    if (questions.length > 0) {\n' +
'      html += \'<div style="margin-top:16px;font-weight:600;font-size:16px;">👓 答案记录</div>\';\n' +
'      html += \'<table class="answers-table"><thead><tr><th>#</th><th>问题</th><th>答案</th></tr></thead><tbody>\';\n' +
'      for (let i = 0; i < questions.length; i++) {\n' +
'        const q = questions[i];\n' +
'        const ans = answers[q.id] || \'未作答\';\n' +
'        html += \'<tr><td>\' + (i+1) + \'</td><td>\' + htmlEscape(q.text) + \'</td><td>\' + htmlEscape(ans) + \'</td></tr>\';\n' +
'      }\n' +
'      html += \'</tbody></table>\';\n' +
'    } else {\n' +
'      html += \'<div class="empty-state">暂无问题数据</div>\';\n' +
'    }\n' +
'    content.innerHTML = html;\n' +
'  } catch (e) {\n' +
'    showToast(\'加载详情失败: \' + e.message);\n' +
'  }\n' +
'}\n' +
'\n' +
'function fallbackCopy(text) {\n' +
'  const textarea = document.createElement(\'textarea\');\n' +
'  textarea.value = text;\n' +
'  textarea.style.position = \'fixed\';\n' +
'  textarea.style.opacity = \'0\';\n' +
'  document.body.appendChild(textarea);\n' +
'  textarea.select();\n' +
'  try {\n' +
'    document.execCommand(\'copy\');\n' +
'    showToast(\'✅ 链接已复制\');\n' +
'  } catch (e) {\n' +
'    showToast(\'复制失败： \' + text);\n' +
'  }\n' +
'  document.body.removeChild(textarea);\n' +
'}\n' +
'\n' +
'$(\'#closeDetailBtn\').addEventListener(\'click\', () => {\n' +
'  $(\'#detailPanel\').classList.remove(\'active\');\n' +
'  state.currentDetailUuid = null;\n' +
'});\n' +
'\n' +
'// ---------- 反馈面板 ----------\n' +
'function renderFeedbacks() {\n' +
'  const container = $(\'#feedbackContent\');\n' +
'  if (state.feedbacks.length === 0) {\n' +
'    container.innerHTML = \'<div class="empty-state">暂无反馈</div>\';\n' +
'    return;\n' +
'  }\n' +
'  let html = \'<div class="feedback-list">\';\n' +
'  for (const fb of state.feedbacks) {\n' +
'    const time = new Date(fb.createdAt).toLocaleString(\'zh-CN\');\n' +
'    html += \'<div class="feedback-item">\' +\n' +
'            \'<div class="content">\' +\n' +
'            \'<div class="meta">\' + time + \' · UUID: \' + fb.uuid + \'</div>\' +\n' +
'            \'<div class="text">\' + htmlEscape(fb.feedback) + \'</div>\' +\n' +
'            \'</div>\' +\n' +
'            \'<button class="del-btn" data-uuid="\' + fb.uuid + \'" title="删除">✕</button>\' +\n' +
'            \'</div>\';\n' +
'  }\n' +
'  html += \'</div>\';\n' +
'  container.innerHTML = html;\n' +
'  container.querySelectorAll(\'.del-btn\').forEach(btn => {\n' +
'    btn.addEventListener(\'click\', async () => {\n' +
'      const uuid = btn.dataset.uuid;\n' +
'      const confirmed = await showConfirm(\'删除反馈\', \'确定要删除这条反馈吗？\', \'🗑️\');\n' +
'      if (!confirmed) return;\n' +
'      try {\n' +
'        await apiFetch(\'/api/admin/feedback/\' + uuid, { method: \'DELETE\' });\n' +
'        showToast(\'已删除\');\n' +
'        await loadFeedbacks();\n' +
'      } catch (e) {\n' +
'        showToast(\'删除失败: \' + e.message);\n' +
'      }\n' +
'    });\n' +
'  });\n' +
'}\n' +
'\n' +
'$(\'#viewFeedbackBtn\').addEventListener(\'click\', async () => {\n' +
'  const panel = $(\'#feedbackPanel\');\n' +
'  if (panel.classList.contains(\'active\')) {\n' +
'    panel.classList.remove(\'active\');\n' +
'    return;\n' +
'  }\n' +
'  await loadFeedbacks();\n' +
'  panel.classList.add(\'active\');\n' +
'});\n' +
'\n' +
'$(\'#closeFeedbackBtn\').addEventListener(\'click\', () => {\n' +
'  $(\'#feedbackPanel\').classList.remove(\'active\');\n' +
'});\n' +
'\n' +
'// ---------- 新建/编辑对话 ----------\n' +
'let editingUUID = null;\n' +
'\n' +
'function openEditChat(uuid = null) {\n' +
'  if (uuid) {\n' +
'    const chat = state.chats.find(c => c.uuid === uuid);\n' +
'    if (!chat) { showToast(\'对话不存在\'); return; }\n' +
'    if (!isChatEditable(chat)) { showToast(\'此对话已有作答记录，不可编辑\'); return; }\n' +
'    editingUUID = chat.uuid;\n' +
'    state.isNew = false;\n' +
'    state.editingChat = JSON.parse(JSON.stringify(chat));\n' +
'    $(\'#modalTitle\').textContent = \'✏️ 编辑对话\';\n' +
'    $(\'#modalSub\').textContent = \'编辑 "\' + chat.uuid + \'"，修改问题或选项。\';\n' +
'  } else {\n' +
'    editingUUID = null;\n' +
'    state.isNew = true;\n' +
'    state.editingChat = {\n' +
'      uuid: generateUUID(),\n' +
'      questions: [],\n' +
'      createdAt: new Date().toISOString(),\n' +
'      active: false,\n' +
'    };\n' +
'    $(\'#modalTitle\').textContent = \'✏️ 新建对话\';\n' +
'    $(\'#modalSub\').textContent = \'开始使用自定义对话系统，向爱恋之人提出疑问吧。🎀\';\n' +
'  }\n' +
'  renderModalQuestions();\n' +
'  $(\'#chatModal\').classList.add(\'active\');\n' +
'  $(\'#modalError\').style.display = \'none\';\n' +
'  $(\'#modalUUIDInfo\').textContent = \'UUID: \' + state.editingChat.uuid;\n' +
'}\n' +
'\n' +
'function renderModalQuestions() {\n' +
'  const container = $(\'#modalQuestions\');\n' +
'  const questions = state.editingChat.questions || [];\n' +
'  if (questions.length === 0) {\n' +
'    container.innerHTML = \'<div class="empty-state" style="padding:20px 0;">还没有问题，点击下方添加。</div>\';\n' +
'    return;\n' +
'  }\n' +
'  let html = \'\';\n' +
'  for (let i = 0; i < questions.length; i++) {\n' +
'    const q = questions[i];\n' +
'    html += \'<div class="question-block" data-index="\' + i + \'">\' +\n' +
'            \'<div class="q-header">\' +\n' +
'            \'<span class="q-num">问题 \' + (i+1) + \'</span>\' +\n' +
'            \'<button class="q-del" data-index="\' + i + \'" title="删除问题">✕</button>\' +\n' +
'            \'</div>\' +\n' +
'            \'<input class="q-input" data-index="\' + i + \'" value="\' + htmlEscape(q.text) + \'" placeholder="问题内容" maxlength="32" />\' +\n' +
'            \'<div style="font-size:13px;color:var(--text2);margin:4px 0 6px;">选项</div>\' +\n' +
'            \'<div class="options-group" data-index="\' + i + \'">\';\n' +
'    for (let j = 0; j < q.options.length; j++) {\n' +
'      html += \'<input class="opt-input" data-q="\' + i + \'" data-opt="\' + j + \'" value="\' + htmlEscape(q.options[j]) + \'" placeholder="选项" maxlength="32" />\' +\n' +
'              \'<button class="opt-del" data-q="\' + i + \'" data-opt="\' + j + \'" title="删除选项">✕</button>\';\n' +
'    }\n' +
'    html += \'</div>\' +\n' +
'            \'<button class="btn secondary" style="margin-top:8px;padding:4px 14px;font-size:13px;" data-add-opt="\' + i + \'">➕ 添加选项</button>\' +\n' +
'            \'</div>\';\n' +
'  }\n' +
'  container.innerHTML = html;\n' +
'\n' +
'  container.querySelectorAll(\'.q-del\').forEach(btn => {\n' +
'    btn.addEventListener(\'click\', () => {\n' +
'      const idx = parseInt(btn.dataset.index);\n' +
'      state.editingChat.questions.splice(idx, 1);\n' +
'      renderModalQuestions();\n' +
'    });\n' +
'  });\n' +
'  container.querySelectorAll(\'.opt-del\').forEach(btn => {\n' +
'    btn.addEventListener(\'click\', () => {\n' +
'      const qIdx = parseInt(btn.dataset.q);\n' +
'      const oIdx = parseInt(btn.dataset.opt);\n' +
'      const q = state.editingChat.questions[qIdx];\n' +
'      if (q && q.options.length > ' + MIN_OPTIONS + ') {\n' +
'        q.options.splice(oIdx, 1);\n' +
'        renderModalQuestions();\n' +
'      } else {\n' +
'        showToast(\'每个问题至少需要 \' + ' + MIN_OPTIONS + ' + \' 个选项\');\n' +
'      }\n' +
'    });\n' +
'  });\n' +
'  container.querySelectorAll(\'[data-add-opt]\').forEach(btn => {\n' +
'    btn.addEventListener(\'click\', () => {\n' +
'      const qIdx = parseInt(btn.dataset.addOpt);\n' +
'      const q = state.editingChat.questions[qIdx];\n' +
'      if (q && q.options.length < ' + MAX_OPTIONS + ') {\n' +
'        q.options.push(\'\');\n' +
'        renderModalQuestions();\n' +
'      } else {\n' +
'        showToast(\'每个问题最多 \' + ' + MAX_OPTIONS + ' + \' 个选项\');\n' +
'      }\n' +
'    });\n' +
'  });\n' +
'  container.querySelectorAll(\'.q-input\').forEach(inp => {\n' +
'    inp.addEventListener(\'input\', () => {\n' +
'      const idx = parseInt(inp.dataset.index);\n' +
'      state.editingChat.questions[idx].text = inp.value;\n' +
'    });\n' +
'  });\n' +
'  container.querySelectorAll(\'.opt-input\').forEach(inp => {\n' +
'    inp.addEventListener(\'input\', () => {\n' +
'      const qIdx = parseInt(inp.dataset.q);\n' +
'      const oIdx = parseInt(inp.dataset.opt);\n' +
'      state.editingChat.questions[qIdx].options[oIdx] = inp.value;\n' +
'    });\n' +
'  });\n' +
'}\n' +
'\n' +
'$(\'#addQuestionBtn\').addEventListener(\'click\', () => {\n' +
'  const qs = state.editingChat.questions || [];\n' +
'  if (qs.length >= ' + MAX_QUESTIONS + ') {\n' +
'    showToast(\'最多 \' + ' + MAX_QUESTIONS + ' + \' 个问题\');\n' +
'    return;\n' +
'  }\n' +
'  qs.push({ id: \'q\' + Date.now() + \'_\' + qs.length, text: \'\', options: [\'\', \'\'] });\n' +
'  renderModalQuestions();\n' +
'});\n' +
'\n' +
'$(\'#cancelModalBtn\').addEventListener(\'click\', () => {\n' +
'  $(\'#chatModal\').classList.remove(\'active\');\n' +
'});\n' +
'\n' +
'$(\'#saveChatBtn\').addEventListener(\'click\', async () => {\n' +
'  const data = state.editingChat;\n' +
'  const questions = data.questions || [];\n' +
'  if (questions.length < ' + MIN_QUESTIONS + ') {\n' +
'    showToast(\'至少需要 \' + ' + MIN_QUESTIONS + ' + \' 个问题\');\n' +
'    return;\n' +
'  }\n' +
'  for (let i = 0; i < questions.length; i++) {\n' +
'    const q = questions[i];\n' +
'    if (!q.text || q.text.trim().length === 0) {\n' +
'      showToast(\'问题 \' + (i+1) + \' 内容不能为空\');\n' +
'      return;\n' +
'    }\n' +
'    if (q.text.length > ' + MAX_TEXT_LEN + ') {\n' +
'      showToast(\'问题 \' + (i+1) + \' 内容不能超过 \' + ' + MAX_TEXT_LEN + ' + \' 字\');\n' +
'      return;\n' +
'    }\n' +
'    const opts = q.options.filter(o => o && o.trim().length > 0);\n' +
'    if (opts.length < ' + MIN_OPTIONS + ') {\n' +
'      showToast(\'问题 \' + (i+1) + \' 至少需要 \' + ' + MIN_OPTIONS + ' + \' 个选项\');\n' +
'      return;\n' +
'    }\n' +
'    if (opts.length > ' + MAX_OPTIONS + ') {\n' +
'      showToast(\'问题 \' + (i+1) + \' 最多 \' + ' + MAX_OPTIONS + ' + \' 个选项\');\n' +
'      return;\n' +
'    }\n' +
'    for (const o of opts) {\n' +
'      if (o.length > ' + MAX_TEXT_LEN + ') {\n' +
'        showToast(\'选项内容不能超过 \' + ' + MAX_TEXT_LEN + ' + \' 字\');\n' +
'        return;\n' +
'      }\n' +
'    }\n' +
'    q.options = opts;\n' +
'  }\n' +
'\n' +
'  const payload = {\n' +
'    uuid: data.uuid,\n' +
'    questions: questions,\n' +
'    active: false,\n' +
'    createdAt: data.createdAt || new Date().toISOString(),\n' +
'  };\n' +
'\n' +
'  try {\n' +
'    if (state.isNew) {\n' +
'      await apiFetch(\'/api/admin/chat\', { method: \'POST\', body: payload });\n' +
'      showToast(\'✅ 新对话已创建\');\n' +
'    } else {\n' +
'      await apiFetch(\'/api/admin/chat/\' + data.uuid, { method: \'PUT\', body: payload });\n' +
'      showToast(\'✅ 对话已更新\');\n' +
'    }\n' +
'    $(\'#chatModal\').classList.remove(\'active\');\n' +
'    await loadChats();\n' +
'  } catch (e) {\n' +
'    showToast(\'保存失败: \' + e.message);\n' +
'  }\n' +
'});\n' +
'\n' +
'$(\'#newChatBtn\').addEventListener(\'click\', () => {\n' +
'  openEditChat(null);\n' +
'});\n' +
'\n' +
'// 工具函数\n' +
'function htmlEscape(str) {\n' +
'  if (!str) return \'\';\n' +
'  return String(str).replace(/&/g,\'&amp;\').replace(/</g,\'&lt;\').replace(/>/g,\'&gt;\').replace(/"/g,\'&quot;\');\n' +
'}\n' +
'\n' +
'function isChatEditable(chat) {\n' +
'  if (chat.completedAt) return false;\n' +
'  if (chat.exitCount && chat.exitCount > 0) return false;\n' +
'  if (chat.answers && Object.keys(chat.answers).length > 0) return false;\n' +
'  return true;\n' +
'}\n' +
'\n' +
'function generateUUID() {\n' +
'  return \'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx\'.replace(/[xy]/g, c => {\n' +
'    const r = crypto.getRandomValues(new Uint8Array(1))[0] & 0xf;\n' +
'    return (c === \'x\' ? r : (r & 0x3) | 0x8).toString(16);\n' +
'  });\n' +
'}\n' +
'\n' +
'// 初始化\n' +
'loadChats();\n' +
'</script>\n' +
'</body>\n' +
'</html>';
}
function getUserModalHTML() {
    return `
<!-- 自定义模态框 -->
<div class="user-modal-overlay" id="userModal">
  <div class="user-modal">
    <div class="user-modal-icon" id="userModalIcon">⚠️</div>
    <h2 id="userModalTitle">提示</h2>
    <div class="user-modal-message" id="userModalMessage"></div>
    <div class="user-modal-btns">
      <button class="user-modal-btn secondary" id="userModalCancel">取消</button>
      <button class="user-modal-btn primary" id="userModalOk">确定</button>
    </div>
  </div>
</div>
<style>
.user-modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);z-index:9999;align-items:center;justify-content:center;padding:20px;}
.user-modal-overlay.active{display:flex;}
.user-modal{background:#1a1f2b;border:1px solid #2a3448;border-radius:20px;padding:32px;max-width:420px;width:100%;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,0.6);}
.user-modal-icon{font-size:48px;margin-bottom:8px;}
.user-modal h2{color:#e8ecf4;font-size:22px;font-weight:600;margin-bottom:8px;}
.user-modal-message{color:#9aa8be;font-size:16px;line-height:1.6;margin-bottom:24px;}
.user-modal-btns{display:flex;gap:10px;justify-content:center;}
.user-modal-btn{padding:10px 28px;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;transition:0.2s;}
.user-modal-btn.primary{background:#6c8cff;color:#fff;}
.user-modal-btn.primary:hover{background:#5a7ae8;}
.user-modal-btn.secondary{background:#1f2838;color:#e8ecf4;}
.user-modal-btn.secondary:hover{background:#2a3448;}
@media (prefers-color-scheme: light) {
  .user-modal{background:#ffffff;border-color:#d0d8e4;}
  .user-modal h2{color:#1a1f2b;}
  .user-modal-message{color:#5a667a;}
  .user-modal-btn.secondary{background:#eef2f7;color:#1a1f2b;}
  .user-modal-btn.secondary:hover{background:#d0d8e4;}
}
</style>
<script>
function userConfirm(title, message, icon = '⚠️') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('userModal');
    document.getElementById('userModalTitle').textContent = title;
    document.getElementById('userModalMessage').textContent = message;
    document.getElementById('userModalIcon').textContent = icon;
    document.getElementById('userModalCancel').style.display = 'inline-block';
    document.getElementById('userModalOk').textContent = '确定';
    overlay.classList.add('active');
    const ok = () => { overlay.classList.remove('active'); resolve(true); };
    const cancel = () => { overlay.classList.remove('active'); resolve(false); };
    document.getElementById('userModalOk').onclick = ok;
    document.getElementById('userModalCancel').onclick = cancel;
    overlay.onclick = (e) => { if (e.target === overlay) cancel(); };
  });
}
function userAlert(title, message, icon = 'ℹ️') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('userModal');
    document.getElementById('userModalTitle').textContent = title;
    document.getElementById('userModalMessage').textContent = message;
    document.getElementById('userModalIcon').textContent = icon;
    document.getElementById('userModalCancel').style.display = 'none';
    document.getElementById('userModalOk').textContent = '确定';
    overlay.classList.add('active');
    const ok = () => { overlay.classList.remove('active'); resolve(); };
    document.getElementById('userModalOk').onclick = ok;
    overlay.onclick = (e) => { if (e.target === overlay) ok(); };
  });
}
</script>
`;
}

function renderChatPage(chat, progress) {
    const uuid = chat.uuid;
    const questions = chat.questions || [];
    const currentIndex = Number(progress.currentIndex) || 0;
    const answers = progress.answers || {};
    const total = questions.length;
    const isComplete = progress.completedAt !== null && progress.completedAt !== undefined;

    if (isComplete) {
        return renderChatComplete(chat, progress);
    }

    if (currentIndex >= total) {
        return renderChatFeedback(chat, progress);
    }

    const q = questions[currentIndex] || null;
    const qId = q ? q.id : null;
    const options = q ? q.options : [];

    let progressHtml = '';
    for (let i = 0; i < total; i++) {
        const answered = answers[questions[i].id] !== undefined && answers[questions[i].id] !== null;
        const activeClass = (i === currentIndex) ? 'active' : '';
        const doneClass = answered ? 'done' : '';
        progressHtml += `<div class="dot ${doneClass} ${activeClass}"></div>`;
    }

    const answeredCount = Object.keys(answers).length;
    const currentIndexDisplay = Number(currentIndex) + 1;

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>🎞️心理对话问卷</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
:root{--bg:#0b0e14;--surface:#151c28;--surface2:#1f2838;--border:#2a3448;--text:#e8ecf4;--text2:#9aa8be;--primary:#6c8cff;--primary-hover:#5a7ae8;--success:#4cd9a0;--radius:20px;--shadow:0 12px 48px rgba(0,0,0,0.5);}
body{background:var(--bg);color:var(--text);font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}
.container{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:36px 40px;max-width:680px;width:100%;box-shadow:var(--shadow);}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;}
.header .title{font-size:22px;font-weight:700;letter-spacing:-0.3px;display:flex;align-items:center;gap:10px;}
.header .badge{background:var(--primary);color:#fff;font-size:13px;padding:2px 14px;border-radius:20px;font-weight:500;}
.progress-bar{display:flex;gap:6px;margin-bottom:28px;flex-wrap:wrap;}
.dot{width:28px;height:28px;border-radius:50%;background:var(--surface2);border:2px solid var(--border);transition:0.3s;}
.dot.done{background:var(--success);border-color:var(--success);}
.dot.active{border-color:var(--primary);box-shadow:0 0 0 4px rgba(108,140,255,0.2);}
.progress-text{font-size:14px;color:var(--text2);margin-bottom:20px;}
.question-text{font-size:20px;font-weight:600;line-height:1.6;margin-bottom:24px;padding:8px 0;}
.options{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
@media (max-width:500px){.options{grid-template-columns:1fr;}}
.option-btn{background:var(--surface2);border:1.5px solid var(--border);border-radius:14px;padding:14px 18px;color:var(--text);font-size:16px;text-align:left;cursor:pointer;transition:0.2s;font-weight:500;}
.option-btn:hover{background:var(--primary);border-color:var(--primary);color:#fff;transform:scale(1.02);}
.option-btn:active{transform:scale(0.97);}
.option-btn.selected{background:var(--primary);border-color:var(--primary);color:#fff;}
.footer{margin-top:28px;display:flex;justify-content:space-between;align-items:center;color:var(--text2);font-size:14px;}
.footer .counter{font-weight:500;}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="title">🎁倾听你的心声...☺️</div>
    <div class="badge">那一抹未竟的晨光</div>
  </div>

  <div class="progress-bar">${progressHtml}</div>
  <div class="progress-text">第 ${currentIndexDisplay} / ${total} 题</div>

  <div class="question-text">${q ? htmlEscape(q.text) : ''}</div>

  <div class="options" id="optionsContainer">
    ${options.map((opt, idx) => `
      <button class="option-btn" data-value="${htmlEscape(opt)}">${htmlEscape(opt)}</button>
    `).join('')}
  </div>

  <div class="footer">
    <span class="counter">${answeredCount} / ${total} 已作答</span>
    <span style="font-size:13px;">💡 邮箱 : love@thisissunny.cc.cd </span>
  </div>
</div>

${getUserModalHTML()}

<script>
const uuid = '${uuid}';
let currentIndex = ${currentIndex};
const total = ${total};
const answers = ${JSON.stringify(answers)};

document.querySelectorAll('.option-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const value = btn.dataset.value;
    document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
    btn.classList.add('selected');

    try {
      const res = await fetch('/api/chat/' + uuid + '/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: '${qId}', answer: value })
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const err = await res.json();
        await userAlert('保存失败', err.error || '未知错误', '❌');
        document.querySelectorAll('.option-btn').forEach(b => b.disabled = false);
      }
    } catch (e) {
      await userAlert('网络错误', '请检查网络后重试', '🌐');
      document.querySelectorAll('.option-btn').forEach(b => b.disabled = false);
    }
  });
});
</script>
</body>
</html>`;
}

function renderChatFeedback(chat, progress) {
    const uuid = chat.uuid;
    const questions = chat.questions || [];
    const answers = progress.answers || {};
    const total = questions.length;

    let answersHtml = '';
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const ans = answers[q.id] || '未作答';
        answersHtml += `<div class="ar-item">
            <span class="ar-q">${i+1}. ${htmlEscape(q.text)}</span>
            <span class="ar-a">${htmlEscape(ans)}</span>
        </div>`;
    }

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>🫧谢谢，晨旭</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
:root{--bg:#0b0e14;--surface:#151c28;--surface2:#1f2838;--border:#2a3448;--text:#e8ecf4;--text2:#9aa8be;--primary:#6c8cff;--primary-hover:#5a7ae8;--success:#4cd9a0;--radius:20px;--shadow:0 12px 48px rgba(0,0,0,0.5);}
body{background:var(--bg);color:var(--text);font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}
.container{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:36px 40px;max-width:680px;width:100%;box-shadow:var(--shadow);}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;}
.header .title{font-size:22px;font-weight:700;display:flex;align-items:center;gap:10px;}
.header .badge{background:var(--success);color:#0b0e14;font-size:13px;padding:2px 14px;border-radius:20px;font-weight:600;}
.thank-you{font-size:18px;font-weight:600;margin-bottom:8px;}
.sub-text{color:var(--text2);font-size:15px;margin-bottom:24px;line-height:1.6;}
.feedback-area textarea{width:100%;padding:16px 18px;background:var(--bg);border:1.5px solid var(--border);border-radius:14px;color:var(--text);font-size:16px;font-family:inherit;resize:vertical;min-height:140px;outline:none;transition:0.2s;}
.feedback-area textarea:focus{border-color:var(--primary);box-shadow:0 0 0 4px rgba(108,140,255,0.12);}
.feedback-area .char-count{text-align:right;font-size:13px;color:var(--text2);margin-top:6px;}
.btn-row{display:flex;gap:12px;margin-top:20px;}
.btn-row .btn{flex:1;padding:14px;border:none;border-radius:14px;font-size:16px;font-weight:600;cursor:pointer;transition:0.2s;}
.btn-row .btn.primary{background:var(--primary);color:#fff;}
.btn-row .btn.primary:hover{background:var(--primary-hover);}
.btn-row .btn.secondary{background:var(--surface2);color:var(--text);}
.btn-row .btn.secondary:hover{background:var(--border);}
.btn-row .btn:disabled{opacity:0.5;cursor:not-allowed;}
.answers-review{margin-top:24px;border-top:1px solid var(--border);padding-top:20px;}
.answers-review .ar-title{font-weight:600;font-size:15px;margin-bottom:12px;}
.answers-review .ar-item{display:flex;gap:12px;padding:6px 0;font-size:14px;color:var(--text2);}
.answers-review .ar-item .ar-q{flex:1;}
.answers-review .ar-item .ar-a{font-weight:500;color:var(--text);}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="title">💖感谢！💗</div>
    <div class="badge">✅ 完成</div>
  </div>

  <div class="thank-you">🎉 全部答完啦！</div>
  <div class="sub-text">已收到你的回复啦！如果有其它想对我说的，欢迎写在下面！💌</div>

  <div class="feedback-area">
    <textarea id="feedbackInput" maxlength="520" placeholder="这里缺少你的痕迹！说点什么吧...（520字以内）"></textarea>
    <div class="char-count"><span id="charCount">0</span> / 520</div>
  </div>

  <div class="btn-row">
    <button class="btn secondary" id="skipBtn">跳过</button>
    <button class="btn primary" id="submitBtn">💬 提交反馈</button>
  </div>

  <div class="answers-review">
    <div class="ar-title">📝 你的回答</div>
    ${answersHtml}
  </div>
</div>

${getUserModalHTML()}

<script>
const uuid = '${uuid}';
const feedbackInput = document.getElementById('feedbackInput');
const charCount = document.getElementById('charCount');

feedbackInput.addEventListener('input', () => {
  charCount.textContent = feedbackInput.value.length;
});

document.getElementById('submitBtn').addEventListener('click', async () => {
  const feedback = feedbackInput.value.trim();
  if (feedback.length > 520) {
    await userAlert('提示', '反馈内容不能超过 520 字', '⚠️');
    return;
  }
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = '提交中…';
  try {
    const res = await fetch('/api/chat/' + uuid + '/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback })
    });
    if (res.ok) {
      window.location.href = '/chat/' + uuid + '?complete=true';
    } else {
      const err = await res.json();
      await userAlert('提交失败', err.error || '未知错误', '❌');
      btn.disabled = false;
      btn.textContent = '💬 提交反馈';
    }
  } catch (e) {
    await userAlert('网络错误', '请检查网络后重试', '🌐');
    btn.disabled = false;
    btn.textContent = '💬 提交反馈';
  }
});

document.getElementById('skipBtn').addEventListener('click', async () => {
  const confirmed = await userConfirm('跳过反馈', '确定跳过反馈直接完成吗？', '⚠️');
  if (!confirmed) return;
  const btn = document.getElementById('skipBtn');
  btn.disabled = true;
  btn.textContent = '提交中…';
  try {
    const res = await fetch('/api/chat/' + uuid + '/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: '' })
    });
    if (res.ok) {
      window.location.href = '/chat/' + uuid + '?complete=true';
    } else {
      const err = await res.json();
      await userAlert('提交失败', err.error || '未知错误', '❌');
      btn.disabled = false;
      btn.textContent = '跳过';
    }
  } catch (e) {
    await userAlert('网络错误', '请检查网络后重试', '🌐');
    btn.disabled = false;
    btn.textContent = '跳过';
  }
});
</script>
</body>
</html>`;
}

function renderChatComplete(chat, progress) {
    const uuid = chat.uuid;
    const questions = chat.questions || [];
    const answers = progress.answers || {};
    const total = questions.length;
    const completedAt = progress.completedAt ? new Date(progress.completedAt).toLocaleString('zh-CN') : '';

    let answersHtml = '';
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const ans = answers[q.id] || '未作答';
        answersHtml += `<div class="item">
            <span class="q">${i+1}. ${htmlEscape(q.text)}</span>
            <span class="a">${htmlEscape(ans)}</span>
        </div>`;
    }

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>🎆万事如意~</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
:root{--bg:#0b0e14;--surface:#151c28;--surface2:#1f2838;--border:#2a3448;--text:#e8ecf4;--text2:#9aa8be;--primary:#6c8cff;--success:#4cd9a0;--radius:20px;--shadow:0 12px 48px rgba(0,0,0,0.5);}
body{background:var(--bg);color:var(--text);font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}
.container{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:36px 40px;max-width:680px;width:100%;box-shadow:var(--shadow);text-align:center;}
.icon{font-size:64px;margin-bottom:16px;}
.title{font-size:28px;font-weight:700;margin-bottom:8px;}
.sub{color:var(--text2);font-size:16px;margin-bottom:24px;line-height:1.6;}
.detail{text-align:left;border-top:1px solid var(--border);padding-top:20px;margin-top:20px;}
.detail .row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:var(--text2);}
.detail .row .label{font-weight:500;}
.detail .row .value{color:var(--text);}
.answers-list{margin-top:16px;text-align:left;}
.answers-list .item{display:flex;gap:12px;padding:6px 0;font-size:14px;border-bottom:1px solid var(--border);}
.answers-list .item:last-child{border-bottom:none;}
.answers-list .q{flex:1;color:var(--text2);}
.answers-list .a{font-weight:500;color:var(--text);}
</style>
</head>
<body>
<div class="container">
  <div class="icon">🌅</div>
  <div class="title">对话已完成</div>
  <div class="sub">感谢你的参与！<br>完成时间：${completedAt}</div>

  <div class="detail">
    <div class="row"><span class="label">总题数</span><span class="value">${total}</span></div>
    <div class="row"><span class="label">已作答</span><span class="value">${Object.keys(answers).length}</span></div>
  </div>

  <div class="answers-list">
    ${answersHtml}
  </div>
</div>
</body>
</html>`;
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        if (path === '/') {
            return textResponse('404 Not Found', 404);
        }

        if (path === '/authentication') {
            const cookie = getCookie(request, COOKIE_NAME);
            if (cookie) {
                const key = env.SUNNY_KEY || '';
                if (cookie === key) {
                    return redirectResponse('/administrator');
                }
            }
            return htmlResponse(renderLoginPage());
        }

        if (path === '/administrator') {
            const cookie = getCookie(request, COOKIE_NAME);
            const key = env.SUNNY_KEY || '';
            if (!cookie || cookie !== key) {
                return redirectResponse('/authentication');
            }
            return htmlResponse(renderAdminPage());
        }

        if (path.startsWith('/chat/')) {
            const uuid = path.replace('/chat/', '').split('/')[0].split('?')[0];
            if (!isValidUUID(uuid)) {
                return textResponse('404 Not Found', 404);
            }

            const chat = await getChatData(env, uuid);
            if (!chat || !chat.active) {
                return textResponse('404 Not Found', 404);
            }

            const progress = {
                currentIndex: chat.currentQuestionIndex || 0,
                answers: chat.answers || {},
                exitCount: chat.exitCount || 0,
                firstVisit: chat.firstVisit || null,
                completedAt: chat.completedAt || null,
            };

            if (progress.completedAt) {
                return htmlResponse(renderChatComplete(chat, progress));
            }

            if (!chat.firstVisit) {
                chat.firstVisit = new Date().toISOString();
                await setChatData(env, uuid, chat);
                progress.firstVisit = chat.firstVisit;
            }

            const total = chat.questions ? chat.questions.length : 0;
            const answeredCount = Object.keys(progress.answers).length;

            if (answeredCount >= total && total > 0 && !chat.completedAt) {
                return htmlResponse(renderChatFeedback(chat, progress));
            }

            const cookieKey = 'sunny_session_' + uuid;
            const hasSession = getCookie(request, cookieKey);
            if (!hasSession && !chat.completedAt) {
                chat.exitCount = (chat.exitCount || 0) + 1;
                await setChatData(env, uuid, chat);
                progress.exitCount = chat.exitCount;
            }

            const html = renderChatPage(chat, progress);
            const response = htmlResponse(html);

            if (!hasSession && !chat.completedAt) {
                response.headers.set('Set-Cookie', setCookie(cookieKey, '1', 60 * 60 * 24));
            }

            return response;
        }

        if (path === '/api/auth/login' && method === 'POST') {
            try {
                const body = await request.json();
                const key = env.SUNNY_KEY || '';
                if (body.key === key) {
                    const response = jsonResponse({ success: true });
                    response.headers.set('Set-Cookie', setCookie(COOKIE_NAME, key, COOKIE_MAX_AGE));
                    return response;
                } else {
                    return jsonResponse({ error: '密钥错误' }, 401);
                }
            } catch {
                return jsonResponse({ error: '无效请求' }, 400);
            }
        }

        if (path === '/api/auth/logout' && method === 'POST') {
            const response = jsonResponse({ success: true });
            response.headers.set('Set-Cookie', clearCookie(COOKIE_NAME));
            return response;
        }

        if (path === '/api/admin/chat' && method === 'GET') {
            const cookie = getCookie(request, COOKIE_NAME);
            const key = env.SUNNY_KEY || '';
            if (!cookie || cookie !== key) return jsonResponse({ error: '未授权' }, 401);
            const chats = await getAllChats(env);
            return jsonResponse({ chats });
        }

        if (path.match(/^\/api\/admin\/chat\/[0-9a-f-]+$/) && method === 'GET') {
            const uuid = path.split('/').pop();
            if (!isValidUUID(uuid)) return jsonResponse({ error: '无效UUID' }, 400);
            const cookie = getCookie(request, COOKIE_NAME);
            const key = env.SUNNY_KEY || '';
            if (!cookie || cookie !== key) return jsonResponse({ error: '未授权' }, 401);
            const chat = await getChatData(env, uuid);
            if (!chat) return jsonResponse({ error: '对话不存在' }, 404);
            return jsonResponse(chat);
        }

        if (path === '/api/admin/chat' && method === 'POST') {
            const cookie = getCookie(request, COOKIE_NAME);
            const key = env.SUNNY_KEY || '';
            if (!cookie || cookie !== key) return jsonResponse({ error: '未授权' }, 401);
            try {
                const body = await request.json();
                if (!body.uuid || !isValidUUID(body.uuid)) {
                    return jsonResponse({ error: '无效UUID' }, 400);
                }
                if (!body.questions || !Array.isArray(body.questions)) {
                    return jsonResponse({ error: '问题数据无效' }, 400);
                }
                const testData = { questions: body.questions };
                if (!validateChatData(testData)) {
                    return jsonResponse({ error: '问题或选项不符合规范（题目数4-16题，每题2-8选项，每项最多32字）' }, 400);
                }
                const existing = await getChatData(env, body.uuid);
                if (existing) {
                    return jsonResponse({ error: 'UUID已存在' }, 400);
                }

                const newChat = {
                    uuid: body.uuid,
                    createdAt: body.createdAt || new Date().toISOString(),
                    questions: body.questions,
                    active: false,
                    firstVisit: null,
                    completedAt: null,
                    exitCount: 0,
                    currentQuestionIndex: 0,
                    answers: {},
                };
                await setChatData(env, body.uuid, newChat);
                return jsonResponse({ success: true, uuid: body.uuid });
            } catch (e) {
                return jsonResponse({ error: `创建失败: ${e.message}` }, 500);
            }
        }

        if (path.match(/^\/api\/admin\/chat\/[0-9a-f-]+$/) && method === 'PUT') {
            const uuid = path.split('/').pop();
            if (!isValidUUID(uuid)) return jsonResponse({ error: '无效UUID' }, 400);
            const cookie = getCookie(request, COOKIE_NAME);
            const key = env.SUNNY_KEY || '';
            if (!cookie || cookie !== key) return jsonResponse({ error: '未授权' }, 401);
            try {
                const body = await request.json();
                const existing = await getChatData(env, uuid);
                if (!existing) return jsonResponse({ error: '对话不存在' }, 404);
                if (!isChatEditable(existing)) {
                    return jsonResponse({ error: '对话已有作答记录，不可编辑' }, 403);
                }
                if (!body.questions || !Array.isArray(body.questions)) {
                    return jsonResponse({ error: '问题数据无效' }, 400);
                }
                const testData = { questions: body.questions };
                if (!validateChatData(testData)) {
                    return jsonResponse({ error: '问题或选项不符合规范（题目数4-16题，每题2-8选项，每项最多32字）' }, 400);
                }
                existing.questions = body.questions;
                existing.createdAt = body.createdAt || existing.createdAt;
                await setChatData(env, uuid, existing);
                return jsonResponse({ success: true });
            } catch (e) {
                return jsonResponse({ error: `更新失败: ${e.message}` }, 500);
            }
        }

        if (path.match(/^\/api\/admin\/chat\/[0-9a-f-]+\/activate$/) && method === 'POST') {
            const uuid = path.split('/')[4];
            if (!isValidUUID(uuid)) return jsonResponse({ error: '无效UUID' }, 400);
            const cookie = getCookie(request, COOKIE_NAME);
            const key = env.SUNNY_KEY || '';
            if (!cookie || cookie !== key) return jsonResponse({ error: '未授权' }, 401);
            const chat = await getChatData(env, uuid);
            if (!chat) return jsonResponse({ error: '对话不存在' }, 404);
            const all = await getAllChats(env);
            for (const c of all) {
                if (c.active && c.uuid !== uuid) {
                    c.active = false;
                    await setChatData(env, c.uuid, c);
                }
            }
            chat.active = true;
            await setChatData(env, uuid, chat);
            return jsonResponse({ success: true });
        }

        if (path.match(/^\/api\/admin\/chat\/[0-9a-f-]+\/deactivate$/) && method === 'POST') {
            const uuid = path.split('/')[4];
            if (!isValidUUID(uuid)) return jsonResponse({ error: '无效UUID' }, 400);
            const cookie = getCookie(request, COOKIE_NAME);
            const key = env.SUNNY_KEY || '';
            if (!cookie || cookie !== key) return jsonResponse({ error: '未授权' }, 401);
            const chat = await getChatData(env, uuid);
            if (!chat) return jsonResponse({ error: '对话不存在' }, 404);
            chat.active = false;
            await setChatData(env, uuid, chat);
            return jsonResponse({ success: true });
        }

        if (path.match(/^\/api\/admin\/chat\/[0-9a-f-]+\/reset$/) && method === 'POST') {
            const uuid = path.split('/')[4];
            if (!isValidUUID(uuid)) return jsonResponse({ error: '无效UUID' }, 400);
            const cookie = getCookie(request, COOKIE_NAME);
            const key = env.SUNNY_KEY || '';
            if (!cookie || cookie !== key) return jsonResponse({ error: '未授权' }, 401);
            const chat = await getChatData(env, uuid);
            if (!chat) return jsonResponse({ error: '对话不存在' }, 404);
            chat.firstVisit = null;
            chat.completedAt = null;
            chat.exitCount = 0;
            chat.currentQuestionIndex = 0;
            chat.answers = {};
            await setChatData(env, uuid, chat);
            return jsonResponse({ success: true });
        }

        if (path === '/api/admin/feedbacks' && method === 'GET') {
            const cookie = getCookie(request, COOKIE_NAME);
            const key = env.SUNNY_KEY || '';
            if (!cookie || cookie !== key) return jsonResponse({ error: '未授权' }, 401);
            const feedbacks = await getAllFeedback(env);
            return jsonResponse({ feedbacks });
        }

        if (path.match(/^\/api\/admin\/feedback\/[0-9a-f-]+$/) && method === 'DELETE') {
            const uuid = path.split('/').pop();
            if (!isValidUUID(uuid)) return jsonResponse({ error: '无效UUID' }, 400);
            const cookie = getCookie(request, COOKIE_NAME);
            const key = env.SUNNY_KEY || '';
            if (!cookie || cookie !== key) return jsonResponse({ error: '未授权' }, 401);
            await env.SUNNY_DATA_FEEDBACK.delete(uuid);
            return jsonResponse({ success: true });
        }

        if (path.match(/^\/api\/chat\/[0-9a-f-]+\/answer$/) && method === 'POST') {
            const uuid = path.split('/')[3];
            if (!isValidUUID(uuid)) return jsonResponse({ error: '无效UUID' }, 400);
            const chat = await getChatData(env, uuid);
            if (!chat || !chat.active) return jsonResponse({ error: '对话不存在或未激活' }, 404);
            if (chat.completedAt) return jsonResponse({ error: '对话已完成' }, 400);
            try {
                const body = await request.json();
                const { questionId, answer } = body;
                if (!questionId || answer === undefined || answer === null) {
                    return jsonResponse({ error: '缺少问题ID或答案' }, 400);
                }
                const q = chat.questions.find(q => q.id === questionId);
                if (!q) return jsonResponse({ error: '问题不存在' }, 400);
                if (!q.options.includes(answer)) {
                    return jsonResponse({ error: '无效选项' }, 400);
                }
                chat.answers = chat.answers || {};
                chat.answers[questionId] = answer;
                const total = chat.questions.length;
                const answered = Object.keys(chat.answers).length;
                if (answered >= total) {
                    chat.currentQuestionIndex = total;
                } else {
                    let nextIdx = 0;
                    for (let i = 0; i < total; i++) {
                        const qid = chat.questions[i].id;
                        if (!chat.answers[qid]) {
                            nextIdx = i;
                            break;
                        }
                    }
                    chat.currentQuestionIndex = nextIdx;
                }
                await setChatData(env, uuid, chat);
                return jsonResponse({ success: true, nextIndex: chat.currentQuestionIndex });
            } catch (e) {
                return jsonResponse({ error: `保存失败: ${e.message}` }, 500);
            }
        }

        if (path.match(/^\/api\/chat\/[0-9a-f-]+\/feedback$/) && method === 'POST') {
            const uuid = path.split('/')[3];
            if (!isValidUUID(uuid)) return jsonResponse({ error: '无效UUID' }, 400);
            const chat = await getChatData(env, uuid);
            if (!chat || !chat.active) return jsonResponse({ error: '对话不存在或未激活' }, 404);
            if (chat.completedAt) return jsonResponse({ error: '对话已完成' }, 400);
            try {
                const body = await request.json();
                const feedback = body.feedback || '';
                if (feedback.length > MAX_FEEDBACK_LEN) {
                    return jsonResponse({ error: `反馈内容超过 ${MAX_FEEDBACK_LEN} 字限制` }, 400);
                }
                if (feedback.trim()) {
                    const fbData = {
                        uuid: uuid,
                        feedback: feedback.trim(),
                        createdAt: new Date().toISOString(),
                    };
                    await setFeedbackData(env, uuid, fbData);
                }
                chat.completedAt = new Date().toISOString();
                chat.currentQuestionIndex = chat.questions.length;
                await setChatData(env, uuid, chat);
                return jsonResponse({ success: true });
            } catch (e) {
                return jsonResponse({ error: `提交反馈失败: ${e.message}` }, 500);
            }
        }

        // ---------- 404 ----------
        return textResponse('404 Not Found', 404);
    }
};