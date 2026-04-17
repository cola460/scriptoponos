// ==UserScript==
// @name         Hide Agent Info & Position Elements (No Layout Shift)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Скрывает элементы без смещения макета
// @match        *://app.chatwoot.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ========== 1. Скрытие информации об агенте (без смещения) ==========
    function hideAgentInfo() {
        const selectors = [
            '.flex.items-center.min-w-0.gap-1.ltr\\:ml-2.rtl\\:mr-2',
            'div.flex.items-center.min-w-0.gap-1',
            '[class*="agent-info"]',
            '[class*="operator-info"]'
        ];

        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                const text = el.textContent || '';
                if (text.includes('4rabet') ||
                    text.includes('Ishaan') ||
                    text.includes('Raj Kumar') ||
                    el.querySelector('span.i-woot-website') ||
                    el.querySelector('[class*="text-n-slate-11"]')) {

                    // Вместо display: none используем visibility: hidden + сохраняем размеры
                    el.style.visibility = 'hidden';
                    el.style.opacity = '0';
                    // Сохраняем занимаемое место
                    el.style.display = 'flex'; // или оставляем как есть
                    el.style.pointerEvents = 'none'; // чтобы нельзя было кликнуть
                }
            });
        });
    }

    // ========== 2. Скрытие элементов по позиционированию (без смещения) ==========
    function hideElementByPosition() {
        const elements = document.querySelectorAll('div.absolute');

        elements.forEach(element => {
            const styles = window.getComputedStyle(element);
            const top = styles.getPropertyValue('top');

            if ((top === '9rem' || top === '144px' ||
                 element.classList.contains('top-36') ||
                 element.classList.contains('xl:top-24')) &&
                (element.classList.contains('rounded-full') ||
                 element.querySelector('button.rounded-full'))) {

                // Для абсолютно позиционированных элементов можно использовать visibility
                element.style.visibility = 'hidden';
                element.style.opacity = '0';
                element.style.pointerEvents = 'none';

                console.log('[HideScript] Элемент скрыт без смещения');
            }
        });
    }

    // ========== Запуск ==========

    hideAgentInfo();
    hideElementByPosition();

    setInterval(hideAgentInfo, 3000);

    const positionInterval = setInterval(() => {
        hideElementByPosition();
    }, 500);

    setTimeout(() => {
        clearInterval(positionInterval);
        console.log('[HideScript] Остановлена проверка позиций');
    }, 10000);

    const observer = new MutationObserver(() => {
        hideAgentInfo();
        hideElementByPosition();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('[HideScript] Скрипт скрытия элементов (без смещения) запущен');
})();