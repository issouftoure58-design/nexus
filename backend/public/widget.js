/**
 * NEXUS Chat Widget — Embeddable chat for client websites
 * Copyright (c) 2026 NEXUS AI. All rights reserved.
 *
 * Usage:
 * <script src="https://nexus-backend-dev.onrender.com/widget.js" data-tenant-id="UUID"></script>
 * Options: data-color="#0891b2" (accent color)
 */
(function() {
  'use strict';

  // ====== CONFIG ======
  var script = document.currentScript;
  if (!script) return;

  var tenantId = script.getAttribute('data-tenant-id');
  if (!tenantId) {
    console.error('[NEXUS Widget] data-tenant-id is required');
    return;
  }

  var color = script.getAttribute('data-color') || '#0891b2';
  var apiBase = script.src.replace(/\/widget\.js.*$/, '');
  var conversationId = null;
  var isOpen = false;
  var isLoading = false;

  // ====== STYLES ======
  var css = '' +
    '#nexus-widget-bubble{' +
      'position:fixed;bottom:24px;right:24px;width:60px;height:60px;' +
      'border-radius:50%;background:' + color + ';cursor:pointer;' +
      'box-shadow:0 4px 20px rgba(0,0,0,.25);display:flex;align-items:center;' +
      'justify-content:center;z-index:999999;transition:transform .2s,box-shadow .2s;' +
      'border:none;outline:none;' +
    '}' +
    '#nexus-widget-bubble:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(0,0,0,.3);}' +
    '#nexus-widget-bubble svg{width:28px;height:28px;fill:#fff;}' +
    '#nexus-widget-panel{' +
      'position:fixed;bottom:96px;right:24px;width:380px;height:520px;' +
      'background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.2);' +
      'z-index:999999;display:none;flex-direction:column;overflow:hidden;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
    '}' +
    '#nexus-widget-panel.nxw-open{display:flex;}' +
    '#nexus-widget-header{' +
      'background:' + color + ';color:#fff;padding:16px 18px;display:flex;' +
      'align-items:center;justify-content:space-between;flex-shrink:0;' +
    '}' +
    '#nexus-widget-header h3{margin:0;font-size:15px;font-weight:700;}' +
    '#nexus-widget-header p{margin:2px 0 0;font-size:11px;opacity:.85;}' +
    '#nexus-widget-close{' +
      'background:none;border:none;color:#fff;font-size:22px;cursor:pointer;' +
      'padding:0 4px;line-height:1;opacity:.8;' +
    '}' +
    '#nexus-widget-close:hover{opacity:1;}' +
    '#nexus-widget-messages{' +
      'flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;' +
      'background:#f9fafb;' +
    '}' +
    '.nxw-msg{' +
      'max-width:82%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.5;' +
      'word-wrap:break-word;white-space:pre-wrap;' +
    '}' +
    '.nxw-msg-bot{' +
      'background:#fff;color:#111827;border:1px solid #e5e7eb;align-self:flex-start;' +
      'border-bottom-left-radius:4px;' +
    '}' +
    '.nxw-msg-user{' +
      'background:' + color + ';color:#fff;align-self:flex-end;' +
      'border-bottom-right-radius:4px;' +
    '}' +
    '.nxw-typing{' +
      'align-self:flex-start;padding:10px 18px;background:#fff;border:1px solid #e5e7eb;' +
      'border-radius:14px;border-bottom-left-radius:4px;display:none;' +
    '}' +
    '.nxw-typing span{' +
      'display:inline-block;width:7px;height:7px;border-radius:50%;background:#9ca3af;' +
      'margin:0 2px;animation:nxw-bounce .6s infinite alternate;' +
    '}' +
    '.nxw-typing span:nth-child(2){animation-delay:.15s;}' +
    '.nxw-typing span:nth-child(3){animation-delay:.3s;}' +
    '@keyframes nxw-bounce{to{transform:translateY(-5px);opacity:.4;}}' +
    '#nexus-widget-input-wrap{' +
      'display:flex;border-top:1px solid #e5e7eb;padding:10px 12px;background:#fff;' +
      'align-items:center;gap:8px;flex-shrink:0;' +
    '}' +
    '#nexus-widget-input{' +
      'flex:1;border:1px solid #e5e7eb;border-radius:10px;padding:10px 14px;' +
      'font-size:13px;outline:none;font-family:inherit;resize:none;max-height:80px;' +
      'line-height:1.4;' +
    '}' +
    '#nexus-widget-input:focus{border-color:' + color + ';}' +
    '#nexus-widget-send{' +
      'width:36px;height:36px;border-radius:50%;background:' + color + ';' +
      'border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;' +
      'flex-shrink:0;transition:opacity .2s;' +
    '}' +
    '#nexus-widget-send:disabled{opacity:.4;cursor:not-allowed;}' +
    '#nexus-widget-send svg{width:16px;height:16px;fill:#fff;}' +
    '#nexus-widget-powered{' +
      'text-align:center;padding:6px;font-size:10px;color:#9ca3af;background:#fff;' +
      'border-top:1px solid #f3f4f6;flex-shrink:0;' +
    '}' +
    '#nexus-widget-powered a{color:' + color + ';text-decoration:none;font-weight:600;}' +
    '@media(max-width:480px){' +
      '#nexus-widget-panel{' +
        'width:100%;height:100%;bottom:0;right:0;border-radius:0;' +
      '}' +
      '#nexus-widget-bubble{bottom:16px;right:16px;width:54px;height:54px;}' +
    '}';

  // ====== INJECT STYLES ======
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ====== CREATE DOM ======
  // Bubble
  var bubble = document.createElement('button');
  bubble.id = 'nexus-widget-bubble';
  bubble.setAttribute('aria-label', 'Ouvrir le chat');
  bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg>';

  // Panel
  var panel = document.createElement('div');
  panel.id = 'nexus-widget-panel';
  panel.innerHTML = '' +
    '<div id="nexus-widget-header">' +
      '<div>' +
        '<h3>Chat avec nous</h3>' +
        '<p>Reponse instantanee par IA</p>' +
      '</div>' +
      '<button id="nexus-widget-close" aria-label="Fermer">&times;</button>' +
    '</div>' +
    '<div id="nexus-widget-messages">' +
      '<div class="nxw-typing" id="nexus-widget-typing"><span></span><span></span><span></span></div>' +
    '</div>' +
    '<div id="nexus-widget-input-wrap">' +
      '<textarea id="nexus-widget-input" placeholder="Tapez votre message..." rows="1"></textarea>' +
      '<button id="nexus-widget-send" aria-label="Envoyer">' +
        '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>' +
      '</button>' +
    '</div>' +
    '<div id="nexus-widget-powered">Propulse par <a href="https://nexus-ai-saas.com" target="_blank" rel="noopener">NEXUS AI</a></div>';

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  // ====== ELEMENTS ======
  var messagesEl = document.getElementById('nexus-widget-messages');
  var inputEl = document.getElementById('nexus-widget-input');
  var sendBtn = document.getElementById('nexus-widget-send');
  var closeBtn = document.getElementById('nexus-widget-close');
  var typingEl = document.getElementById('nexus-widget-typing');

  // ====== HELPERS ======
  function addMessage(text, isUser) {
    var div = document.createElement('div');
    div.className = 'nxw-msg ' + (isUser ? 'nxw-msg-user' : 'nxw-msg-bot');
    div.textContent = text;
    messagesEl.insertBefore(div, typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    typingEl.style.display = 'block';
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    typingEl.style.display = 'none';
  }

  function autoResize() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 80) + 'px';
  }

  // ====== TOGGLE ======
  function toggle() {
    isOpen = !isOpen;
    if (isOpen) {
      panel.classList.add('nxw-open');
      inputEl.focus();
      // Greeting on first open
      if (!conversationId) {
        sendMessage('Bonjour', true);
      }
    } else {
      panel.classList.remove('nxw-open');
    }
  }

  // ====== SEND ======
  function sendMessage(text, isFirst) {
    if (isLoading || !text.trim()) return;

    if (!isFirst) {
      addMessage(text, true);
    }

    isLoading = true;
    sendBtn.disabled = true;
    inputEl.value = '';
    inputEl.style.height = 'auto';
    showTyping();

    var body = {
      message: text,
      tenant_id: tenantId,
      isFirstMessage: !!isFirst
    };
    if (conversationId) {
      body.sessionId = conversationId;
    }

    fetch(apiBase + '/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId
      },
      body: JSON.stringify(body)
    })
    .then(function(res) {
      if (!res.ok) throw new Error('Erreur ' + res.status);
      return res.json();
    })
    .then(function(data) {
      hideTyping();
      conversationId = data.sessionId || conversationId;
      addMessage(data.response || 'Desole, je n\'ai pas compris.', false);
    })
    .catch(function(err) {
      hideTyping();
      console.error('[NEXUS Widget]', err);
      addMessage('Desole, une erreur est survenue. Reessayez.', false);
    })
    .finally(function() {
      isLoading = false;
      sendBtn.disabled = false;
    });
  }

  // ====== EVENTS ======
  bubble.addEventListener('click', toggle);
  closeBtn.addEventListener('click', toggle);

  sendBtn.addEventListener('click', function() {
    sendMessage(inputEl.value.trim(), false);
  });

  inputEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputEl.value.trim(), false);
    }
  });

  inputEl.addEventListener('input', autoResize);
})();
