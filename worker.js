import PostalMime from 'postal-mime';

const DEFAULT_DOMAIN = 'ryy.my.id';

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

      const key = `msg:${domain}:${localPart}:${emailObject.id}`;
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

    if (path === '/' && request.method === 'GET') {
      return new Response(getHtml(), {
        headers: { 'Content-Type': 'text/html', ...corsHeaders },
      });
    }

    if (path === '/api/all-emails' && request.method === 'GET') {
      const prefix = 'msg:';
      const list = await env.EMAIL_STORE.list({ prefix });
      const emails = [];

      for (const key of list.keys) {
        const value = await env.EMAIL_STORE.get(key.name);
        if (value) {
          try {
            emails.push(JSON.parse(value));
          } catch (e) {}
        }
      }

      emails.sort((a, b) => new Date(b.date) - new Date(a.date));
      return jsonResponse(emails.slice(0, 200), 200, corsHeaders);
    }

    if (path === '/api/generate' && request.method === 'POST') {
      const localPart = generateLocalPart();
      const domain = env.EMAIL_DOMAIN || DEFAULT_DOMAIN;
      const fullAddress = `${localPart}@${domain}`;
      return jsonResponse({ address: fullAddress, localPart, domain }, 200, corsHeaders);
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  },
};

function generateLocalPart() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  for (let i = 0; i < 10; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

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
  <title>Temp Mail – Catch All</title>
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
    main {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
    }
    header { text-align: center; margin-bottom: 30px; padding: 20px 0; }
    header h1 { font-size: 2.5rem; font-weight: 700; letter-spacing: -0.5px; }
    header p { color: var(--text-secondary); }
    .toolbar {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 20px; gap: 10px; flex-wrap: wrap;
    }
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 10px 18px; background: var(--accent); color: white;
      border: none; border-radius: 8px; font-size: 0.9rem;
      font-weight: 500; cursor: pointer; transition: background 0.2s;
    }
    .btn:hover { background: var(--accent-hover); }
    .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--text-secondary); }
    .btn-outline:hover { background: var(--border); }
    .email-list { display: flex; flex-direction: column; gap: 12px; }
    .email-card {
      background: var(--card-bg); border: 1px solid var(--border);
      border-radius: var(--radius); box-shadow: var(--shadow);
      padding: 16px 18px; transition: all 0.2s ease;
      cursor: pointer;
    }
    .email-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: #d1d5db; }
    .email-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
    .email-subject { font-weight: 600; font-size: 1.05rem; word-break: break-word; }
    .email-meta { display: flex; flex-direction: column; gap: 2px; font-size: 0.85rem; color: var(--text-secondary); margin-top: 6px; }
    .email-meta span { display: block; }
    .email-content {
      display: none;
      margin-top: 12px;
      border-top: 1px solid var(--border);
      padding-top: 12px;
      max-height: 400px;
      overflow-y: auto;
      cursor: auto;
    }
    .email-card.open .email-content { display: block; }
    .email-content pre {
      white-space: pre-wrap;
      font-family: monospace;
      font-size: 0.85rem;
      background: #f9fafb;
      padding: 10px;
      border-radius: 8px;
      user-select: text;
    }
    .email-html {
      max-height: 400px;
      overflow-y: auto;
      background: #f9fafb;
      padding: 10px;
      border-radius: 8px;
      user-select: text;
      word-break: break-word;
    }
    .email-html * { max-width: 100%; }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      background: var(--card-bg);
      border: 1px dashed var(--border);
      border-radius: var(--radius);
      color: var(--text-secondary);
    }
    .badge {
      background: #eef2ff;
      color: var(--accent);
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    /* ====== Toast mengambang ====== */
    .toast-container {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      pointer-events: none;
      width: 100%;
      max-width: 480px;
      padding: 0 16px;
    }
    .toast {
      pointer-events: auto;
      background: #1f2937;
      color: #ffffff;
      padding: 12px 18px;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      animation: slideUp 0.3s ease-out;
      word-break: break-all;
    }
    .toast.success { background: #059669; }
    .toast.error { background: #dc2626; }
    .toast .toast-text { flex: 1; }
    .toast code {
      background: rgba(255,255,255,0.15);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.9rem;
    }
    .toast .toast-close {
      background: transparent;
      border: none;
      color: white;
      cursor: pointer;
      font-size: 1.1rem;
      line-height: 1;
      padding: 0 4px;
      opacity: 0.7;
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
    .toast.hide {
      animation: fadeOut 0.3s ease-in forwards;
    }

    @media (max-width: 600px) {
      header h1 { font-size: 2rem; }
      .toolbar { flex-direction: column; align-items: stretch; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>📬 Temp Mail</h1>
      <p>Catch‑all inbox – semua email ke domain <strong>${DEFAULT_DOMAIN}</strong> muncul di sini</p>
    </header>

    <div class="toolbar">
      <div id="status" class="badge">Menunggu...</div>
      <div>
        <button class="btn" onclick="loadAllEmails()">🔄 Refresh</button>
        <button class="btn btn-outline" onclick="generateAndCopy()">⚡ Buat Alamat Acak</button>
      </div>
    </div>

    <div id="emailList" class="email-list">
      <div class="empty-state">Memuat email...</div>
    </div>
  </main>

  <!-- Kontainer toast mengambang -->
  <div id="toastContainer" class="toast-container"></div>

  <script>
    let openEmailId = null;

    // ============ Toast helper ============
    function showToast(message, type = 'info', duration = 4000) {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      toast.className = 'toast ' + type;
      toast.innerHTML = '<div class="toast-text">' + message + '</div>' +
        '<button class="toast-close" aria-label="Tutup">✕</button>';
      container.appendChild(toast);

      const closeBtn = toast.querySelector('.toast-close');
      closeBtn.addEventListener('click', () => removeToast(toast));

      if (duration > 0) {
        setTimeout(() => removeToast(toast), duration);
      }
    }

    function removeToast(toast) {
      if (!toast.parentNode) return;
      toast.classList.add('hide');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }

    // ============ Fetch & render ============
    async function loadAllEmails() {
      const listEl = document.getElementById('emailList');
      const statusEl = document.getElementById('status');
      statusEl.textContent = 'Memuat...';
      try {
        const res = await fetch('/api/all-emails', {
          cache: 'no-store',
          credentials: 'omit'
        });
        const emails = await res.json();
        renderEmails(emails);
        statusEl.textContent = emails.length + ' email';
      } catch (err) {
        listEl.innerHTML = '<div class="empty-state">Gagal memuat email. Coba lagi.</div>';
        statusEl.textContent = 'Error';
        console.error(err);
      }
    }

    function sanitizeHtml(html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const forbiddenTags = [
        'script', 'iframe', 'object', 'embed', 'form',
        'img', 'picture', 'source', 'video', 'audio',
        'track', 'link', 'meta', 'base', 'style'
      ];
      forbiddenTags.forEach(tag => {
        doc.querySelectorAll(tag).forEach(el => el.remove());
      });

      doc.querySelectorAll('*').forEach(el => {
        Array.from(el.attributes).forEach(attr => {
          const name = attr.name.toLowerCase();
          if (name.startsWith('on')) {
            el.removeAttribute(attr.name);
          }
          if (['src', 'srcset', 'href', 'background', 'action', 'formaction'].includes(name)) {
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

    function renderEmails(emails) {
      const listEl = document.getElementById('emailList');
      if (!Array.isArray(emails) || emails.length === 0) {
        listEl.innerHTML = '<div class="empty-state">Belum ada email masuk. Kirim email ke alamat apa pun di domain ${DEFAULT_DOMAIN}.</div>';
        return;
      }
      let html = '';
      emails.forEach(email => {
        const isOpen = (openEmailId === email.id) ? ' open' : '';
        let contentHtml = '';
        if (email.html) {
          const cleaned = sanitizeHtml(email.html);
          contentHtml = '<div class="email-html">' + cleaned + '</div>';
        } else if (email.text) {
          contentHtml = '<pre>' + escapeHtml(email.text) + '</pre>';
        } else if (email.raw) {
          contentHtml = '<pre>' + escapeHtml(email.raw) + '</pre>';
        } else {
          contentHtml = '<p style="color:#999;">Tidak ada konten yang dapat ditampilkan.</p>';
        }
        html += \`
          <div class="email-card\${isOpen}" data-id="\${email.id}" onclick="toggleEmail(event, this)">
            <div class="email-header">
              <div class="email-subject">\${escapeHtml(email.subject)}</div>
              <div class="badge">\${escapeHtml(email.to)}</div>
            </div>
            <div class="email-meta">
              <span><strong>Dari:</strong> \${escapeHtml(email.from)}</span>
              <span><strong>Waktu:</strong> \${escapeHtml(email.date)}</span>
            </div>
            <div class="email-content">\${contentHtml}</div>
          </div>
        \`;
      });
      listEl.innerHTML = html;
    }

    function toggleEmail(event, card) {
      if (event.target.closest('.email-content')) {
        return;
      }
      const id = card.dataset.id;
      if (card.classList.contains('open')) {
        card.classList.remove('open');
        if (openEmailId === id) openEmailId = null;
      } else {
        card.classList.add('open');
        openEmailId = id;
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    async function generateAndCopy() {
      try {
        const res = await fetch('/api/generate', { method: 'POST' });
        const data = await res.json();
        try {
          await navigator.clipboard.writeText(data.address);
          showToast('✅ Alamat disalin: <code>' + escapeHtml(data.address) + '</code>', 'success', 5000);
        } catch (clipErr) {
          // Jika clipboard tidak tersedia (misal iframe tanpa izin)
          showToast('📧 Alamat: <code>' + escapeHtml(data.address) + '</code>', 'info', 8000);
        }
      } catch (err) {
        showToast('❌ Gagal membuat alamat. Periksa konfigurasi domain.', 'error', 5000);
        console.error(err);
      }
    }

    window.addEventListener('DOMContentLoaded', () => {
      loadAllEmails();
      setInterval(loadAllEmails, 10000);
    });
  </script>
</body>
</html>`;
}
