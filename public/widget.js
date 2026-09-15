(function () {
  'use strict';

  var scriptTag = document.currentScript;
  var automationId = scriptTag && scriptTag.getAttribute('data-automation');
  if (!automationId) {
    console.warn('[Morfo Flow] ویجت بدون data-automation نصب شده و کار نمی‌کند.');
    return;
  }

  // خودش تشخیص می‌ده API رو از کجا صدا بزنه (همون دامنه‌ای که این اسکریپت ازش لود شده)
  var API_ORIGIN = new URL(scriptTag.src).origin;

  var host = document.createElement('div');
  host.style.all = 'initial';
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: 'open' });

  root.innerHTML = [
    '<style>',
    '  :host{ all: initial; }',
    '  .mf-bubble{',
    '    position:fixed; bottom:20px; left:20px; width:58px; height:58px; border-radius:50%;',
    '    background:#22B8A0; box-shadow:0 8px 24px rgba(0,0,0,.25); cursor:pointer; z-index:2147483000;',
    '    display:flex; align-items:center; justify-content:center; border:none; transition:transform .2s;',
    '  }',
    '  .mf-bubble:hover{ transform:scale(1.06); }',
    '  .mf-bubble svg{ width:26px; height:26px; }',
    '  .mf-panel{',
    '    position:fixed; bottom:90px; left:20px; width:320px; max-width:calc(100vw - 40px); height:440px;',
    '    max-height:calc(100vh - 120px); background:#12161D; border:1px solid #212630; border-radius:16px;',
    '    box-shadow:0 20px 50px rgba(0,0,0,.4); z-index:2147483000; display:none; flex-direction:column; overflow:hidden;',
    '    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,sans-serif; direction:rtl;',
    '  }',
    '  .mf-panel.open{ display:flex; }',
    '  .mf-head{ background:#0D1015; padding:14px 16px; color:#EDEFF3; font-size:14px; font-weight:700; border-bottom:1px solid #212630; }',
    '  .mf-msgs{ flex:1; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:10px; }',
    '  .mf-msg{ max-width:80%; padding:9px 13px; border-radius:12px; font-size:13.5px; line-height:1.6; }',
    '  .mf-msg.bot{ background:#1A2028; color:#EDEFF3; align-self:flex-start; border-bottom-left-radius:3px; }',
    '  .mf-msg.user{ background:#22B8A0; color:#06231D; align-self:flex-end; border-bottom-right-radius:3px; }',
    '  .mf-input-row{ display:flex; gap:8px; padding:12px; border-top:1px solid #212630; }',
    '  .mf-input{ flex:1; background:#0D1015; border:1px solid #212630; border-radius:9px; padding:10px 12px; color:#EDEFF3; font-size:13.5px; font-family:inherit; }',
    '  .mf-input:focus{ outline:none; border-color:#22B8A0; }',
    '  .mf-send{ background:#22B8A0; border:none; border-radius:9px; padding:0 14px; color:#06231D; font-weight:700; cursor:pointer; font-size:13px; }',
    '  .mf-foot{ text-align:center; padding:6px; font-size:10.5px; color:#5C6473; background:#0D1015; }',
    '  .mf-foot a{ color:#8B93A3; text-decoration:none; }',
    '</style>',
    '<button class="mf-bubble" aria-label="باز کردن چت">',
    '  <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>',
    '</button>',
    '<div class="mf-panel">',
    '  <div class="mf-head">چطور می‌تونیم کمکتون کنیم؟</div>',
    '  <div class="mf-msgs"></div>',
    '  <div class="mf-input-row">',
    '    <input class="mf-input" type="text" placeholder="پیامتون رو بنویسید...">',
    '    <button class="mf-send">ارسال</button>',
    '  </div>',
    '  <div class="mf-foot">ساخته‌شده با <a href="https://themorfo.ir" target="_blank" rel="noopener">Morfo Flow</a></div>',
    '</div>',
  ].join('');

  var bubble = root.querySelector('.mf-bubble');
  var panel = root.querySelector('.mf-panel');
  var msgsEl = root.querySelector('.mf-msgs');
  var input = root.querySelector('.mf-input');
  var sendBtn = root.querySelector('.mf-send');
  var greeted = false;

  function addMessage(text, who) {
    var el = document.createElement('div');
    el.className = 'mf-msg ' + who;
    el.textContent = text;
    msgsEl.appendChild(el);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  bubble.addEventListener('click', function () {
    panel.classList.toggle('open');
    if (panel.classList.contains('open') && !greeted) {
      greeted = true;
      addMessage('سلام! چطور می‌تونم کمکتون کنم؟', 'bot');
    }
  });

  async function sendMessage() {
    var text = input.value.trim();
    if (!text) return;
    addMessage(text, 'user');
    input.value = '';
    try {
      var res = await fetch(API_ORIGIN + '/api/widget/' + encodeURIComponent(automationId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      var data = await res.json();
      addMessage(data.reply || 'متوجه نشدم.', 'bot');
    } catch (err) {
      addMessage('اتصال برقرار نشد. دوباره تلاش کنید.', 'bot');
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendMessage();
  });
})();
