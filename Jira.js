// ==UserScript==
// @name         Chatwoot Jira Integration
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Jira поиск и создание тикетов для Chatwoot
// @match        *://app.chatwoot.com/*
// @grant        GM_xmlhttpRequest
// @connect      176.98.182.140
// @license MIT
// ==/UserScript==

(function() {
    'use strict';

    const PROXY_URL = "http://176.98.182.140:3011/search";
    const SERVER_URL = "http://176.98.182.140:3011";
    const CLEAR_DELAY = 5000;
    const USERNAME = "pavel";
    const FONT_STACK = 'Inter, -apple-system, system-ui, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Tahoma, Arial, sans-serif !important';

    let searchClearTimeout = null;
    let searchDebounceTimeout = null;

    // Функция для определения оптимального положения для результатов поиска
    function getOptimalResultsPosition(panelElement, resultsHeight) {
        const panelRect = panelElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        const panelBottom = panelRect.bottom;
        const panelTop = panelRect.top;

        const spaceBelow = viewportHeight - panelBottom - 20;
        const spaceAbove = panelTop - 20;

        const isBottomThird = panelBottom > viewportHeight * 2/3;
        const isTopThird = panelTop < viewportHeight * 1/3;
        const isMiddleThird = !isTopThird && !isBottomThird;

        if (isBottomThird && spaceBelow < resultsHeight) {
            return 'top';
        } else if (isTopThird && spaceAbove < resultsHeight) {
            return 'bottom';
        } else if (isMiddleThird) {
            return 'bottom';
        } else {
            return spaceBelow >= spaceAbove ? 'bottom' : 'top';
        }
    }

    // Функции для перетаскивания
    function makeDraggable(panel, handleSelector = null) {
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;
        let currentX = 0;
        let currentY = 0;
        let activeHandle = null;

        const dragStyle = document.createElement('style');
        dragStyle.textContent = `
            .draggable-handle {
                cursor: move !important;
                user-select: none;
            }
            .dragging {
                opacity: 0.9 !important;
                cursor: move !important;
            }
        `;
        document.head.appendChild(dragStyle);

        function initDrag(e) {
            if (handleSelector && !e.target.closest(handleSelector)) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            isDragging = true;
            activeHandle = e.target.closest(handleSelector) || panel;

            const rect = panel.getBoundingClientRect();
            currentX = rect.left;
            currentY = rect.top;

            if (handleSelector) {
                const handleRect = activeHandle.getBoundingClientRect();
                offsetX = e.clientX - handleRect.left;
                offsetY = e.clientY - handleRect.top;
            } else {
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
            }

            panel.classList.add('dragging');

            document.addEventListener('mousemove', onDrag);
            document.addEventListener('mouseup', stopDrag);
            document.body.style.userSelect = 'none';

            const currentZIndex = parseInt(panel.style.zIndex || '9999');
            panel.style.zIndex = (currentZIndex + 10000).toString();
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
            panel.classList.remove('dragging');

            const baseZIndex = panel.getAttribute('data-base-z-index') || '9999';
            panel.style.zIndex = baseZIndex;

            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', stopDrag);
            document.body.style.userSelect = '';

            savePanelPosition(panel.id || panel.className);

            const input = panel.querySelector('input');
            if (input) {
                setTimeout(() => input.focus(), 50);
            }
        }

        function savePanelPosition(panelId) {
            try {
                const positions = JSON.parse(localStorage.getItem('jira_panel_positions') || '{}');
                positions[panelId] = { x: currentX, y: currentY };
                localStorage.setItem('jira_panel_positions', JSON.stringify(positions));
            } catch (e) {
                console.error('Ошибка сохранения позиции:', e);
            }
        }

        function loadPanelPosition(panelId) {
            try {
                const positions = JSON.parse(localStorage.getItem('jira_panel_positions') || '{}');
                const pos = positions[panelId];
                if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
                    panel.style.left = `${pos.x}px`;
                    panel.style.top = `${pos.y}px`;
                    panel.style.bottom = 'auto';
                    panel.style.right = 'auto';

                    currentX = pos.x;
                    currentY = pos.y;
                    return true;
                }
            } catch (e) {
                console.error('Ошибка загрузки позиции:', e);
            }
            return false;
        }

        const panelId = panel.id || panel.className;
        if (panelId) {
            loadPanelPosition(panelId);
        }

        panel.setAttribute('data-base-z-index', panel.style.zIndex || '9999');

        if (handleSelector) {
            const handle = panel.querySelector(handleSelector);
            if (handle) {
                handle.classList.add('draggable-handle');
                handle.addEventListener('mousedown', initDrag);
            }
        } else {
            panel.classList.add('draggable-handle');
            panel.addEventListener('mousedown', initDrag);
        }

        return panel;
    }

    // Создание объединенной панели
    const combinedPanel = document.createElement('div');
    combinedPanel.id = 'jira_combined_panel';
    Object.assign(combinedPanel.style, {
        position: 'fixed',
        bottom: '340px',
        left: '10px',
        width: '300px',
        backgroundColor: '#17171a',
        color: '#fff',
        border: '1px solid #121213',
        borderRadius: '5px',
        boxShadow: '0 1px 5px rgba(0,0,0,0.5)',
        zIndex: '9999',
        fontFamily: FONT_STACK,
        fontSize: '14px',
        lineHeight: '20px',
        opacity: '1',
        transition: 'opacity 0.3s',
        pointerEvents: 'auto',
        cursor: 'default'
    });

    combinedPanel.innerHTML = `
        <div class="drag-handle" style="
            display: flex;
            align-items: center;
            margin-bottom: 10px;
            padding: 4px;
            border-radius: 3px;
            background: rgba(255,255,255,0.05);
            cursor: move;
            user-select: none;
        ">
            <span style="
                flex-grow: 1;
                font-size: 11px;
                color: #858585;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            ">Jira Integration</span>
            <span style="
                font-size: 10px;
                color: #666;
                margin-left: 5px;
            ">⎘</span>
        </div>

        <!-- Секция поиска -->
        <div style="margin-bottom: 15px; padding: 0 6px;">
            <input id="jira_search_input" type="text" autocomplete="off" autocorrect="off" placeholder="" style="
                width:100%;
                padding:8px;
                background-color:#121213;
                border:1px solid #17171a;
                border-radius:4px;
                color:#fff;
                font-family: ${FONT_STACK};
                font-size:18px;
                line-height:24px;
                text-align:center;
                cursor: text;
            ">
        </div>

        <!-- Результаты поиска -->
        <div id="jira_search_results" style="
            position: absolute;
            left: 6px;
            right: 6px;
            max-height: 180px;
            overflow-y: auto;
            background-color: #121213;
            border-radius: 4px;
            border: 1px solid #17171a;
            display: none;
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: auto;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
        "></div>

        <!-- Секция создания -->
        <div style="padding: 0 6px;">
            <input id="jira_uuid" placeholder="UUID" style="width:100%; margin-bottom:5px; padding:6px; background:#121213; color:#fff; border-radius:4px;">
            <input id="jira_screenshot" placeholder="URL" style="width:100%; margin-bottom:5px; padding:6px; background:#121213; color:#fff; border-radius:4px;">
            <input id="jira_utr" placeholder="UTR" style="width:100%; margin-bottom:5px; padding:6px; background:#121213; color:#fff; border-radius:4px;">
            <input id="jira_amount" placeholder="$$$" style="width:100%; margin-bottom:10px; padding:6px; background:#121213; color:#fff; border-radius:4px;">
            <div style="text-align:center;">
                <button id="jira_submit_btn" style="padding:5px 10px; color:#858585; cursor:pointer;">SEND</button>
            </div>
            <div id="jira_preview" style="margin-top:10px; max-height:150px; overflow-y:auto;"></div>
        </div>
    `;
    document.body.appendChild(combinedPanel);

    // Стили для плейсхолдеров и фокуса
    const combinedStyle = document.createElement('style');
    combinedStyle.textContent = `
        #jira_combined_panel input::placeholder {
            color: rgba(255, 255, 255, 0.1);
            text-align: center;
        }
        #jira_combined_panel input {
            outline: none;
            border: 1px solid #17171a;
            transition: border 0.2s;
            text-align: center;
        }
        #jira_combined_panel input:focus {
            border: 1px solid #1d2e62;
        }
        #jira_search_results::-webkit-scrollbar {
            width: 6px;
        }
        #jira_search_results::-webkit-scrollbar-track {
            background: #121213;
        }
        #jira_search_results::-webkit-scrollbar-thumb {
            background: #2b2b2f;
            border-radius: 3px;
        }
    `;
    document.head.appendChild(combinedStyle);

    // Элементы управления
    const searchInput = document.getElementById('jira_search_input');
    const searchResults = document.getElementById('jira_search_results');
    const uuidInput = document.getElementById('jira_uuid');
    const screenshotInput = document.getElementById('jira_screenshot');
    const utrInput = document.getElementById('jira_utr');
    const amountInput = document.getElementById('jira_amount');
    const submitBtn = document.getElementById('jira_submit_btn');
    const previewBox = document.getElementById('jira_preview');

    // Функции поиска
    function clearSearchFields() {
        searchInput.value = '';
        searchResults.innerHTML = '';
        searchResults.style.display = 'none';
        searchResults.style.opacity = '0';
        searchResults.style.top = '';
        searchResults.style.bottom = '';
        searchResults.style.marginTop = '';
        searchResults.style.marginBottom = '';
    }

    function scheduleSearchClear() {
        if (searchClearTimeout) clearTimeout(searchClearTimeout);
        searchClearTimeout = setTimeout(() => {
            if (!combinedPanel.matches(':hover') && !searchResults.matches(':hover')) {
                clearSearchFields();
            }
        }, CLEAR_DELAY);
    }

    function showSearchResults(html) {
        searchResults.innerHTML = html;
        searchResults.style.display = 'block';
        const resultsHeight = Math.min(searchResults.scrollHeight, 180);
        searchResults.style.display = 'none';

        const optimalPosition = getOptimalResultsPosition(combinedPanel, resultsHeight);

        if (optimalPosition === 'top') {
            searchResults.style.top = 'auto';
            searchResults.style.bottom = '100%';
            searchResults.style.marginBottom = '10px';
            searchResults.style.marginTop = '0';
        } else {
            searchResults.style.top = '100%';
            searchResults.style.bottom = 'auto';
            searchResults.style.marginTop = '10px';
            searchResults.style.marginBottom = '0';
        }

        searchResults.style.display = 'block';
        setTimeout(() => searchResults.style.opacity = '1', 10);
        scheduleSearchClear();
    }

    function timeAgo(date) {
        if (!date) return '';
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return `${diffDays > 0 ? diffDays + 'д ' : ''}${diffHours}ч`;
    }

    function parseJiraDate(jiraDate) {
        if (!jiraDate) return null;
        if (typeof jiraDate === 'string') return new Date(jiraDate.replace(/(\+\d{2})(\d{2})$/, '$1:$2'));
        if (jiraDate instanceof Date) return jiraDate;
        return new Date(jiraDate.toString());
    }

    function extract12Digits(text) {
        if (!text) return '';
        const match = text.match(/\d{12}/);
        return match ? match[0] : '';
    }

    function getLastCommentDate(issue) {
        if (!issue.fields.comment || issue.fields.comment.comments.length === 0) return null;
        const sortedComments = issue.fields.comment.comments.sort((a, b) => new Date(b.created) - new Date(a.created));
        return parseJiraDate(sortedComments[0].created);
    }

    function renderSearchIssues(issues, showComments = true) {
        if (!issues || issues.length === 0) {
            showSearchResults(`<span style="color:red;">ничего не найдено</span>`);
            return;
        }

        issues = [...issues].sort((a, b) => {
            const aNum = parseInt(a.key.split('-')[1], 10);
            const bNum = parseInt(b.key.split('-')[1], 10);
            return bNum - aNum;
        });

        searchResults.innerHTML = '';
        searchResults.style.display = 'block';
        setTimeout(() => searchResults.style.opacity = '1', 10);

        const wipIssues = issues.filter(issue => {
            let status = '';
            const s = issue.fields.status;
            const r = issue.fields.resolution;
            if (r && r.name) status = r.name;
            else if (s && typeof s === 'object' && s.name) status = s.name;
            else if (s && typeof s === 'string') status = s;
            else status = 'Work in progress';
            return status === 'Work in progress' || status === 'В работе';
        });

        if (wipIssues.length > 0) {
            const copyWipBtn = document.createElement('button');
            copyWipBtn.textContent = '📋 WIP';
            Object.assign(copyWipBtn.style, {
                display: 'block',
                marginBottom: '6px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer',
                background: '#2b2b2f',
                color: '#b8b8b8',
                border: '1px solid #17171a',
                borderRadius: '4px'
            });
            copyWipBtn.addEventListener('click', () => {
                const sortedWip = [...wipIssues].sort((a, b) => {
                    const aNum = parseInt(a.key.split('-')[1], 10);
                    const bNum = parseInt(b.key.split('-')[1], 10);
                    return aNum - bNum;
                });

                const ticketText = sortedWip.map((issue, index) => {
                    const utr = extract12Digits(issue.fields.description || issue.fields.summary || '');
                    return `${index + 1}. ${issue.key} ${utr}`;
                }).join('\n');

                const fullText = `I've checked your cases – the funds for the following deposits haven't reached us yet, as the payment provider is still processing the transactions:

${ticketText}

Even if your screenshots show 'successful,' each deposit must still pass verification. We've already submitted requests, and once the payment system confirms that the transactions have been received by our bank, the process of crediting the funds to your account will be initiated. Thank you for your patience!`;

                navigator.clipboard.writeText(fullText);
                showNotification("WIP список скопирован!");
            });
            searchResults.appendChild(copyWipBtn);
        }

        const ul = document.createElement('ul');
        ul.style.paddingLeft = '0';
        ul.style.margin = '2px 0';
        ul.style.fontFamily = FONT_STACK;

        issues.forEach(issue => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.flexDirection = 'column';
            li.style.marginBottom = '6px';

            const url = `https://jira.deversin.com/browse/${issue.key}`;
            const createdDate = parseJiraDate(issue.fields.created);
            const lastCommentDate = getLastCommentDate(issue);
            let timeText = '';
            if (createdDate && lastCommentDate) {
                const createdStr = timeAgo(createdDate);
                const lastStr = timeAgo(lastCommentDate);
                timeText = (createdStr !== lastStr) ? `${createdStr} | ${lastStr}` : createdStr;
            } else if (createdDate) {
                timeText = timeAgo(createdDate);
            }

            const copyText = `${issue.key} ${extract12Digits(issue.fields.description || issue.fields.summary || '')}`;

            const threadContainer = document.createElement('div');
            threadContainer.style.display = 'flex';
            threadContainer.style.alignItems = 'flex-start';

            const copyButton = document.createElement('button');
            copyButton.style.marginLeft = '5px';
            copyButton.textContent = '📋';
            copyButton.style.marginRight = '0px';
            copyButton.style.fontSize = '12px';
            copyButton.style.padding = '3px 6px';
            copyButton.style.cursor = 'pointer';
            copyButton.style.background = '#2b2b2f';
            copyButton.style.color = '#b8b8b8';
            copyButton.style.border = '1px solid #17171a';
            copyButton.style.borderRadius = '3px';
            copyButton.addEventListener('click', () => navigator.clipboard.writeText(copyText));

            const div = document.createElement('div');
            div.style.fontFamily = FONT_STACK;

            let displayStatus = '';
            const s = issue.fields.status;
            const r = issue.fields.resolution;
            if (r && r.name) displayStatus = r.name;
            else if (s && typeof s === 'object' && s.name) displayStatus = s.name;
            else if (s && typeof s === 'string') displayStatus = s;
            else displayStatus = 'Work in progress';

            let statusColor = '#f0a500';
            const greenStatuses = ['Success', 'Credited under', 'Готово', 'Done'];
            const redStatuses = ['Failed', 'Declined'];
            if (displayStatus === 'Work in progress') statusColor = '#b8b8b8';
            else if (displayStatus === 'Not our wallet') statusColor = '#0d4c9d';
            else if (greenStatuses.includes(displayStatus)) statusColor = '#67b528';
            else if (redStatuses.includes(displayStatus)) statusColor = '#a31c20';

            div.innerHTML = `<a href="${url}" target="_blank" style="color:#9cdcfe; text-decoration:none;">${issue.key}</a>` +
                            (displayStatus ? ` — <span style="color:${statusColor};">${displayStatus}</span>` : '') +
                            (timeText ? ` <span style="color:#7c7c7c;">${timeText}</span>` : '');

            threadContainer.appendChild(copyButton);
            threadContainer.appendChild(div);
            li.appendChild(threadContainer);

            if (showComments && issue.fields.comment && issue.fields.comment.comments.length > 0) {
                const commentsUl = document.createElement('ul');
                commentsUl.style.paddingLeft = '16px';
                commentsUl.style.margin = '4px 0 0 0';
                commentsUl.style.color = '#cfcfcf';
                commentsUl.style.fontSize = '12px';
                commentsUl.style.fontFamily = FONT_STACK;

                const sortedComments = issue.fields.comment.comments.sort((a, b) => new Date(b.created) - new Date(a.created));
                sortedComments.slice(0, 3).forEach(c => {
                    const cLi = document.createElement('li');
                    const commentTime = timeAgo(parseJiraDate(c.created));
                    let commentBody = c.body || '';
                    commentBody = commentBody.replace(/\S+\.pdf/gi, '📕');
                    commentBody = commentBody.replace(/\S+\.(png|jpg|jpeg|gif|bmp|webp)/gi, '📘');
                    commentBody = commentBody.replace(/\|thumbnail!/gi, '');
                    commentBody = commentBody.length > 100 ? commentBody.substring(0, 100) + '...' : commentBody;
                    cLi.innerHTML = `<strong>${c.author.displayName}:</strong> ${commentBody} <span style="color:#999;">(${commentTime})</span>`;
                    commentsUl.appendChild(cLi);
                });
                if (sortedComments.length > 3) {
                    const moreLi = document.createElement('li');
                    moreLi.style.color = '#666';
                    moreLi.style.fontStyle = 'italic';
                    moreLi.textContent = `... и еще ${sortedComments.length - 3} комментариев`;
                    commentsUl.appendChild(moreLi);
                }
                li.appendChild(commentsUl);
            }

            ul.appendChild(li);
        });

        searchResults.appendChild(ul);
    }

    function searchJira(q) {
        if (!q) {
            clearSearchFields();
            return;
        }

        showSearchResults("Searching…");

        const tokens = q.split(/\s+/);
        let jiraKey = '';
        let utr12 = '';
        let uuid = '';

        tokens.forEach(t => {
            if (/^[A-Z]+-\d+$/i.test(t)) jiraKey = t;
            else if (/^\d{12}$/.test(t)) utr12 = t;
            else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) uuid = t;
        });

        const showComments = !uuid;

        const results = [];
        let completedRequests = 0;

        function handleResponse(r) {
            completedRequests++;
            if (r.status === 200) {
                try {
                    const data = JSON.parse(r.responseText);
                    if (data.issues && data.issues.length > 0) results.push(...data.issues);
                } catch(e) { console.error(e); }
            }
            if (completedRequests === requests.length) {
                const uniqueIssues = [];
                const keys = new Set();
                results.forEach(issue => {
                    if (!keys.has(issue.key)) {
                        keys.add(issue.key);
                        uniqueIssues.push(issue);
                    }
                });
                renderSearchIssues(uniqueIssues, showComments);
            }
        }

        const requests = [];
        if (jiraKey) requests.push(`${PROXY_URL}?q=${encodeURIComponent(jiraKey)}`);
        if (utr12) requests.push(`${PROXY_URL}?q=${encodeURIComponent(utr12)}`);
        if (uuid) requests.push(`${PROXY_URL}?q=${encodeURIComponent(uuid)}`);

        if (requests.length === 0) {
            showSearchResults(`<span style="color:red;">Неверный формат запроса</span>`);
            return;
        }

        requests.forEach(url => {
            GM_xmlhttpRequest({ method: "GET", url: url, onload: handleResponse });
        });
    }

    // Обработчики поиска
    searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim();
        if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(() => searchJira(q), 300);
    });

    [combinedPanel, searchResults].forEach(el => {
        el.addEventListener('mouseenter', () => {
            if (searchClearTimeout) clearTimeout(searchClearTimeout);
        });
        el.addEventListener('mouseleave', () => scheduleSearchClear());
    });

    // Функции создания тикетов
    const notification = document.createElement('div');
    notification.id = 'jira_notification';
    Object.assign(notification.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'rgba(23,23,26,0.95)',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '6px',
        fontSize: '16px',
        opacity: '0',
        transition: 'opacity 0.3s',
        pointerEvents: 'none',
        zIndex: '2147483647',
        textAlign: 'center',
        maxWidth: '80%',
        wordWrap: 'break-word'
    });
    document.body.appendChild(notification);

    window.showNotification = function(message, duration = 3000) {
        const notif = document.getElementById('jira_notification');
        notif.textContent = message;
        notif.style.opacity = '1';
        setTimeout(() => { notif.style.opacity = '0'; }, duration);
    };

    function checkDuplicateUTR(utr) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: `${SERVER_URL}/search?q=${encodeURIComponent(utr)}`,
                onload: res => {
                    try { resolve(JSON.parse(res.responseText).total > 0); }
                    catch(e){ reject(e); }
                },
                onerror: reject
            });
        });
    }

    function submitTicket(uuid, screenshot, utr, amount) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: `${SERVER_URL}/create`,
                headers: { "Content-Type": "application/json" },
                data: JSON.stringify({
                    username: USERNAME,
                    summary: uuid,
                    description: `${utr}\n${amount}`,
                    brand: "4rabet",
                    screenshot
                }),
                onload: res => {
                    try { resolve(JSON.parse(res.responseText)); }
                    catch(e){ reject(e); }
                },
                onerror: reject
            });
        });
    }

    const validateFields = (uuid, screenshot, utr, amount) => {
        const uuidRegex = /^[a-zA-Z0-9\-]+$/;
        const urlRegex = /^(https?:\/\/[^\s]+)$/;
        const utrRegex = /^\d{12}$/;
        const amountRegex = /^\d+(\.\d{1,2})?$/;

        if (!uuidRegex.test(uuid)) return "UUID должен содержать только буквы и цифры";
        if (!urlRegex.test(screenshot)) return "Введите корректный URL";
        if (!utrRegex.test(utr)) return "UTR должен содержать ровно 12 цифр";
        if (!amountRegex.test(amount)) return "Сумма должна быть числом";

        return null;
    };

    let isSubmitting = false;

    const handleSubmit = async () => {
        if (isSubmitting) {
            showNotification("Запрос уже выполняется, подождите...");
            return;
        }

        isSubmitting = true;
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        submitBtn.style.cursor = 'not-allowed';

        try {
            const uuid = uuidInput.value.trim();
            const screenshot = screenshotInput.value.trim();
            const utr = utrInput.value.trim();
            const amount = amountInput.value.trim();

            if (!uuid || !screenshot || !utr || !amount) {
                showNotification("Пожалуйста, заполните все поля!");
                return;
            }

            const error = validateFields(uuid, screenshot, utr, amount);
            if (error) {
                showNotification(error);
                return;
            }

            try {
                if (await checkDuplicateUTR(utr)) {
                    showNotification("Ticket с этим UTR уже существует!");
                    [uuidInput, screenshotInput, utrInput, amountInput].forEach(input => input.value = '');
                    previewBox.innerHTML = '';
                    return;
                }

                const result = await submitTicket(uuid, screenshot, utr, amount);

                const textToCopy = `${result.issueKey} ${utr}`;
                navigator.clipboard.writeText(textToCopy)
                    .then(() => showNotification("SUP создан! Ключ скопирован"))
                    .catch(() => showNotification("SUP создан!"));

                [uuidInput, screenshotInput, utrInput, amountInput].forEach(input => input.value = '');
                previewBox.innerHTML = '';

            } catch (e) {
                showNotification("Ошибка при создании тикета!");
                console.error(e);
            }
        } finally {
            setTimeout(() => {
                isSubmitting = false;
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
            }, 1000);
        }
    };

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    const debouncedHandleSubmit = debounce(handleSubmit, 300);

    submitBtn.addEventListener("click", debouncedHandleSubmit);

    const creationInputs = [uuidInput, screenshotInput, utrInput, amountInput];
    creationInputs.forEach(input => {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                debouncedHandleSubmit();
            }
        });
    });

    // Отключение автозаполнения
    const allInputs = combinedPanel.querySelectorAll('input');
    allInputs.forEach(input => {
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('autocapitalize', 'off');
        input.setAttribute('spellcheck', 'false');
        input.setAttribute('data-form-type', 'other');
        input.setAttribute('name', 'fld_' + Math.random().toString(36).slice(2, 10));
    });

    // Перетаскивание объединенной панели
    makeDraggable(combinedPanel, '.drag-handle');

    console.log('[Jira Integration] Панель загружена');
})();