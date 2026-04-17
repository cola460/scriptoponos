// ==UserScript==
// @name         Chatwoot Withdrawals
// @match        https://app.chatwoot.com/*
// @match        https://admin.4rabet.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      api-admin.4rabet.com
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const API_V1 = 'https://api-admin.4rabet.com/api/v2/api/v1';
  const API_V3 = 'https://api-admin.4rabet.com/api/v2/api/v3';

  // ===== ПЕРЕМЕННЫЕ =====
  let TOKEN = GM_getValue('withdrawals_bearer_token', null);
  let visible = false;
  let currentConversationId = null;
  let currentPlayerInfo = null;
  let panel = null;
  let allPayouts = [];
  let currentPage = 1;
  let totalPages = 1;

  // ===== СТИЛИ =====
  const FONT_STACK = 'Inter, -apple-system, system-ui, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Tahoma, Arial, sans-serif';
  const BASE_FONT_SIZE = 11;
  const BASE_HEIGHT = 550;
  const ITEMS_PER_PAGE = 13;
  const LIMIT = 35;

  // ===== ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ ТОКЕНА =====
  function updateToken(newToken) {
    if (!newToken || !newToken.startsWith('Bearer ')) return;
    if (TOKEN !== newToken) {
      TOKEN = newToken;
      GM_setValue('withdrawals_bearer_token', TOKEN);
      console.log('[Withdrawals] 🔄 Токен обновлен');

      if (visible && panel) {
        const statusDiv = document.getElementById('payouts-status');
        if (statusDiv) {
          statusDiv.style.display = 'block';
          statusDiv.innerHTML = '✅ Токен получен! Повторите поиск.';
          statusDiv.style.color = '#7dcf7d';
          setTimeout(() => {
            if (statusDiv && visible) {
              statusDiv.style.display = 'none';
            }
          }, 3000);
        }
      }
    }
  }

  // ===== ПЕРЕХВАТ FETCH ЗАПРОСОВ =====
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

  // ===== ПЕРЕХВАТ XHR ЗАПРОСОВ =====
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

  // ===== ЗАПУСКАЕМ ПЕРЕХВАТЧИКИ =====
  interceptFetch();
  interceptXHR();

  // ===== ИНДИКАТОР ТОКЕНА (только для admin.4rabet.com) =====
  let tokenIndicator = null;

  function createTokenIndicator() {
    if (tokenIndicator) return;

    tokenIndicator = document.createElement('div');
    tokenIndicator.id = 'withdrawals-token-indicator';
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

    if (TOKEN && TOKEN.startsWith('Bearer ')) {
      try {
        const tokenParts = TOKEN.split(' ')[1];
        const parts = tokenParts.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          const exp = payload.exp * 1000;
          const now = Date.now();
          const hoursLeft = (exp - now) / (1000 * 60 * 60);

          if (hoursLeft > 0) {
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
            } else {
              const minutes = Math.floor(hoursLeft * 60);
              timeText = `${minutes}м`;
              borderColor = '#FF9800';
            }

            tokenIndicator.innerHTML = `🔑 Токен: ✅ ${timeText}`;
            tokenIndicator.style.borderLeftColor = borderColor;
          } else {
            tokenIndicator.innerHTML = `🔑 Токен: ❌ истек`;
            tokenIndicator.style.borderLeftColor = '#f44336';
          }
        } else {
          tokenIndicator.innerHTML = `🔑 Токен: ✅ есть`;
          tokenIndicator.style.borderLeftColor = '#4CAF50';
        }
      } catch(e) {
        tokenIndicator.innerHTML = `🔑 Токен: ✅ есть`;
        tokenIndicator.style.borderLeftColor = '#4CAF50';
      }
    } else {
      tokenIndicator.innerHTML = `🔑 Токен: ⏳ ожидание...`;
      tokenIndicator.style.borderLeftColor = '#FF9800';
    }
  }

  // ===== НА ADMIN.4RABET.COM ПОКАЗЫВАЕМ ИНДИКАТОР =====
  if (window.location.hostname === 'admin.4rabet.com') {
    console.log('[Withdrawals] 🚀 Запущен на admin.4rabet.com');

    setTimeout(() => {
      createTokenIndicator();
      updateTokenIndicator();
      setInterval(updateTokenIndicator, 60000);
    }, 1000);
  }

  // ===== НА CHATWOOT.COM ЗАПУСКАЕМ ОСНОВНУЮ ЛОГИКУ =====
  if (window.location.hostname === 'app.chatwoot.com') {
    console.log('[Withdrawals] 🚀 Запущен на chatwoot.com');

    if (TOKEN) {
      console.log('[Withdrawals] ✅ Токен загружен из хранилища');
    } else {
      console.log('[Withdrawals] ⏳ Ожидание токена. Откройте admin.4rabet.com');
    }

    // ===== Парсер дат =====
    function parseTimestamp(timestamp) {
      if (!timestamp) return null;
      if (typeof timestamp === 'number') return timestamp * 1000;
      if (typeof timestamp === 'string' && !isNaN(Number(timestamp))) return Number(timestamp) * 1000;
      if (typeof timestamp === 'string') {
        if (timestamp.includes('.') && timestamp.includes(':')) {
          const [datePart, timePart] = timestamp.split(' ');
          const [day, month, year] = datePart.split('.');
          const [hours, minutes, seconds] = timePart.split(':');
          return Date.UTC(year, month - 1, day, hours, minutes, seconds || 0);
        }
        if (timestamp.includes('-') && timestamp.includes(':')) {
          return new Date(timestamp.replace(' ', 'T') + 'Z').getTime();
        }
      }
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? null : date.getTime();
    }

    // ===== Формат даты в IST =====
    function formatDate(timestamp) {
      const timeMs = parseTimestamp(timestamp);
      if (!timeMs) return '—';

      const date = new Date(timeMs);
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istTime = new Date(date.getTime() + istOffset);

      const pad = n => String(n).padStart(2, '0');
      return `${pad(istTime.getUTCDate())}.${pad(istTime.getUTCMonth() + 1)}.${pad(istTime.getUTCFullYear())} ${pad(istTime.getUTCHours())}:${pad(istTime.getUTCMinutes())}:${pad(istTime.getUTCSeconds())}`;
    }

    // ===== Таймер до 24 часов =====
    function formatTimeToDelay(createdAt) {
      if (!createdAt) return null;

      const createdMs = parseTimestamp(createdAt);
      if (!createdMs) return null;

      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const timePassed = now - createdMs;
      const timeLeft = twentyFourHours - timePassed;

      if (timeLeft <= 0) return null;

      const hours = Math.floor(timeLeft / (60 * 60 * 1000));
      const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));

      if (hours === 0) {
        return {
          text: `⏰ ${minutes}m left`,
          color: '#ff9e5e',
          short: `${minutes}m`
        };
      }

      if (hours < 6) {
        return {
          text: `⏰ ${hours}h ${minutes}m left`,
          color: '#ffd966',
          short: `${hours}h ${minutes}m`
        };
      }

      return {
        text: `⏰ ${hours}h left`,
        color: '#7aa2f7',
        short: `${hours}h`
      };
    }

    // ===== Дата решения =====
    function getResolutionDate(payout) {
      if (payout.final_action_at) return payout.final_action_at;
      if (payout.updated_at) return payout.updated_at;
      if (payout.status === 'approved' || payout.status === 'paid') {
        return payout.paid_at || payout.approved_at || payout.completed_at || payout.updated_at;
      }
      if (payout.status === 'error' || ['declined', 'canceled', 'cancelled', 'closed', 'auto_decl', 'verif_decl'].includes(payout.status)) {
        return payout.updated_at;
      }
      if (['pending', 'created', 'processing'].includes(payout.status)) {
        return payout.updated_at;
      }
      return payout.created_at || null;
    }

    // ===== Проверка задержки =====
    function isDelayed(createdAt) {
      if (!createdAt) return false;
      const createdMs = parseTimestamp(createdAt);
      if (!createdMs) return false;
      const now = Date.now();
      const diffHours = (now - createdMs) / (1000 * 3600);
      return diffHours > 24;
    }

    // ===== Перетаскивание =====
    function makeDraggable(panel, handle) {
      let isDragging = false;
      let offsetX = 0;
      let offsetY = 0;
      let currentX = 0;
      let currentY = 0;

      function initDrag(e) {
        if (e.target.closest('.payouts-close-btn') ||
            e.target.closest('.resize-handle') ||
            e.target.closest('.uuid-input') ||
            e.target.closest('.search-btn') ||
            e.target.closest('.pagination-btn')) return;

        e.preventDefault();
        e.stopPropagation();

        isDragging = true;
        const rect = panel.getBoundingClientRect();
        currentX = rect.left;
        currentY = rect.top;

        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        panel.classList.add('payouts-dragging');
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
      }

      function onDrag(e) {
        if (!isDragging) return;
        e.preventDefault();

        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;

        const panelWidth = panel.offsetWidth;
        const panelHeight = panel.offsetHeight;

        newX = Math.max(0, Math.min(newX, window.innerWidth - panelWidth - 10));
        newY = Math.max(0, Math.min(newY, window.innerHeight - panelHeight - 10));

        panel.style.left = `${newX}px`;
        panel.style.top = `${newY}px`;
        panel.style.bottom = 'auto';
        panel.style.right = 'auto';

        currentX = newX;
        currentY = newY;
      }

      function stopDrag() {
        if (!isDragging) return;
        isDragging = false;
        panel.classList.remove('payouts-dragging');
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);

        try {
          const positions = JSON.parse(localStorage.getItem('payouts_panel_positions') || '{}');
          positions[panel.id || 'payouts_panel'] = { x: currentX, y: currentY };
          localStorage.setItem('payouts_panel_positions', JSON.stringify(positions));
        } catch (e) {}
      }

      try {
        const positions = JSON.parse(localStorage.getItem('payouts_panel_positions') || '{}');
        const pos = positions[panel.id || 'payouts_panel'];
        if (pos) {
          panel.style.left = `${pos.x}px`;
          panel.style.top = `${pos.y}px`;
          panel.style.bottom = 'auto';
          panel.style.right = 'auto';
          currentX = pos.x;
          currentY = pos.y;
        }
      } catch (e) {}

      (handle || panel).addEventListener('mousedown', initDrag);
      panel.style.cursor = 'default';
      if (handle) handle.style.cursor = 'move';

      return panel;
    }

    // ===== Растягивание =====
    function makeResizable(panel) {
      let isResizing = false;
      let startX, startY, startWidth, startHeight;

      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      Object.assign(resizeHandle.style, {
        position: 'absolute',
        bottom: '0',
        right: '0',
        width: '24px',
        height: '24px',
        cursor: 'se-resize',
        zIndex: '1001',
        background: 'rgba(80, 80, 96, 0.7)',
        clipPath: 'polygon(0 100%, 100% 100%, 100% 0)',
        transition: 'all 0.2s'
      });

      resizeHandle.addEventListener('mouseover', () => {
        resizeHandle.style.background = 'rgba(120, 120, 140, 0.9)';
        resizeHandle.style.width = '26px';
        resizeHandle.style.height = '26px';
      });

      resizeHandle.addEventListener('mouseout', () => {
        resizeHandle.style.background = 'rgba(80, 80, 96, 0.7)';
        resizeHandle.style.width = '24px';
        resizeHandle.style.height = '24px';
      });

      function updateFontSizes(height) {
        const scale = Math.max(0.8, Math.min(1.6, height / BASE_HEIGHT));
        const fontSize = Math.round(BASE_FONT_SIZE * scale);
        const smallFontSize = Math.max(9, fontSize - 2);

        panel.style.fontSize = `${fontSize}px`;

        const style = document.getElementById('payouts-dynamic-styles') || document.createElement('style');
        style.id = 'payouts-dynamic-styles';
        style.textContent = `
          #payouts-panel {
            font-size: ${fontSize}px !important;
          }
          #payouts-panel .uuid-section {
            padding: ${Math.round(12 * scale)}px ${Math.round(16 * scale)}px !important;
          }
          #payouts-panel .uuid-input {
            font-size: ${fontSize}px !important;
            padding: ${Math.round(6 * scale)}px ${Math.round(10 * scale)}px !important;
            border-radius: ${Math.round(4 * scale)}px !important;
          }
          #payouts-panel .search-btn {
            font-size: ${fontSize - 1}px !important;
            padding: ${Math.round(4 * scale)}px ${Math.round(10 * scale)}px !important;
            border-radius: ${Math.round(4 * scale)}px !important;
            height: ${Math.round(28 * scale)}px !important;
            min-width: ${Math.round(60 * scale)}px !important;
          }
          #payouts-panel .pagination-controls {
            padding: ${Math.round(10 * scale)}px ${Math.round(16 * scale)}px !important;
            font-size: ${fontSize}px !important;
          }
          #payouts-panel .pagination-btn {
            font-size: ${fontSize}px !important;
            padding: ${Math.round(4 * scale)}px ${Math.round(8 * scale)}px !important;
            min-width: ${Math.round(70 * scale)}px !important;
            height: ${Math.round(28 * scale)}px !important;
          }
          #payouts-panel .page-info {
            font-size: ${fontSize}px !important;
            padding: ${Math.round(4 * scale)}px ${Math.round(12 * scale)}px !important;
          }
          #payouts-panel table {
            font-size: ${fontSize}px !important;
          }
          #payouts-panel th {
            font-size: ${smallFontSize}px !important;
            padding: ${Math.round(6 * scale)}px ${Math.round(8 * scale)}px !important;
          }
          #payouts-panel td {
            font-size: ${fontSize}px !important;
            padding: ${Math.round(7 * scale)}px ${Math.round(8 * scale)}px !important;
          }
          #payouts-panel .token {
            font-size: ${smallFontSize}px !important;
            padding: ${Math.round(2 * scale)}px ${Math.round(6 * scale)}px !important;
            max-width: ${Math.round(150 * scale)}px !important;
          }
          #payouts-panel .status-badge {
            font-size: ${Math.max(9, fontSize - 2)}px !important;
            padding: ${Math.round(2 * scale)}px ${Math.round(8 * scale)}px !important;
            border-radius: ${Math.round(12 * scale)}px !important;
            height: ${Math.round(20 * scale)}px !important;
          }
          #payouts-panel .delay-timer-badge {
            font-size: ${Math.max(9, fontSize - 2)}px !important;
            padding: ${Math.round(2 * scale)}px ${Math.round(8 * scale)}px !important;
            border-radius: ${Math.round(12 * scale)}px !important;
            height: ${Math.round(20 * scale)}px !important;
            background: rgba(255, 158, 94, 0.15) !important;
            border: 1px solid currentColor !important;
          }
          #payouts-panel #payouts-status {
            font-size: ${smallFontSize}px !important;
            padding: ${Math.round(10 * scale)}px ${Math.round(14 * scale)}px !important;
          }
          #payouts-panel .payouts-close-btn {
            font-size: 14px !important;
            padding: 2px 8px !important;
            top: 6px !important;
            right: 8px !important;
          }
          #payouts-panel .drag-handle {
            height: ${Math.round(32 * scale)}px !important;
          }
          #payouts-panel .drag-handle span {
            font-size: ${Math.round(12 * scale)}px !important;
            top: ${Math.round(8 * scale)}px !important;
            left: ${Math.round(12 * scale)}px !important;
          }
        `;

        if (!document.getElementById('payouts-dynamic-styles')) {
          document.head.appendChild(style);
        } else {
          document.getElementById('payouts-dynamic-styles').textContent = style.textContent;
        }
      }

      function fitColumns() {
        const tableContainer = document.getElementById('payouts-table-container');
        const table = tableContainer?.querySelector('table');
        if (!table) return;

        const containerWidth = tableContainer.clientWidth - 17;
        const minColWidths = [110, 110, 80, 100, 200];

        const currentHeight = parseInt(panel.style.height) || BASE_HEIGHT;
        const scale = Math.max(0.8, Math.min(1.6, currentHeight / BASE_HEIGHT));

        const scaledMinWidths = minColWidths.map(w => Math.round(w * scale));
        const totalMinWidth = scaledMinWidths.reduce((a, b) => a + b, 0);

        const headers = table.querySelectorAll('th');

        if (containerWidth > totalMinWidth) {
          const extraSpace = containerWidth - totalMinWidth;
          headers.forEach((header, index) => {
            const proportion = scaledMinWidths[index] / totalMinWidth;
            const extra = Math.floor(extraSpace * proportion);
            header.style.width = `${scaledMinWidths[index] + extra}px`;
          });
        } else {
          headers.forEach((header, index) => {
            header.style.width = `${scaledMinWidths[index]}px`;
          });
        }
      }

      function initResize(e) {
        e.preventDefault();
        e.stopPropagation();

        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(document.defaultView.getComputedStyle(panel).width, 10);
        startHeight = parseInt(document.defaultView.getComputedStyle(panel).height, 10);

        document.addEventListener('mousemove', onResize);
        document.addEventListener('mouseup', stopResize);

        panel.classList.add('payouts-resizing');
      }

      function onResize(e) {
        if (!isResizing) return;
        e.preventDefault();

        const minWidth = 700;
        const minHeight = 450;
        const maxWidth = window.innerWidth - 40;
        const maxHeight = window.innerHeight - 40;

        let newWidth = startWidth + (e.clientX - startX);
        let newHeight = startHeight + (e.clientY - startY);

        newWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
        newHeight = Math.min(Math.max(newHeight, minHeight), maxHeight);

        panel.style.width = `${newWidth}px`;
        panel.style.height = `${newHeight}px`;
        panel.style.maxHeight = `${newHeight}px`;

        updateFontSizes(newHeight);
        setTimeout(fitColumns, 10);

        try {
          const sizes = JSON.parse(localStorage.getItem('payouts_panel_sizes') || '{}');
          sizes[panel.id || 'payouts_panel'] = { width: newWidth, height: newHeight };
          localStorage.setItem('payouts_panel_sizes', JSON.stringify(sizes));
        } catch (err) {}
      }

      function stopResize() {
        if (!isResizing) return;
        isResizing = false;
        panel.classList.remove('payouts-resizing');
        document.removeEventListener('mousemove', onResize);
        document.removeEventListener('mouseup', stopResize);
        fitColumns();
      }

      resizeHandle.addEventListener('mousedown', initResize);
      panel.appendChild(resizeHandle);

      const resizeObserver = new ResizeObserver(() => {
        fitColumns();
      });

      setTimeout(() => {
        const tableContainer = document.getElementById('payouts-table-container');
        if (tableContainer) {
          resizeObserver.observe(tableContainer);
        }
      }, 1000);

      try {
        const sizes = JSON.parse(localStorage.getItem('payouts_panel_sizes') || '{}');
        const size = sizes[panel.id || 'payouts_panel'];
        if (size) {
          panel.style.width = `${size.width}px`;
          panel.style.height = `${size.height}px`;
          panel.style.maxHeight = `${size.height}px`;
          setTimeout(() => {
            updateFontSizes(size.height);
            fitColumns();
          }, 100);
        } else {
          setTimeout(() => {
            updateFontSizes(BASE_HEIGHT);
            fitColumns();
          }, 100);
        }
      } catch (e) {
        setTimeout(() => {
          updateFontSizes(BASE_HEIGHT);
          fitColumns();
        }, 100);
      }

      panel.updateFontSizes = updateFontSizes;
      panel.fitColumns = fitColumns;

      return panel;
    }

    // ===== Управление прокруткой =====
    function toggleBodyScroll(disable) {
      if (disable) {
        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = '15px';
      } else {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      }
    }

    // ===== Очистка панели =====
    function clearPanel() {
      const tableContainer = document.getElementById('payouts-table-container');
      const statusDiv = document.getElementById('payouts-status');
      const paginationDiv = document.getElementById('payouts-pagination');

      if (tableContainer) tableContainer.innerHTML = '';
      if (statusDiv) {
        statusDiv.style.display = 'none';
        statusDiv.innerHTML = '';
      }
      if (paginationDiv) {
        paginationDiv.style.display = 'none';
        paginationDiv.innerHTML = '';
      }
    }

    // ===== Поиск UUID на странице =====
    function findUUID() {
      const match = document.body.innerText.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
      );
      return match ? match[0] : null;
    }

    // ===== API запрос с использованием текущего токена =====
    function api(url) {
      return new Promise((resolve, reject) => {
        if (!TOKEN) {
          reject(new Error('No token available'));
          return;
        }

        GM_xmlhttpRequest({
          method: 'GET',
          url,
          headers: {
            'Authorization': TOKEN,
            'Accept': 'application/json'
          },
          onload: r => {
            if (r.status === 401) {
              console.error('[Withdrawals] ❌ Токен невалиден');
              reject(new Error('Token expired'));
              return;
            }
            try {
              resolve(JSON.parse(r.responseText));
            } catch(e) {
              reject(e);
            }
          },
          onerror: reject
        });
      });
    }

    // ===== Пагинация =====
    function prevPage() {
      if (!allPayouts || allPayouts.length === 0) return;
      totalPages = Math.ceil(allPayouts.length / ITEMS_PER_PAGE);
      if (currentPage > 1) {
        currentPage--;
        renderPayoutsTable();
        renderPagination();
      }
    }

    function nextPage() {
      if (!allPayouts || allPayouts.length === 0) return;
      totalPages = Math.ceil(allPayouts.length / ITEMS_PER_PAGE);
      if (currentPage < totalPages) {
        currentPage++;
        renderPayoutsTable();
        renderPagination();
      }
    }

    function renderPagination() {
      const paginationDiv = document.getElementById('payouts-pagination');
      if (!paginationDiv) return;

      totalPages = Math.ceil(allPayouts.length / ITEMS_PER_PAGE);

      if (!allPayouts || allPayouts.length === 0 || totalPages <= 1) {
        paginationDiv.style.display = 'none';
        paginationDiv.innerHTML = '';
        return;
      }

      paginationDiv.style.display = 'flex';
      paginationDiv.innerHTML = '';

      const prevBtn = document.createElement('button');
      prevBtn.className = 'pagination-btn';
      prevBtn.innerHTML = '←';
      prevBtn.style.minWidth = '70px';
      prevBtn.onclick = function(e) {
        e.stopPropagation();
        e.preventDefault();
        prevPage();
      };
      paginationDiv.appendChild(prevBtn);

      const pageInfo = document.createElement('span');
      pageInfo.className = 'page-info';
      pageInfo.innerHTML = `${currentPage} / ${totalPages}`;
      pageInfo.style.minWidth = '70px';
      pageInfo.style.textAlign = 'center';
      paginationDiv.appendChild(pageInfo);

      const nextBtn = document.createElement('button');
      nextBtn.className = 'pagination-btn';
      nextBtn.innerHTML = '→';
      nextBtn.style.minWidth = '70px';
      nextBtn.onclick = function(e) {
        e.stopPropagation();
        e.preventDefault();
        nextPage();
      };
      paginationDiv.appendChild(nextBtn);
    }

    // ===== Поиск по UUID =====
    async function searchByUUID(uuid) {
      const statusDiv = document.getElementById('payouts-status');
      const tableContainer = document.getElementById('payouts-table-container');

      clearPanel();

      if (!uuid) {
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '❌ UUID не найден в чате';
        statusDiv.style.color = '#ff7b7b';
        return;
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(uuid)) {
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '❌ Неверный формат UUID';
        statusDiv.style.color = '#ff7b7b';
        return;
      }

      if (!TOKEN) {
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '❌ Токен не получен. Откройте admin.4rabet.com для авторизации.';
        statusDiv.style.color = '#ff7b7b';
        return;
      }

      statusDiv.style.display = 'block';
      statusDiv.innerHTML = '⏳ Ищу игрока...';
      statusDiv.style.color = '#a0a0a0';

      try {
        const players = await api(`${API_V1}/players?uuid=${uuid}&with=balances`);

        if (!players.data || !players.data.length) {
          statusDiv.innerHTML = '❌ Игрок не найден';
          return;
        }

        const player = players.data[0];
        const playerId = player.id;
        currentPlayerInfo = player;

        statusDiv.innerHTML = `⏳ Загрузка выплат...`;

        const payouts = await api(`${API_V3}/payouts?player_id=${playerId}&pagination[limit]=${LIMIT}&sort=-created_at`);

        allPayouts = payouts.data || [];
        totalPages = Math.ceil(allPayouts.length / ITEMS_PER_PAGE);
        currentPage = 1;

        renderPayoutsTable();
        renderPagination();

        statusDiv.style.display = 'none';

      } catch (e) {
        console.error('Search error:', e);
        statusDiv.innerHTML = '❌ Ошибка загрузки. Проверьте токен.';
        statusDiv.style.color = '#ff7b7b';
      }
    }

    // ===== Автопоиск при открытии =====
    async function autoSearch() {
      const uuid = findUUID();
      if (uuid && panel.uuidInput) {
        panel.uuidInput.value = uuid;
        await searchByUUID(uuid);
      } else {
        const statusDiv = document.getElementById('payouts-status');
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '💡 UUID не найден в текущем чате. Введите UUID вручную.';
        statusDiv.style.color = '#a0a0a0';
      }
    }

    // ===== Рендер таблицы =====
    function renderPayoutsTable() {
      const tableContainer = document.getElementById('payouts-table-container');
      const statusDiv = document.getElementById('payouts-status');

      if (!allPayouts || !allPayouts.length) {
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '⚠️ Выплат нет';
        statusDiv.style.color = '#ff9e5e';
        tableContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Нет выплат</div>';

        const paginationDiv = document.getElementById('payouts-pagination');
        if (paginationDiv) {
          paginationDiv.style.display = 'none';
          paginationDiv.innerHTML = '';
        }
        return;
      }

      totalPages = Math.ceil(allPayouts.length / ITEMS_PER_PAGE);

      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, allPayouts.length);
      const currentPayouts = allPayouts.slice(startIndex, endIndex);

      let tableHTML = `
        <table>
          <thead>
            <tr>
              <th>Создана (IST)</th>
              <th>Решение (IST)</th>
              <th>Сумма</th>
              <th>Токен</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
      `;

      currentPayouts.forEach(p => {
        const created = formatDate(p.created_at);
        const resolutionTimestamp = getResolutionDate(p);
        const resolutionDate = resolutionTimestamp ? formatDate(resolutionTimestamp) : '—';
        const amount = formatAmount(p.amount.amount);
        const token = p.transaction_token || p.id_hash || p.id || '—';
        const shortToken = formatToken(token);
        const fullToken = token;

        const { statusText, statusColor } = formatStatus(p);
        const isDelayedStatus = ['pending', 'processing', 'error', 'created'].includes(p.status) && isDelayed(p.created_at);
        const rowClass = isDelayedStatus ? 'class="delayed"' : '';

        const showDelayTimer = ['pending', 'created', 'processing', 'error'].includes(p.status) && !isDelayed(p.created_at);
        let delayTimer = null;
        if (showDelayTimer) {
          delayTimer = formatTimeToDelay(p.created_at);
        }

        let resolutionDateColor = '#ff9e5e';
        if (p.status === 'approved' || p.status === 'paid') {
          resolutionDateColor = '#7dcf7d';
        } else if (['error', 'declined', 'canceled', 'cancelled', 'closed', 'auto_decl', 'verif_decl'].includes(p.status)) {
          resolutionDateColor = '#ff7b7b';
        }

        let statusCell = `<td style="white-space: nowrap;">`;
        statusCell += `<div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">`;
        statusCell += `<span style="color: ${statusColor}; font-weight: 600; white-space: nowrap;">${statusText}</span>`;

        if (delayTimer) {
          statusCell += `<span class="status-badge delay-timer-badge" style="background: ${delayTimer.color}20; color: ${delayTimer.color}; border: 1px solid ${delayTimer.color};">${delayTimer.text}</span>`;
        }

        if (isDelayedStatus) {
          statusCell += `<span class="status-badge delayed-badge">Delayed</span>`;
        }

        statusCell += `</div>`;

        tableHTML += `
          <tr ${rowClass}>
            <td style="color: #b0b0b0; white-space: nowrap;">${created}</td>
            <td style="color: ${resolutionDateColor}; white-space: nowrap; font-weight: 600;">${resolutionDate}</td>
            <td style="font-weight: 600; color: #ffd700; white-space: nowrap;">${amount}</td>
            <td><span class="token" onclick="navigator.clipboard.writeText('${fullToken.replace(/'/g, "\\'")}')" title="Кликни чтобы скопировать">${shortToken}</span></td>
            ${statusCell}
          </tr>
        `;
      });

      tableHTML += `</tbody></table>`;

      if (allPayouts.length > ITEMS_PER_PAGE) {
        tableHTML += `
          <div style="padding: 8px 16px; background: #232329; border-top: 1px solid #323238; color: #888; font-size: 10px; text-align: center;">
            📄 ${startIndex + 1}-${endIndex} из ${allPayouts.length} выплат
          </div>
        `;
      }

      tableContainer.innerHTML = tableHTML;
      statusDiv.style.display = 'none';

      setTimeout(() => {
        if (panel?.updateFontSizes) {
          panel.updateFontSizes(parseInt(panel.style.height) || BASE_HEIGHT);
        }
        if (panel?.fitColumns) {
          panel.fitColumns();
        }
      }, 100);
    }

    // ===== Создание панели =====
    function createPanel() {
      if (document.getElementById('payouts-panel')) {
        return document.getElementById('payouts-panel');
      }

      const panel = document.createElement('div');
      panel.id = 'payouts-panel';
      Object.assign(panel.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '750px',
        height: '550px',
        backgroundColor: '#1a1a1e',
        color: '#e0e0e0',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        zIndex: '2147483647',
        fontFamily: FONT_STACK,
        fontSize: '11px',
        lineHeight: '1.5',
        pointerEvents: 'auto',
        backdropFilter: 'blur(4px)',
        display: 'none',
        flexDirection: 'column',
        border: '1px solid #323238',
        margin: '0',
        padding: '0',
        overflow: 'hidden'
      });

      const dragHandle = document.createElement('div');
      dragHandle.className = 'drag-handle';
      Object.assign(dragHandle.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '32px',
        cursor: 'move',
        zIndex: '999',
        backgroundColor: 'transparent',
        borderBottom: '1px solid #323238'
      });

      const titleText = document.createElement('span');
      Object.assign(titleText.style, {
        position: 'absolute',
        top: '8px',
        left: '12px',
        color: '#e0e0e0',
        fontSize: '12px',
        fontWeight: '600',
        zIndex: '1000',
        pointerEvents: 'none'
      });
      dragHandle.appendChild(titleText);
      panel.appendChild(dragHandle);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'payouts-close-btn';
      closeBtn.innerHTML = '✕';
      Object.assign(closeBtn.style, {
        position: 'absolute',
        top: '6px',
        right: '8px',
        background: '#2a2a30',
        border: 'none',
        color: '#888',
        cursor: 'pointer',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '14px',
        lineHeight: '1',
        transition: 'all 0.2s',
        fontFamily: FONT_STACK,
        zIndex: '1000',
        display: 'block'
      });

      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hidePanel();
      });

      panel.appendChild(closeBtn);

      const uuidSection = document.createElement('div');
      uuidSection.className = 'uuid-section';
      Object.assign(uuidSection.style, {
        padding: '12px 16px',
        backgroundColor: '#232329',
        borderBottom: '1px solid #323238',
        marginTop: '32px',
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        position: 'relative',
        minHeight: '52px'
      });

      const uuidInput = document.createElement('input');
      uuidInput.type = 'text';
      uuidInput.className = 'uuid-input';
      uuidInput.placeholder = '🔍 Введите UUID игрока...';
      Object.assign(uuidInput.style, {
        flex: '1',
        minWidth: '200px',
        padding: '6px 10px',
        backgroundColor: '#1a1a1e',
        border: '1px solid #3a3a44',
        borderRadius: '4px',
        color: '#e0e0e0',
        fontSize: '11px',
        fontFamily: FONT_STACK,
        outline: 'none',
        transition: 'border-color 0.2s',
        height: '33px',
        lineHeight: '1',
        boxSizing: 'border-box',
        margin: '0'
      });

      uuidInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          searchByUUID(uuidInput.value.trim());
        }
      });

      const searchBtn = document.createElement('button');
      searchBtn.className = 'search-btn';
      searchBtn.innerHTML = ' 🔍 ';
      Object.assign(searchBtn.style, {
        padding: '0 12px',
        backgroundColor: '#2a2a30',
        border: '1px solid #3a3a44',
        borderRadius: '4px',
        color: '#e0e0e0',
        fontSize: '11px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s',
        fontFamily: FONT_STACK,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '28px',
        lineHeight: '1',
        boxSizing: 'border-box',
        margin: '0',
        letterSpacing: '0.3px'
      });

      searchBtn.addEventListener('click', () => {
        searchByUUID(uuidInput.value.trim());
      });

      uuidSection.appendChild(uuidInput);
      uuidSection.appendChild(searchBtn);
      panel.appendChild(uuidSection);

      const tableContainer = document.createElement('div');
      tableContainer.id = 'payouts-table-container';
      Object.assign(tableContainer.style, {
        overflowY: 'auto',
        overflowX: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: '#505060 #2a2a30',
        flex: '1 1 auto',
        padding: '0',
        height: 'calc(100% - 170px)',
        maxHeight: 'calc(100% - 170px)'
      });
      panel.appendChild(tableContainer);

      const paginationDiv = document.createElement('div');
      paginationDiv.id = 'payouts-pagination';
      paginationDiv.className = 'pagination-controls';
      Object.assign(paginationDiv.style, {
        display: 'none',
        padding: '10px 16px',
        backgroundColor: '#232329',
        borderTop: '1px solid #323238',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        flexShrink: '0'
      });
      panel.appendChild(paginationDiv);

      const statusDiv = document.createElement('div');
      statusDiv.id = 'payouts-status';
      Object.assign(statusDiv.style, {
        padding: '10px 14px',
        color: '#a0a0a0',
        fontSize: '11px',
        textAlign: 'center',
        display: 'none',
        background: '#232329',
        flexShrink: '0',
        borderTop: '1px solid #323238'
      });
      panel.appendChild(statusDiv);

      document.body.appendChild(panel);
      makeResizable(panel);
      makeDraggable(panel, dragHandle);
      panel.uuidInput = uuidInput;

      const style = document.createElement('style');
      style.id = 'payouts-base-styles';
      style.textContent = `
        #payouts-panel { isolation: isolate; contain: content; pointer-events: auto !important; transform: translateZ(0); will-change: left, top, width, height; transition: box-shadow 0.3s ease, border-color 0.3s ease; }
        #payouts-panel.payouts-resizing { box-shadow: 0 0 0 2px #4a90e2; user-select: none; }
        #payouts-panel .payouts-close-btn { display: block !important; z-index: 1000 !important; }
        #payouts-panel ::-webkit-scrollbar { width: 8px; height: 8px; }
        #payouts-panel ::-webkit-scrollbar-track { background: #2a2a30; border-radius: 4px; }
        #payouts-panel ::-webkit-scrollbar-thumb { background: #505060; border-radius: 4px; }
        #payouts-panel ::-webkit-scrollbar-thumb:hover { background: #606070; }
        #payouts-panel #payouts-table-container { scroll-behavior: smooth; overflow-y: auto !important; overflow-x: auto !important; padding: 0 !important; }
        body:has(#payouts-panel[style*="display: flex"]) { overflow: hidden !important; }
        #payouts-panel table { border-collapse: collapse; width: 100%; background: #1a1a1e; border: none; margin: 0; table-layout: fixed; }
        #payouts-panel thead { position: sticky; top: 0; z-index: 10; }
        #payouts-panel th { background: #232329; color: #888; text-align: left; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; white-space: nowrap; border-bottom: 1px solid #323238; padding: 8px 8px; }
        #payouts-panel td { text-align: left; vertical-align: middle; white-space: nowrap; background: #1a1a1e; border: none; border-bottom: 1px solid #323238; padding: 8px 8px; }
        #payouts-panel tr:hover td { background: #25252b; }
        #payouts-panel .delayed td { background: rgba(255, 60, 60, 0.1); }
        #payouts-panel .delayed:hover td { background: rgba(255, 60, 60, 0.15); }
        #payouts-panel .token { font-family: 'JetBrains Mono', 'Fira Code', monospace; color: #7aa2f7; background: #2a2a30; border-radius: 4px; padding: 2px 6px; cursor: pointer; transition: all 0.2s; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px; }
        #payouts-panel .token:hover { background: #3a3a44; color: #9ab8ff; }
        #payouts-panel .pagination-controls { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 16px; background: #232329; border-top: 1px solid #323238; }
        #payouts-panel .pagination-btn { background: #2a2a30; border: 1px solid #3a3a44; color: #e0e0e0; padding: 4px 8px; min-width: 70px; height: 28px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        #payouts-panel .pagination-btn:hover { background: #3a3a44; border-color: #4a90e2; color: #fff; }
        #payouts-panel .page-info { color: #e0e0e0; font-size: 11px; padding: 4px 12px; background: #1a1a1e; border-radius: 4px; border: 1px solid #3a3a44; font-weight: 500; min-width: 70px; text-align: center; }
        #payouts-panel .status-badge { display: inline-flex; align-items: center; justify-content: center; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; line-height: 1.4; white-space: nowrap; height: 20px; color: white; border: none; }
        #payouts-panel .delayed-badge { background: #ff3c3c; }
        #payouts-panel .delay-timer-badge { background: rgba(255, 158, 94, 0.15); color: #ff9e5e; border: 1px solid #ff9e5e; font-weight: 500; }
      `;
      document.head.appendChild(style);

      return panel;
    }

    // ===== Форматирование =====
    function formatAmount(raw) {
      const amount = Number(raw) / 100;
      return amount.toLocaleString('en-IN') + ' INR';
    }

    function formatToken(token) {
      if (!token) return '—';
      if (token.length <= 12) return token;
      return `${token.slice(0, 6)}...${token.slice(-6)}`;
    }

    function formatStatus(payout) {
      const status = payout.status;
      let statusText = status;
      let statusColor = '#e0e0e0';

      switch(status) {
        case 'approved': case 'paid': statusText = '✅ Выплачена'; statusColor = '#7dcf7d'; break;
        case 'pending': case 'created': statusText = '⏳ В ожидании'; statusColor = '#ffd966'; break;
        case 'processing': statusText = '🔄 В обработке'; statusColor = '#7aa2f7'; break;
        case 'error': statusText = '♻️ Отмен. Агрегатор'; statusColor = '#ffd966'; break;
        case 'auto_decl': statusText = '❌ Отмена. Баланс'; statusColor = '#ff7b7b'; break;
        case 'verif_decl': statusText = '❌ Отмена. KYC'; statusColor = '#ff7b7b'; break;
        case 'declined': statusText = '❌ Отмена. Игрок'; statusColor = '#ff7b7b'; break;
        case 'closed': statusText = '❌ Закрыто. Админ'; statusColor = '#ff7b7b'; break;
        case 'canceled': case 'cancelled': statusText = '❌ Отменено'; statusColor = '#ff7b7b'; break;
      }

      return { statusText, statusColor };
    }

    // ===== Показ/скрытие панели =====
    function showPanel() {
      if (!visible) {
        clearPanel();
        visible = true;
        panel.style.display = 'flex';
        toggleBodyScroll(true);

        const statusDiv = document.getElementById('payouts-status');
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '🔍 Автоматический поиск UUID...';
        statusDiv.style.color = '#a0a0a0';

        autoSearch();
      }
    }

    function hidePanel() {
      visible = false;
      panel.style.display = 'none';
      clearPanel();
      toggleBodyScroll(false);
      currentPlayerInfo = null;
      allPayouts = [];
      currentPage = 1;
      totalPages = 1;
    }

    function togglePanel() {
      visible ? hidePanel() : showPanel();
    }

    // ===== Хоткей ESC =====
    function setupEscHotkey() {
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && visible) {
          e.preventDefault();
          e.stopPropagation();
          hidePanel();
        }
      }, true);
    }

    // ===== Отслеживание смены чата =====
    function setupConversationObserver() {
      function getConversationIdFromUrl() {
        const match = window.location.pathname.match(/\/conversations\/(\d+)/);
        return match ? match[1] : null;
      }

      let lastUrl = window.location.href;

      new MutationObserver(() => {
        const url = window.location.href;
        if (url !== lastUrl) {
          lastUrl = url;
          const newConversationId = getConversationIdFromUrl();
          if (newConversationId !== currentConversationId) {
            currentConversationId = newConversationId;
            hidePanel();
          }
        }
      }).observe(document, { subtree: true, childList: true });

      currentConversationId = getConversationIdFromUrl();
    }

    // ===== Кнопка в Chatwoot =====
    function createChatwootButton() {
      let button = null;
      let lastButtonState = false;

      function insertButton() {
        const resolveDiv = document.querySelector('.resolve-actions > div');
        if (!resolveDiv) return false;

        const existingButton = Array.from(resolveDiv.querySelectorAll('button')).find(
          btn => btn.innerText.includes('Withdrawals')
        );
        if (existingButton) {
          button = existingButton;
          return true;
        }

        button = document.createElement('button');
        button.innerHTML = '<span class="min-w-0 truncate">Withdrawals</span>';
        Object.assign(button.style, {
          height: '32px',
          padding: '0 12px',
          borderRadius: '0.5rem',
          border: '0',
          backgroundColor: '#2c2d36',
          color: 'white',
          fontSize: '0.875rem',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          cursor: 'pointer',
          transition: 'all 0.1s ease-out',
          marginRight: '8px'
        });

        button.onclick = (e) => {
          e.stopPropagation();
          togglePanel();
        };

        const firstButton = resolveDiv.querySelector('button');
        if (firstButton) {
          resolveDiv.insertBefore(button, firstButton);
        } else {
          resolveDiv.appendChild(button);
        }

        return true;
      }

      const observer = new MutationObserver(() => {
        const hasButton = insertButton();
        if (lastButtonState && !hasButton) setTimeout(insertButton, 100);
        lastButtonState = hasButton;
      });

      observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: false });
      setInterval(insertButton, 2000);
      setTimeout(insertButton, 500);
    }

    // ===== Инициализация =====
    function init() {
      panel = createPanel();
      createChatwootButton();
      setupConversationObserver();
      setupEscHotkey();

      if (TOKEN) {
        console.log('[Withdrawals] ✅ Токен загружен из хранилища');
      } else {
        console.log('[Withdrawals] ⏳ Ожидание токена. Откройте admin.4rabet.com');
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

})();