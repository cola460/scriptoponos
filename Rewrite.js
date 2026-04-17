// ==UserScript==
// @name         Chatwoot Message Rewriter
// @namespace    http://tampermonkey.net/
// @version      3.8
// @match        https://app.chatwoot.com/*
// @grant        GM_xmlhttpRequest
// @connect      api.deepseek.com
// ==/UserScript==

(function () {
    'use strict';

    const API_KEY = 'sk-4d78b8f8106c4eb4a683d6abcd2efa4a';
    let retryCount = 0;
    const MAX_RETRIES = 10;
    let rewriteBtn = null;
    let alreadyLoggedNotFound = false;
    let buttonAdded = false;

    // Get chat input
    function getChatInput() {
        const input = document.querySelector('.ProseMirror') || document.querySelector('textarea');
        if (!input) return null;
        return input.classList.contains('ProseMirror') ? input.innerText.trim() : input.value.trim();
    }

    // Set chat input
    function setChatInput(text) {
        const input = document.querySelector('.ProseMirror') || document.querySelector('textarea');
        if (!input) return;
        input.focus();
        if (input.classList.contains('ProseMirror')) {
            input.innerHTML = `<p>${escapeHtml(text)}</p>`;
        } else {
            input.value = text;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Show loading animation in button
    function startLoadingAnimation() {
        if (!rewriteBtn) return;
        
        const spinner = document.createElement('span');
        spinner.className = 'rewrite-spinner';
        spinner.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="animation: spin 0.8s linear infinite;"><path d="M12 2a10 10 0 1 0 10 10 10 10 0 0 0-10-10zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" opacity="0.25" fill="currentColor"/><path d="M20 12a8 8 0 0 1-8 8v-2a6 6 0 0 0 6-6h2z" fill="currentColor"/></svg>';
        spinner.style.cssText = 'display: inline-flex; font-size: 14px; margin-right: 4px;';
        
        rewriteBtn.insertBefore(spinner, rewriteBtn.firstChild);
        rewriteBtn.classList.add('loading');
        rewriteBtn.style.opacity = '0.7';
        rewriteBtn.style.cursor = 'wait';
    }

    function stopLoadingAnimation() {
        if (!rewriteBtn) return;
        
        const spinner = rewriteBtn.querySelector('.rewrite-spinner');
        if (spinner) {
            spinner.remove();
        }
        
        rewriteBtn.classList.remove('loading');
        rewriteBtn.style.opacity = '';
        rewriteBtn.style.cursor = '';
    }

    // Paraphrase function
    function paraphraseText() {
        const originalText = getChatInput();
        
        if (!originalText || originalText.length < 3) {
            return;
        }

        startLoadingAnimation();

        const paraphrasePrompt = `You are a professional customer support editor. Rewrite the text below to be clear, natural, and professional. Fix grammar and tone. Keep the same meaning. MAX 3 sentences. DO NOT add new information. Output ONLY the rewritten text, nothing else.

Text: "${originalText}"`;

        GM_xmlhttpRequest({
            method: 'POST',
            url: 'https://api.deepseek.com/v1/chat/completions',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + API_KEY
            },
            data: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: 'You are a text rewriting assistant. Output only the rewritten text, no explanations.' },
                    { role: 'user', content: paraphrasePrompt }
                ],
                temperature: 0.5,
                max_tokens: 200
            }),
            onload: function(res) {
                try {
                    const json = JSON.parse(res.responseText);
                    const rewrittenText = json.choices[0].message.content.trim();
                    setChatInput(rewrittenText);
                } catch (e) {
                    console.error('Rewrite error:', e);
                } finally {
                    stopLoadingAnimation();
                }
            },
            onerror: function() {
                console.error('Network error during rewrite');
                stopLoadingAnimation();
            }
        });
    }

    // Add button
    function addRewriteButton() {
        // If button already added, stop trying
        if (buttonAdded) {
            return;
        }
        
        let leftWrap = document.querySelector('.left-wrap');
        
        if (!leftWrap) {
            const emojiBtn = document.querySelector('button[class*="smiley"]');
            if (emojiBtn && emojiBtn.parentElement) {
                leftWrap = emojiBtn.parentElement;
            }
        }
        
        if (!leftWrap) {
            const toolbar = document.querySelector('[class*="flex justify-between p-3"]');
            if (toolbar) {
                leftWrap = toolbar.querySelector('.left-wrap');
            }
        }
        
        if (!leftWrap) {
            const buttons = document.querySelectorAll('.left-wrap, [class*="left-wrap"]');
            if (buttons.length > 0) {
                leftWrap = buttons[0];
            }
        }
        
        if (!leftWrap) {
            if (retryCount < MAX_RETRIES) {
                retryCount++;
                setTimeout(addRewriteButton, 1000);
            }
            return;
        }
        
        if (leftWrap.querySelector('.ai-rewrite-btn')) {
            buttonAdded = true;
            return;
        }
        
        rewriteBtn = document.createElement('button');
        rewriteBtn.className = 'inline-flex items-center min-w-0 gap-2 transition-all duration-100 ease-out border-0 rounded-lg outline-1 outline disabled:opacity-50 bg-n-slate-9/10 text-n-slate-12 hover:enabled:bg-n-slate-9/20 focus-visible:bg-n-slate-9/20 outline-transparent text-sm active:enabled:scale-[0.97] justify-center v-popper--has-tooltip ai-rewrite-btn';
        rewriteBtn.style.cssText = 'height: 32px; padding: 0 12px; width: auto; min-width: 32px;';
        rewriteBtn.innerHTML = '<span class="rewrite-text">Rewrite</span>';
        rewriteBtn.title = 'Rewrite message with AI (Ctrl+Shift+R)';
        rewriteBtn.onclick = paraphraseText;
        
        const firstBtn = leftWrap.querySelector('button');
        if (firstBtn) {
            leftWrap.insertBefore(rewriteBtn, firstBtn);
        } else {
            leftWrap.appendChild(rewriteBtn);
        }
        
        buttonAdded = true;
        console.log('✅ Rewrite button added');
        
        // Add keyboard shortcut
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                paraphraseText();
            }
        });
    }

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        .ai-rewrite-btn {
            background: rgba(245, 158, 11, 0.15) !important;
            color: #fbbf24 !important;
        }
        
        .ai-rewrite-btn:hover {
            background: rgba(245, 158, 11, 0.3) !important;
            transform: scale(0.97);
        }
        
        .ai-rewrite-btn span {
            display: inline-flex;
            align-items: center;
        }
        
        .rewrite-spinner svg {
            display: block;
        }
    `;
    document.head.appendChild(style);
    
    // Initialize
    setTimeout(addRewriteButton, 2000);
    setTimeout(addRewriteButton, 5000);
    setTimeout(addRewriteButton, 10000);
    
    // Watch for page changes
    let debounceTimer;
    const observer = new MutationObserver(function() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (!document.querySelector('.ai-rewrite-btn')) {
                buttonAdded = false;
                addRewriteButton();
            }
        }, 500);
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
})();