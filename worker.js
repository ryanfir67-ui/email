import PostalMime from 'postal-mime';

const DEFAULT_DOMAIN = 'ryy.my.id';

const NEAT_WORDS = [
  'mail', 'inbox', 'box', 'temp', 'user', 'hello', 'hey',
  'contact', 'info', 'admin', 'office', 'team', 'work',
  'home', 'post', 'relay', 'note', 'ping'
];

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#4f46e5"/>
  <path d="M14 20h36a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V22a2 2 0 0 1 2-2z" fill="#fff"/>
  <path d="M12 22l20 14 20-14" stroke="#4f46e5" stroke-width="2" fill="none" stroke-linejoin="round"/>
</svg>`;

function generateNeatLocalPart() {
  const word = NEAT_WORDS[Math.floor(Math.random() * NEAT_WORDS.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return word + '-' + num;
}

export default {
  async email(message, env, ctx) {
    let recipients = [];
    if (Array.isArray(message.to)) {
      recipients = message.to;
    } else {
      recipients = [message.to];
    }

    let rawBuffer;
    try {
      rawBuffer = await new Response(message.raw).arrayBuffer();
    } catch (e) {
      rawBuffer = new ArrayBuffer(0);
    }

    let parsed;
    try {
      const parser = new PostalMime();
      parsed = await parser.parse(rawBuffer);
    } catch (e) {
      parsed = { text: '', html: '' };
    }

    let text = parsed.text || '';
    let html = parsed.html || '';

    if (!text && !html && rawBuffer.byteLength > 0) {
      try {
        text = new TextDecoder().decode(rawBuffer);
      } catch (e) {
        text = 'Tidak dapat membaca isi email.';
      }
    }

    for (const toAddress of recipients) {
      const parts = toAddress.split('@');
      if (parts.length < 2) continue;
      const localPart = parts[0];
      const domain = parts.slice(1).join('@');

      const headers = message.headers;
      const from = headers.get('from') || 'Unknown';
      const subject = headers.get('subject') || '(no subject)';
      const date = headers.get('date') || new Date().toISOString();

      const emailObject = {
        id: crypto.randomUUID(),
        from,
        to: toAddress,
        subject,
        date,
        text,
        html,
        raw: text || html ? '' : new TextDecoder().decode(rawBuffer)
      };

      const ts = Date.now();
      const key = `msg:${domain}:${localPart}:${ts}:${emailObject.id}`;
      await env.EMAIL_STORE.put(key, JSON.stringify(emailObject));
    }
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (path === '/favicon.ico' || path === '/favicon.svg') {
      return new Response(FAVICON_SVG, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    if (path === '/' && request.method === 'GET') {
      return new Response(getHtml(), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
          ...corsHeaders,
        },
      });
    }

    if (path === '/api/all-emails' && request.method === 'GET') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 200);

      const list = await env.EMAIL_STORE.list({ prefix: 'msg:', limit: 1000 });

      const sortedKeys = list.keys
        .map(k => k.name)
        .sort((a, b) => {
          const partsA = a.split(':');
          const partsB = b.split(':');
          const tsA = parseInt(partsA[partsA.length - 2], 10) || 0;
          const tsB = parseInt(partsB[partsB.length - 2], 10) || 0;
          return tsB - tsA;
        })
        .slice(0, limit);

      const values = await Promise.all(
        sortedKeys.map(key => env.EMAIL_STORE.get(key))
      );

      const emails = [];
      for (const value of values) {
        if (value) {
          try {
            emails.push(JSON.parse(value));
          } catch (e) {}
        }
      }

      return new Response(JSON.stringify(emails), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=5',
          ...corsHeaders,
        },
      });
    }

    if (path === '/api/generate' && request.method === 'POST') {
      const localPart = generateNeatLocalPart();
      const domain = env.EMAIL_DOMAIN || DEFAULT_DOMAIN;
      const fullAddress = `${localPart}@${domain}`;
      return jsonResponse({ address: fullAddress, localPart, domain }, 200, corsHeaders);
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  },
};

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

function getHtml() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Temp Mail – ryy.my.id</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}">
  <style>
    :root {
      --bg: #f5f7fa;
      --card-bg: #ffffff;
      --text: #1a1a2e;
      --text-secondary: #6b7280;
      --border: #e5e7eb;
      --accent: #4f46e5;
      --accent-hover: #4338ca;
      --shadow: 0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1);
      --radius: 12px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 20px;
    }
    main { width: 100%; max-width: 820px; margin: 0 auto; }
    header { text-align: center; margin-bottom: 24px; padding: 12px 0; }
    header h1 { font-size: 2.25rem; font-weight: 700; letter-spacing: -0.5px; }
    header p { color: var(--text-secondary); font-size: 0.95rem; }

    .address-card {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: white;
      border-radius: var(--radius);
      padding: 20px 22px;
      margin-bottom: 20px;
      box-shadow: 0 6px 20px rgba(79, 70, 229, 0.25);
    }
    .address-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      opacity: 0.9;
      margin-bottom: 10px;
      font-weight: 600;
    }
    .address-row {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    }
    .address-value {
      font-size: 1.2rem;
      font-weight: 600;
      flex: 1 1 200px;
      word-break: break-all;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace;
      letter-spacing: 0.2px;
    }
    .address-card .btn {
      background: rgba(255,255,255,0.18);
      color: white;
      border: 1px solid rgba(255,255,255,0.3);
      backdrop-filter: blur(4px);
    }
    .address-card .btn:hover { background: rgba(255,255,255,0.3); }

    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 10px 16px; background: var(--accent); color: white;
      border: none; border-radius: 8px; font-size: 0.88rem;
      font-weight: 500; cursor: pointer; transition: background 0.2s, transform 0.1s;
      text-decoration: none;
    }
    .btn:hover { background: var(--accent-hover); }
    .btn:active { transform: scale(0.98); }
    .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--text-secondary); }
    .btn-outline:hover { background: var(--border); }
    .btn-small { padding: 8px 12px; font-size: 0.82rem; }

    .filter-bar {
      display: flex; gap: 10px; margin-bottom: 16px;
      flex-wrap: wrap; align-items: center;
    }
    .search-wrapper { flex: 1; min-width: 200px; position: relative; }
    .search-wrapper::before {
      content: '🔍';
      position: absolute; left: 12px; top: 50%;
      transform: translateY(-50%);
      font-size: 0.85rem; opacity: 0.6; pointer-events: none;
    }
    .search-input {
      width: 100%; padding: 10px 14px 10px 36px;
      border: 1px solid var(--border); border-radius: 8px;
      font-size: 0.9rem; background: var(--card-bg);
      transition: border 0.2s, box-shadow 0.2s; font-family: inherit;
    }
    .search-input:focus {
      outline: none; border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(79,70,229,0.1);
    }
    .filter-tabs {
      display: flex; gap: 3px; background: var(--card-bg);
      border: 1px solid var(--border); border-radius: 8px; padding: 3px;
    }
    .tab {
      padding: 6px 12px; background: transparent; border: none;
      border-radius: 6px; font-size: 0.82rem; color: var(--text-secondary);
      cursor: pointer; transition: all 0.15s; font-family: inherit; font-weight: 500;
    }
    .tab:hover { color: var(--text); }
    .tab.active { background: var(--accent); color: white; }

    .email-list { display: flex; flex-direction: column; gap: 12px; }
    .email-card {
      background: var(--card-bg); border: 1px solid var(--border);
      border-radius: var(--radius); box-shadow: var(--shadow);
      padding: 16px 18px; transition: all 0.2s ease; cursor: pointer;
    }
    .email-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: #d1d5db; }
    .email-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
    .email-subject { font-weight: 600; font-size: 1.02rem; word-break: break-word; }
    .email-meta { display: flex; flex-direction: column; gap: 2px; font-size: 0.85rem; color: var(--text-secondary); margin-top: 6px; }
    .email-meta span { display: block; }
    .email-content {
      display: none; margin-top: 12px; border-top: 1px solid var(--border);
      padding-top: 12px; max-height: 400px; overflow-y: auto; cursor: auto;
    }
    .email-card.open .email-content { display: block; }
    .email-content pre {
      white-space: pre-wrap; font-family: monospace; font-size: 0.85rem;
      background: #f9fafb; padding: 10px; border-radius: 8px; user-select: text;
    }
    .email-html {
      max-height: 400px; overflow-y: auto; background: #f9fafb;
      padding: 10px; border-radius: 8px; user-select: text; word-break: break-word;
    }
    .email-html * { max-width: 100%; }
    .empty-state {
      text-align: center; padding: 60px 20px; background: var(--card-bg);
      border: 1px dashed var(--border); border-radius: var(--radius);
      color: var(--text-secondary);
    }
    .badge {
      background: #eef2ff; color: var(--accent); padding: 2px 8px;
      border-radius: 20px; font-size: 0.72rem; font-weight: 500; white-space: nowrap;
    }
    .loading-bar {
      height: 3px; background: linear-gradient(90deg, #4f46e5, #7c3aed);
      width: 0; border-radius: 2px; transition: width 0.3s ease;
      margin-bottom: 10px;
    }
    .loading-bar.active { width: 100%; }

    .toast-container {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      z-index: 9999; display: flex; flex-direction: column; align-items: center;
      gap: 10px; pointer-events: none; width: 100%; max-width: 480px; padding: 0 16px;
    }
    .toast {
      pointer-events: auto; background: #1f2937; color: #ffffff;
      padding: 12px 18px; border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15); font-size: 0.88rem;
      display: flex; align-items: center; gap: 12px; width: 100%;
      animation: slideUp 0.3s ease-out; word-break: break-all;
    }
    .toast.success { background: #059669; }
    .toast.error { background: #dc2626; }
    .toast .toast-text { flex: 1; }
    .toast code {
      background: rgba(255,255,255,0.15); padding: 2px 6px;
      border-radius: 4px; font-family: monospace; font-size: 0.88rem;
    }
    .toast .toast-close {
      background: transparent; border: none; color: white;
      cursor: pointer; font-size: 1.1rem; line-height: 1;
      padding: 0 4px; opacity: 0.7;
    }
    .toast .toast-close:hover { opacity: 1; }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeOut {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(20px); }
    }
    .toast.hide { animation: fadeOut 0.3s ease-in forwards; }

    @media (max-width: 600px) {
      header h1 { font-size: 1.8rem; }
      .address-value { font-size: 1rem; }
      .filter-tabs { flex-wrap: wrap; }
      .tab { font-size: 0.78rem; padding: 6px 9px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>📬 Temp Mail</h1>
      <p>Catch‑all inbox untuk domain <strong>${DEFAULT_DOMAIN}</strong></p>
    </header>

    <div class="address-card">
      <div class="address-label">📮 Alamat Email Aktif</div>
      <div class="address-row">
        <div class="address-value" id="currentAddress">memuat…</div>
        <button class="btn btn-small" onclick="copyAddress()">📋 Salin</button>
        <button class="btn btn-small" onclick="newAddress()">⚡ Alamat Baru</button>
      </div>
    </div>

    <div class="filter-bar">
      <div class="search-wrapper">
        <input type="text" id="searchInput" class="search-input" placeholder="Cari subjek, pengirim, atau penerima…" oninput="applyFilter()">
      </div>
      <div class="filter-tabs" role="tablist">
        <button class="tab active" data-range="all" onclick="setRange('all')">Semua</button>
        <button class="tab" data-range="today" onclick="setRange('today')">Hari ini</button>
        <button class="tab" data-range="7days" onclick="setRange('7days')">7 Hari</button>
        <button class="tab" data-range="30days" onclick="setRange('30days')">30 Hari</button>
      </div>
    </div>

    <div class="loading-bar" id="loadingBar"></div>
    <div id="emailList" class="email-list">
      <div class="empty-state">Memuat email…</div>
    </div>
  </main>

  <div id="toastContainer" class="toast-container"></div>

  <script>
    const DOMAIN = '${DEFAULT_DOMAIN}';
    const NEAT_WORDS = ['mail','inbox','box','temp','user','hello','hey','contact','info','admin','office','team','work','home','post','relay','note','ping'];
    let allEmails = [];
    let openEmailId = null;
    let filterState = { query: '', range: 'all' };
    let isFetching = false;
    let lastIds = null;

    function makeNeatAddress() {
      const w = NEAT_WORDS[Math.floor(Math.random() * NEAT_WORDS.length)];
      const n = Math.floor(1000 + Math.random() * 9000);
      return w + '-' + n + '@' + DOMAIN;
    }
    function initAddress() {
      let addr = localStorage.getItem('tempMailAddress');
      if (!addr || !addr.endsWith('@' + DOMAIN)) {
        addr = makeNeatAddress();
        localStorage.setItem('tempMailAddress', addr);
      }
      document.getElementById('currentAddress').textContent = addr;
    }
    function newAddress() {
      const addr = makeNeatAddress();
      localStorage.setItem('tempMailAddress', addr);
      document.getElementById('currentAddress').textContent = addr;
      showToast('✨ Alamat baru dibuat: <code>' + escapeHtml(addr) + '</code>', 'success', 4000);
    }
    function copyAddress() {
      const addr = document.getElementById('currentAddress').textContent;
      navigator.clipboard.writeText(addr).then(() => {
        showToast('✅ Alamat disalin ke clipboard', 'success', 2500);
      }).catch(() => {
        showToast('⚠️ Salin manual: <code>' + escapeHtml(addr) + '</code>', 'error', 7000);
      });
    }

    function showToast(message, type, duration) {
      type = type || 'info';
      duration = duration || 4000;
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      toast.className = 'toast ' + type;
      toast.innerHTML = '<div class="toast-text">' + message + '</div>' +
        '<button class="toast-close" aria-label="Tutup">✕</button>';
      container.appendChild(toast);
      toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
      if (duration > 0) setTimeout(() => removeToast(toast), duration);
    }
    function removeToast(toast) {
      if (!toast.parentNode) return;
      toast.classList.add('hide');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }

    async function loadAllEmails() {
      if (isFetching) return;
      isFetching = true;
      const bar = document.getElementById('loadingBar');
      bar.classList.add('active');
      try {
        const res = await fetch('/api/all-emails?limit=100', {
          cache: 'default',
          credentials: 'omit'
        });
        const data = await res.json();
        const newIds = JSON.stringify(data.map(e => e.id));
        if (newIds !== lastIds) {
          lastIds = newIds;
          allEmails = data;
          applyFilter();
        }
      } catch (err) {
        console.error(err);
      } finally {
        isFetching = false;
        setTimeout(() => bar.classList.remove('active'), 300);
      }
    }

    function setRange(range) {
      filterState.range = range;
      document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.range === range);
      });
      applyFilter();
    }
    function applyFilter() {
      filterState.query = (document.getElementById('searchInput').value || '').trim().toLowerCase();
      renderEmails(filterEmails(allEmails));
    }
    function filterEmails(emails) {
      const now = Date.now();
      const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
      const startTodayTs = startOfToday.getTime();
      return emails.filter(email => {
        if (filterState.query) {
          const q = filterState.query;
          const match =
            (email.subject || '').toLowerCase().includes(q) ||
            (email.from || '').toLowerCase().includes(q) ||
            (email.to || '').toLowerCase().includes(q);
          if (!match) return false;
        }
        if (filterState.range !== 'all') {
          const t = new Date(email.date).getTime();
          if (filterState.range === 'today' && t < startTodayTs) return false;
          if (filterState.range === '7days' && t < now - 7 * 24 * 60 * 60 * 1000) return false;
          if (filterState.range === '30days' && t < now - 30 * 24 * 60 * 60 * 1000) return false;
        }
        return true;
      });
    }

    function sanitizeHtml(html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const forbiddenTags = ['script','iframe','object','embed','form','img','picture','source','video','audio','track','link','meta','base','style'];
      forbiddenTags.forEach(tag => {
        doc.querySelectorAll(tag).forEach(el => el.remove());
      });
      doc.querySelectorAll('*').forEach(el => {
        Array.from(el.attributes).forEach(attr => {
          const name = attr.name.toLowerCase();
          if (name.startsWith('on')) el.removeAttribute(attr.name);
          if (['src','srcset','href','background','action','formaction'].includes(name)) {
            if (name === 'href' && el.tagName.toLowerCase() === 'a') {
              const linkText = el.textContent || '';
              const url = attr.value || '';
              const replacement = document.createTextNode(linkText + (url ? ' (' + url + ')' : ''));
              el.parentNode.replaceChild(replacement, el);
            } else {
              el.removeAttribute(attr.name);
            }
          }
        });
      });
      return doc.body.innerHTML;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text == null ? '' : text;
      return div.innerHTML;
    }

    function renderEmails(emails) {
      const listEl = document.getElementById('emailList');
      if (!Array.isArray(emails) || emails.length === 0) {
        const empty = allEmails.length === 0
          ? 'Belum ada email masuk. Kirim email ke alamat apa pun di domain ' + DOMAIN + '.'
          : 'Tidak ada email yang cocok dengan filter Anda.';
        listEl.innerHTML = '<div class="empty-state">' + empty + '</div>';
        return;
      }
      let html = '';
      emails.forEach(email => {
        const isOpen = (openEmailId === email.id) ? ' open' : '';
        let contentHtml = '';
        if (email.html) {
          contentHtml = '<div class="email-html">' + sanitizeHtml(email.html) + '</div>';
        } else if (email.text) {
          contentHtml = '<pre>' + escapeHtml(email.text) + '</pre>';
        } else if (email.raw) {
          contentHtml = '<pre>' + escapeHtml(email.raw) + '</pre>';
        } else {
          contentHtml = '<p style="color:#999;">Tidak ada konten yang dapat ditampilkan.</p>';
        }
        const dateStr = formatDate(email.date);
        html += \`
          <div class="email-card\${isOpen}" data-id="\${email.id}" onclick="toggleEmail(event, this)">
            <div class="email-header">
              <div class="email-subject">\${escapeHtml(email.subject)}</div>
              <div class="badge">\${escapeHtml(email.to)}</div>
            </div>
            <div class="email-meta">
              <span><strong>Dari:</strong> \${escapeHtml(email.from)}</span>
              <span><strong>Waktu:</strong> \${escapeHtml(dateStr)}</span>
            </div>
            <div class="email-content">\${contentHtml}</div>
          </div>
        \`;
      });
      listEl.innerHTML = html;
    }

    function formatDate(dateStr) {
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const opts = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
        return d.toLocaleString('id-ID', opts);
      } catch (e) {
        return dateStr;
      }
    }

    function toggleEmail(event, card) {
      if (event.target.closest('.email-content')) return;
      const id = card.dataset.id;
      if (card.classList.contains('open')) {
        card.classList.remove('open');
        if (openEmailId === id) openEmailId = null;
      } else {
        card.classList.add('open');
        openEmailId = id;
      }
    }

    window.addEventListener('DOMContentLoaded', () => {
      initAddress();
      loadAllEmails();
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) loadAllEmails();
      });
      setInterval(loadAllEmails, 15000);
    });
  </script>
</body>
</html>`;
}
