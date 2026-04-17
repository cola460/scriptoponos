// ==UserScript==
// @name         Clickable UUID & Notes
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Клик по UUID копирует, клик по заметке открывает редактирование + курсор-пальчик
// @match        *://app.chatwoot.com/*
// @grant        GM_addStyle
// @license MIT
// ==/UserScript==

(function() {
    'use strict';

    // ========== Стили для курсора-пальчика на заметках ==========
    GM_addStyle(`
        div.flex.group.is-editable > p {
            cursor: pointer !important;
        }
        .tm-uuid-copied {
            color: green !important;
            transition: color 0.2s ease;
        }
    `);

    // ========== Копирование с визуальной обратной связью ==========
    async function copyWithFeedback(element, text) {
        try {
            await navigator.clipboard.writeText(text);
            element.classList.remove('tm-uuid-copied');
            element.classList.add('tm-uuid-copied');
            setTimeout(() => {
                element.classList.remove('tm-uuid-copied');
            }, 1000);
            return true;
        } catch (err) {
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                const success = document.execCommand('copy');
                document.body.removeChild(textarea);
                
                if (success) {
                    element.classList.add('tm-uuid-copied');
                    setTimeout(() => {
                        element.classList.remove('tm-uuid-copied');
                    }, 1000);
                } else {
                    throw new Error('execCommand failed');
                }
            } catch (fallbackErr) {
                console.warn('Copy failed:', fallbackErr);
                element.style.setProperty('color', 'red', 'important');
                setTimeout(() => {
                    element.style.removeProperty('color');
                }, 1000);
            }
        }
    }

    // ========== Кликабельные UUID ==========
    function makeUUIDClickable() {
        const uuids = document.querySelectorAll('span.overflow-hidden.text-sm.whitespace-nowrap.text-ellipsis');
        
        uuids.forEach(span => {
            if (span.classList.contains('tm-uuid-processed')) return;
            
            span.classList.add('tm-uuid-processed');
            span.style.cursor = 'pointer';
            
            const clickHandler = () => {
                const text = span.textContent.trim();
                if (text) {
                    copyWithFeedback(span, text);
                }
            };
            
            span.addEventListener('click', clickHandler);
            span._tmClickHandler = clickHandler;
        });
    }

    // ========== Кликабельные Notes (заметки) ==========
    function makeNotesClickable() {
        const notes = document.querySelectorAll('div.flex.group.is-editable > p');
        
        notes.forEach(p => {
            if (p.dataset.tmClickable) return;
            
            p.dataset.tmClickable = '1';
            
            if (p.textContent.trim() === '---') {
                p.textContent = '-----';
            }
            
            p.addEventListener('click', (e) => {
                e.stopPropagation();
                const btn = p.parentElement.querySelector('button');
                if (btn) {
                    btn.click();
                }
            });
        });
    }

    // ========== Запуск с задержкой для полной загрузки DOM ==========
    function init() {
        makeUUIDClickable();
        makeNotesClickable();
    }

    // Первый запуск
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ========== Наблюдатель за изменениями в DOM (оптимизированный) ==========
    const observer = new MutationObserver((mutations) => {
        let needsUpdate = false;
        
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                needsUpdate = true;
                break;
            }
        }
        
        if (needsUpdate) {
            requestAnimationFrame(() => {
                makeUUIDClickable();
                makeNotesClickable();
            });
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    window.addEventListener('beforeunload', () => {
        observer.disconnect();
    });
})();