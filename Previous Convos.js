// ==UserScript==
// @name         Chatwoot - Hide Old Chats
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Показывает только 3 последних чата в списке
// @match        *://app.chatwoot.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Функция для скрытия всех, кроме трёх последних чатов
    function showOnlyLastThree() {
        // Селектор для списка чатов
        const chats = document.querySelectorAll('.contact-conversation--list .conversation');
        
        if (!chats.length) return;

        chats.forEach((chat, index) => {
            // index > 2 = скрываем чаты начиная с 4-го (оставляем первые 3)
            if (index > 2) {
                chat.style.display = 'none';
            } else {
                chat.style.display = '';
            }
        });
    }

    // Наблюдатель за изменениями в DOM
    const observer = new MutationObserver(() => showOnlyLastThree());
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Первоначальный запуск
    setTimeout(showOnlyLastThree, 2000);
})();