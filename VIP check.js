// ==UserScript==
// @name         Simple VIP Cheker
// @match        https://app.chatwoot.com/*
// @match        https://admin.4rabet.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      api-admin.4rabet.com
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  const API = 'https://api-admin.4rabet.com/api/v2/api/v1';
  let TOKEN = GM_getValue('bearer_token', null);
  let lastUUID = null;
  let vipState = null;

  // 🔍 Функция получения информации о токене
  function getTokenInfo(token) {
    if (!token || !token.startsWith('Bearer ')) {
      return { valid: false, expiresIn: null, expiresDate: null };
    }
    
    try {
      const tokenParts = token.split(' ')[1];
      const parts = tokenParts.split('.');
      if (parts.length !== 3) return { valid: false, expiresIn: null, expiresDate: null };
      
      const payload = JSON.parse(atob(parts[1]));
      const exp = payload.exp * 1000;
      const now = Date.now();
      const expiresIn = exp - now;
      const isValid = expiresIn > 0;
      
      return {
        valid: isValid,
        expiresIn: expiresIn,
        expiresDate: new Date(exp),
        hoursLeft: expiresIn / (1000 * 60 * 60)
      };
    } catch(e) {
      return { valid: false, expiresIn: null, expiresDate: null };
    }
  }

  // 🔑 Функция для обновления токена
  function updateToken(newToken) {
    if (!newToken || !newToken.startsWith('Bearer ')) return;
    
    if (TOKEN !== newToken) {
      TOKEN = newToken;
      GM_setValue('bearer_token', TOKEN);
      console.log(`[VIP] 🔄 Токен обновлен!`);
      showNotification('🔄 Bearer токен обновлен!');
      updateTokenIndicator(); // Обновляем индикатор
    }
  }

  // 📊 Индикатор токена (только для admin.4rabet.com)
  let tokenIndicator = null;
  
  function createTokenIndicator() {
    if (tokenIndicator) return;
    
    tokenIndicator = document.createElement('div');
    tokenIndicator.id = 'vip-token-indicator';
    tokenIndicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: rgba(0,0,0,0.85);
      color: #fff;
      padding: 8px 12px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 100000;
      backdrop-filter: blur(5px);
      border-left: 3px solid #4CAF50;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      pointer-events: none;
      transition: all 0.3s;
    `;
    document.body.appendChild(tokenIndicator);
  }
  
  function updateTokenIndicator() {
    if (!tokenIndicator) return;
    
    const info = getTokenInfo(TOKEN);
    
    if (TOKEN && info.valid) {
      const hoursLeft = info.hoursLeft;
      let timeText = '';
      let borderColor = '';
      
      if (hoursLeft > 24) {
        const days = Math.floor(hoursLeft / 24);
        const remainingHours = Math.floor(hoursLeft % 24);
        timeText = `${days}д ${remainingHours}ч`;
        borderColor = '#4CAF50';
      } else if (hoursLeft > 1) {
        timeText = `${Math.floor(hoursLeft)}ч ${Math.floor((hoursLeft % 1) * 60)}м`;
        borderColor = '#FFC107';
      } else if (hoursLeft > 0) {
        const minutes = Math.floor(hoursLeft * 60);
        timeText = `${minutes}м`;
        borderColor = '#FF9800';
      } else {
        timeText = 'истек';
        borderColor = '#f44336';
      }
      
      tokenIndicator.innerHTML = `🔑 Токен: ✅ ${timeText}`;
      tokenIndicator.style.borderLeftColor = borderColor;
      tokenIndicator.style.opacity = '1';
    } else if (TOKEN && !info.valid) {
      tokenIndicator.innerHTML = `🔑 Токен: ❌ истек`;
      tokenIndicator.style.borderLeftColor = '#f44336';
      tokenIndicator.style.opacity = '1';
    } else {
      tokenIndicator.innerHTML = `🔑 Токен: ⏳ ожидание...`;
      tokenIndicator.style.borderLeftColor = '#FF9800';
      tokenIndicator.style.opacity = '1';
    }
  }
  
  // Обновляем индикатор каждую минуту
  function startTokenIndicatorUpdater() {
    setInterval(() => {
      if (tokenIndicator && TOKEN) {
        updateTokenIndicator();
      }
    }, 60000);
  }

  // 🔑 Перехват fetch запросов
  function interceptFetch() {
    const originalFetch = window.fetch;
    
    window.fetch = function(...args) {
      const options = args[1] || {};
      
      let authHeader = null;
      if (options.headers) {
        if (options.headers instanceof Headers) {
          authHeader = options.headers.get('Authorization');
        } else if (typeof options.headers === 'object') {
          authHeader = options.headers['Authorization'] || options.headers['authorization'];
        }
      }
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        updateToken(authHeader);
      }
      
      return originalFetch.apply(this, args);
    };
  }

  // 🔑 Перехват XMLHttpRequest
  function interceptXHR() {
    const XHR = XMLHttpRequest.prototype;
    const originalOpen = XHR.open;
    const originalSetRequestHeader = XHR.setRequestHeader;
    
    XHR.open = function(method, url) {
      this._url = url;
      this._requestHeaders = {};
      return originalOpen.apply(this, arguments);
    };
    
    XHR.setRequestHeader = function(header, value) {
      this._requestHeaders[header.toLowerCase()] = value;
      
      if (header.toLowerCase() === 'authorization' && value && value.startsWith('Bearer ')) {
        updateToken(value);
      }
      
      return originalSetRequestHeader.apply(this, arguments);
    };
  }

  // 💬 Показать уведомление
  function showNotification(message, isError = false) {
    const notif = document.createElement('div');
    notif.textContent = message;
    notif.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${isError ? '#f44336' : '#4CAF50'};
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      z-index: 100000;
      font-size: 14px;
      font-family: monospace;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      animation: slideIn 0.3s ease-out;
    `;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
  }

  // 🚀 Запускаем на admin.4rabet.com
  if (window.location.hostname === 'admin.4rabet.com') {
    console.log('[VIP] 🚀 Запущен на admin.4rabet.com');
    
    if (TOKEN) {
      console.log('[VIP] 📌 Сохраненный токен:', TOKEN.substring(0, 50) + '...');
      const info = getTokenInfo(TOKEN);
      if (info.valid) {
        console.log(`[VIP] Токен валиден, истекает через ${info.hoursLeft.toFixed(1)} часов`);
      } else {
        console.log('[VIP] Токен невалиден или истек');
      }
    }
    
    interceptFetch();
    interceptXHR();
    
    // Создаем индикатор после загрузки DOM
    setTimeout(() => {
      createTokenIndicator();
      updateTokenIndicator();
      startTokenIndicatorUpdater();
    }, 1000);
  }
  
  // 🟢 На chatwoot.com
  if (window.location.hostname === 'app.chatwoot.com') {
    console.log('[VIP] 🚀 Запущен на chatwoot.com');
    
    if (TOKEN) {
      console.log('[VIP] ✅ Токен загружен');
      const info = getTokenInfo(TOKEN);
      if (info.valid) {
        console.log(`[VIP] Токен валиден, истекает через ${info.hoursLeft.toFixed(1)} часов`);
      }
    } else {
      console.log('[VIP] ❌ Нет токена');
      showNotification('⚠️ Откройте admin.4rabet.com для получения токена', true);
    }
    
    // 🔍 Поиск UUID
    function findUUID() {
      const match = document.body.innerText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      return match ? match[0] : null;
    }
    
    // 🌐 API запрос
    function fetchVip(uuid) {
      if (!TOKEN) {
        return Promise.resolve(false);
      }
      
      return new Promise((resolve) => {
        GM_xmlhttpRequest({
          method: 'GET',
          url: `${API}/players?uuid=${uuid}`,
          headers: {
            'Authorization': TOKEN,
            'Accept': 'application/json'
          },
          onload: (r) => {
            if (r.status === 401) {
              console.error('[VIP] ❌ Токен невалиден (401 ошибка)');
              showNotification('❌ Токен протух! Обновите admin.4rabet.com', true);
              resolve(false);
              return;
            }
            
            try {
              const json = JSON.parse(r.responseText);
              const isVip = json?.data?.[0]?.meta?.is_vip === true;
              console.log(`[VIP] VIP статус: ${isVip ? '✅ VIP' : '❌ Не VIP'}`);
              if (isVip) showNotification('👑 VIP клиент!');
              resolve(isVip);
            } catch(e) {
              resolve(false);
            }
          },
          onerror: () => resolve(false)
        });
      });
    }
    
    // 🟡 Функция для очистки всех оверлеев
    function clearAllOverlays() {
      const overlays = document.querySelectorAll('.vip-overlay');
      overlays.forEach(overlay => {
        if (overlay && overlay.parentNode) {
          overlay.remove();
        }
      });
    }
    
    // 🟡 Отрисовка или обновление оверлея
    function applyOverlay(isVip) {
      const wrap = document.querySelector('.conversation-details-wrap');
      
      // Если нет активного чата, очищаем все оверлеи
      if (!wrap) {
        clearAllOverlays();
        return;
      }
      
      wrap.style.position = 'relative';
      
      let overlay = wrap.querySelector('.vip-overlay');
      
      // Если VIP статус false и оверлей существует - удаляем его
      if (!isVip) {
        if (overlay) {
          overlay.remove();
        }
        return;
      }
      
      // Если VIP true, создаем или обновляем оверлей
      if (isVip) {
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'vip-overlay';
          overlay.style.cssText = 'position:absolute;top:8px;left:8px;right:8px;height:72px;pointer-events:none;z-index:999;border-radius:10px;';
          wrap.appendChild(overlay);
        }
        
        overlay.style.border = '4px solid gold';
        overlay.style.boxShadow = '0 0 25px rgba(255,215,0,0.8)';
        overlay.style.background = 'radial-gradient(circle, rgba(255,215,0,0.2) 0%, rgba(255,215,0,0.05) 100%)';
        
        if (!overlay.querySelector('.vip-icon')) {
          const icon = document.createElement('div');
          icon.className = 'vip-icon';
          icon.textContent = '👑 VIP';
          icon.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:24px;font-weight:bold;color:gold;text-shadow:0 0 10px rgba(0,0,0,0.5);';
          overlay.appendChild(icon);
        }
      }
    }
    
    // 🔁 Цикл проверки
    async function tick() {
      const uuid = findUUID();
      
      // Если нет UUID, очищаем оверлей и выходим
      if (!uuid) {
        if (lastUUID !== null) {
          console.log('[VIP] Чат закрыт, очищаю оверлей');
          lastUUID = null;
          vipState = null;
          clearAllOverlays();
        }
        return;
      }
      
      // Новый UUID
      if (uuid !== lastUUID) {
        console.log('[VIP] Новый UUID:', uuid);
        lastUUID = uuid;
        vipState = null;
        // При смене чата сразу очищаем старый оверлей
        clearAllOverlays();
      }
      
      // Проверяем VIP статус
      if (vipState === null && TOKEN) {
        vipState = await fetchVip(uuid);
      }
      
      // Применяем оверлей (если VIP - покажет, если нет - удалит)
      if (vipState !== null) {
        applyOverlay(vipState);
      }
    }
    
    // Следим за изменениями DOM (когда чат закрывается/открывается)
    const observer = new MutationObserver(() => {
      // Проверяем, есть ли активный чат
      const wrap = document.querySelector('.conversation-details-wrap');
      if (!wrap && lastUUID !== null) {
        console.log('[VIP] Чат закрыт (MutationObserver), очищаю');
        lastUUID = null;
        vipState = null;
        clearAllOverlays();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setInterval(tick, 2000);
  }
})();