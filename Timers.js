// ==UserScript==
// @name         Chatwoot Timer Styler
// @namespace    http://tampermonkey.net/
// @version      3.4
// @description  Удаляет первую часть таймера, увеличенный шрифт, цвета
// @match        *://app.chatwoot.com/*
// @grant        GM_addStyle
// @license MIT
// ==/UserScript==

(function() {
    'use strict';

    const GRAY = '#90949e';
    const YELLOW = '#f77d08';
    const RED = '#c51521';
    const FONT_SIZE = '1.4em';  // ← МЕНЯЙ ЗДЕСЬ РАЗМЕР (1em = стандартный, 1.4em = +40%)

    function getWaitMinutes(text) {
        if (!text || !text.includes('•')) return null;
        const parts = text.split('•');
        if (parts.length < 2) return null;

        const secondPart = parts[1].trim();
        if (/[hd]/i.test(secondPart)) return null;

        const match = secondPart.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : null;
    }

    function getColor(minutes) {
        if (minutes === null) return null;
        if (minutes >= 10) return RED;
        if (minutes >= 5) return YELLOW;
        return GRAY;
    }

    function getSecondPart(text) {
        const parts = text.split('•');
        return parts.length > 1 ? parts[1].trim() : null;
    }

    function processTimer(span) {
        const fullText = span.textContent || '';

        if (!fullText.includes('•')) return;
        if (/[0-9a-f]{8}-/i.test(fullText) || /@/.test(fullText)) return;
        if (span.closest('[data-bubble-name="activity"]')) return;

        const secondPart = getSecondPart(fullText);
        if (!secondPart) return;

        if (span.textContent !== secondPart) {
            span.textContent = secondPart;
        }

        const minutes = getWaitMinutes(fullText);
        const color = getColor(minutes);

        span.style.fontWeight = 'bold';
        span.style.fontSize = FONT_SIZE;  // ← увеличенный размер
        span.style.display = 'inline-block';

        if (color) {
            span.style.color = color;
        } else {
            span.style.color = '';
        }
    }

    function processAllTimers() {
        const timeSpans = document.querySelectorAll(
            '.ml-auto.font-normal.leading-4.text-xxs span, ' +
            '.ml-auto.leading-4.text-xxs span, ' +
            '.absolute.flex.flex-col span.ml-auto span'
        );

        timeSpans.forEach(processTimer);

        document.querySelectorAll('span').forEach(span => {
            const text = span.textContent || '';
            if (text.includes('•') && /\d+[dhm]\s*•/.test(text)) {
                processTimer(span);
            }
        });
    }

    let updateTimeout;

    function observeTimers() {
        const observer = new MutationObserver(() => {
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
                processAllTimers();
            }, 100);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    observeTimers();
    setTimeout(processAllTimers, 500);
    processAllTimers();
    setInterval(processAllTimers, 3000);

    console.log('[Timer] Загружен, размер шрифта:', FONT_SIZE);
})();