// ==UserScript==
// @name         Chatwoot Resolved Counter
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Счётчик закрытых чатов (Resolve) за сегодня по Московскому времени
// @match        *://app.chatwoot.com/*
// @grant        none
// @license MIT
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'chatwoot_resolve_count';
    const STORAGE_DATE_KEY = 'chatwoot_resolve_date';
    let statVisible = false;

    // Получение текущей даты по Московскому времени
    function getMoscowDate() {
        const date = new Date();
        const moscowOffset = 3 * 60; // Москва UTC+3
        const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
        const moscowTime = new Date(utc + moscowOffset * 60000);
        return moscowTime.toISOString().split('T')[0];
    }

    // Инициализация счётчика (сброс при смене дня)
    function initCounter() {
        const today = getMoscowDate();
        const savedDate = localStorage.getItem(STORAGE_DATE_KEY);
        if (savedDate !== today) {
            localStorage.setItem(STORAGE_KEY, '0');
            localStorage.setItem(STORAGE_DATE_KEY, today);
        }
    }

    // Получение текущего значения счётчика
    function getCount() {
        return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    }

    // Увеличение счётчика
    function incrementCount() {
        const count = getCount() + 1;
        localStorage.setItem(STORAGE_KEY, count.toString());
        updateCounterUI();
        console.log(`✅ Чат закрыт! Всего за сегодня: ${count}`);
    }

    let statLi;
    let statDiv;

    // Создание вкладки "Resolved" в навигации
    function createStatTab() {
        const tabsUl = document.querySelector('div[is-compact] ul');
        if (!tabsUl || statLi) return;

        statLi = document.createElement('li');
        statLi.className = 'flex-shrink-0 my-0 mx-2 ltr:first:ml-0 rtl:first:mr-0 ltr:last:mr-0 rtl:last:ml-0 hover:text-n-slate-12 text-sm [&_a]:font-medium';

        const statLink = document.createElement('a');
        statLink.className = 'flex items-center flex-row select-none cursor-pointer relative after:absolute after:bottom-px after:left-0 after:right-0 after:h-[2px] after:rounded-full after:transition-all after:duration-200 text-button text-n-slate-11 after:bg-transparent after:opacity-0 py-2.5';

        const textNode = document.createElement('span');
        textNode.textContent = 'Resolved';
        textNode.style.userSelect = 'none';

        const counterDiv = document.createElement('div');
        // Используем указанный класс без дополнительных inline стилей
        counterDiv.className = 'rounded-full h-5 flex items-center justify-center text-xs font-medium my-0 ltr:ml-1 rtl:mr-1 px-1.5 py-0 min-w-[20px] bg-n-alpha-1 text-n-slate-10';

        const numberSpan = document.createElement('span');
        numberSpan.textContent = getCount();

        counterDiv.appendChild(numberSpan);
        statDiv = counterDiv;

        // Изначально скрыто (неактивная вкладка)
        counterDiv.style.display = 'none';
        statVisible = false;

        // Обработчик клика по вкладке
        statLink.addEventListener('click', (e) => {
            e.preventDefault();
            statVisible = !statVisible;

            if (statVisible) {
                // Активная вкладка
                counterDiv.style.display = 'flex';
                statLink.classList.add('text-n-blue-11', 'after:bg-n-brand', 'after:opacity-100');
                statLink.classList.remove('text-n-slate-11', 'after:bg-transparent', 'after:opacity-0');
                counterDiv.classList.remove('bg-n-alpha-1', 'text-n-slate-10');
                counterDiv.classList.add('bg-n-blue-3', 'text-n-blue-11');
            } else {
                // Неактивная вкладка
                counterDiv.style.display = 'none';
                statLink.classList.remove('text-n-blue-11', 'after:bg-n-brand', 'after:opacity-100');
                statLink.classList.add('text-n-slate-11', 'after:bg-transparent', 'after:opacity-0');
                counterDiv.classList.remove('bg-n-blue-3', 'text-n-blue-11');
                counterDiv.classList.add('bg-n-alpha-1', 'text-n-slate-10');
            }
        });

        statLink.appendChild(textNode);
        statLink.appendChild(counterDiv);
        statLi.appendChild(statLink);
        tabsUl.appendChild(statLi);
    }

    // Обновление UI счётчика
    function updateCounterUI() {
        if (!statDiv) return;
        const span = statDiv.querySelector('span');
        if (span) {
            span.textContent = getCount();
        }
    }

    // Сброс при смене дня
    function resetIfNewDay() {
        const today = getMoscowDate();
        const savedDate = localStorage.getItem(STORAGE_DATE_KEY);
        if (savedDate !== today) {
            localStorage.setItem(STORAGE_KEY, '0');
            localStorage.setItem(STORAGE_DATE_KEY, today);
            updateCounterUI();
        }
    }

    // Отслеживание кнопок "Resolve"
    function attachResolveListeners() {
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
            const span = btn.querySelector('span');
            if (span && span.textContent.trim() === 'Resolve' && !btn.dataset.listener) {
                btn.dataset.listener = 'true';
                btn.addEventListener('click', incrementCount);
            }
        });
    }

    // MutationObserver для отслеживания появления новых кнопок и вкладок
    const observer = new MutationObserver(() => {
        attachResolveListeners();
        resetIfNewDay();
        createStatTab();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Инициализация
    initCounter();
    attachResolveListeners();
    createStatTab();
    updateCounterUI();

    console.log('✅ Resolved Counter запущен! Счётчик обнуляется каждый день в 00:00 по Москве');

})();