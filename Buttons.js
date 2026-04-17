// ==UserScript==
// @name         Chatwoot Quick Buttons
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Быстрые кнопки для ответов в Chatwoot
// @match        *://app.chatwoot.com/*
// @grant        none
// @license MIT
// ==/UserScript==

(function() {
    'use strict';

    // Конфигурация кнопок
    const buttonsConfig = [
        { label: "Hi", text: "Hello! I am Amit, your support agent at 4rabet. I am here to help you with any questions or issues you may have." },
        { label: "Hw", text: "How can I help you?" },
        { label: "Ch", text: "Checking the information." },
        { label: "Sc", text: "Please provide us screenshot of this transaction from your payment application." },
        { label: "By", text: "Please feel free to contact us if you have new questions! Have a good day! Good luck!" },
        { label: "Un", text: "Unfortunately, we haven't received any response from you. Please feel free to contact us if you have any questions. Have a good day!" },
        { label: "In", text: "Your case CASE is currently in progress.\nOur specialists are working on it. To resolve such cases we need to receive confirmation of the transaction from the payment system.\nOnce we receive it it will be resolved as soon as possible from our side. Please wait and contact us later for an update regarding your case.", send: false, color: "#21313a" }
    ];

    function log(msg) {
        console.log("[QuickButtons]: " + msg);
    }

    function waitForElement(selector, timeout = 2000) {
        return new Promise((resolve, reject) => {
            const el = document.querySelector(selector);
            if (el) return resolve(el);

            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) {
                    observer.disconnect();
                    resolve(el);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                reject(`Element ${selector} not found in ${timeout}ms`);
            }, timeout);
        });
    }

    async function insertText(inputEl, text) {
        if (inputEl.tagName === "TEXTAREA") {
            inputEl.focus();
            inputEl.value = text;
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            inputEl.focus();
            document.execCommand('insertHTML', false, `<p>${text.replace(/\n/g, "<br>")}</p>`);
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    // Функции для изменения цвета
    function lightenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16),
              amt = Math.round(2.55 * percent),
              R = (num >> 16) + amt,
              G = (num >> 8 & 0x00FF) + amt,
              B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    function darkenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16),
              amt = Math.round(2.55 * percent),
              R = (num >> 16) - amt,
              G = (num >> 8 & 0x00FF) - amt,
              B = (num & 0x0000FF) - amt;
        return "#" + (0x1000000 + (R > 0 ? R : 0) * 0x10000 +
            (G > 0 ? G : 0) * 0x100 +
            (B > 0 ? B : 0)).toString(16).slice(1);
    }

    async function createButtons() {
        const rightWrap = document.querySelector('.reply-box .right-wrap');
        if (!rightWrap) return false;

        if (document.querySelector("#quick-buttons-container")) return true;

        const container = document.createElement("div");
        container.id = "quick-buttons-container";
        container.style.display = "flex";
        container.style.gap = "8px";
        container.style.alignItems = "center";

        buttonsConfig.forEach((cfg, idx) => {
            const btn = document.createElement("button");
            btn.id = "quick-btn-" + (idx + 1);
            btn.innerText = cfg.label;

            // ТОЧНЫЕ КЛАССЫ ИЗ СИСТЕМЫ
            btn.className = "inline-flex items-center min-w-0 gap-2 transition-all duration-100 ease-out border-0 rounded-lg outline-1 outline disabled:opacity-50 bg-n-slate-9/10 text-n-slate-12 hover:enabled:bg-n-slate-9/20 focus-visible:bg-n-slate-9/20 outline-transparent h-8 w-8 p-0 text-sm active:enabled:scale-[0.97] justify-center v-popper--has-tooltip";

            // Специальный стиль для кнопок без автоотправки
            if (cfg.send === false) {
                btn.style.cssText = `
                    background: ${cfg.color || '#4a5568'};
                    color: #f8fafc;
                    font-weight: 600;
                    width: auto;
                    padding: 0 8px;
                    min-width: 32px;
                    border: 0 !important;
                `;
                btn.title = "Только вставляет текст (можно редактировать)";

                // Сохраняем оригинальный цвет для hover эффекта
                const originalColor = cfg.color || '#4a5568';

                // Добавляем hover эффект
                btn.addEventListener('mouseenter', function() {
                    const lightenedColor = lightenColor(originalColor, 20);
                    this.style.background = lightenedColor;
                });

                btn.addEventListener('mouseleave', function() {
                    this.style.background = originalColor;
                });

                btn.addEventListener('mousedown', function() {
                    const darkenedColor = darkenColor(originalColor, 10);
                    this.style.background = darkenedColor;
                });

                btn.addEventListener('mouseup', function() {
                    this.style.background = originalColor;
                });
            }

            btn.addEventListener("click", async () => {
                if (btn.disabled) return;

                // Анимация нажатия
                btn.style.transform = "scale(0.97)";
                setTimeout(() => {
                    btn.style.transform = "";
                }, 100);

                btn.disabled = true;
                setTimeout(() => { btn.disabled = false; }, 1500);

                try {
                    const inputEl = document.querySelector('.reply-box .ProseMirror') ||
                                    document.querySelector('.reply-box textarea');

                    if (!inputEl) return;

                    await insertText(inputEl, cfg.text);

                    if (cfg.send !== false) {
                        const sendBtn = await waitForElement('.reply-box .right-wrap button[type="submit"]');
                        if (sendBtn && !sendBtn.disabled) {
                            setTimeout(() => sendBtn.click(), 100);
                        }
                    } else {
                        log("Текст вставлен (редактируйте перед отправкой)");
                    }

                } catch (e) {
                    console.error("[QuickButtons]: Error", e);
                }
            });

            container.appendChild(btn);
        });

        // Вставляем контейнер перед right-wrap
        rightWrap.parentNode.insertBefore(container, rightWrap);
        return true;
    }

    // Запуск с интервалом
    const interval = setInterval(() => {
        if (createButtons()) clearInterval(interval);
    }, 1000);

    // MutationObserver для динамической подгрузки
    const observer = new MutationObserver(() => {
        createButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();