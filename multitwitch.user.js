// ==UserScript==
// @name         Multitwitch
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Enhanced Multitwitch.tv experience
// @author       Blake Becker
// @match        https://www.multitwitch.tv/*
// @match        https://twitch.tv/embed/*/chat*
// @match        https://www.twitch.tv/embed/*/chat*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=multitwitch.tv
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Runs inside Twitch chat embeds to remove community highlight panels
    function initTwitchChatCleaner() {
        // Defensive: only in twitch embed chat
        const isTwitch = /(^|\.)twitch\.tv$/.test(location.hostname);
        if (!isTwitch) return false;
        if (!location.pathname.includes('/embed/') || !location.pathname.includes('/chat')) return false;

    const STORE_KEY = 'mtw_block_community_highlights';
    const STORE_KEY_LB = 'mtw_block_leaderboard';
    const getPref = () => localStorage.getItem(STORE_KEY) !== 'false'; // default ON
    const setPref = (val) => localStorage.setItem(STORE_KEY, String(!!val));
    const getPrefLB = () => localStorage.getItem(STORE_KEY_LB) !== 'false'; // default ON
    const setPrefLB = (val) => localStorage.setItem(STORE_KEY_LB, String(!!val));

        // CSS for hiding highlights
        const styleId = 'mtw-hide-community-highlight';
        function ensureStyle(enabled) {
            let style = document.getElementById(styleId);
            if (!enabled) {
                if (style) style.remove();
                return;
            }
            if (!style) {
                style = document.createElement('style');
                style.id = styleId;
                document.head.appendChild(style);
            }
            style.textContent = `
                .community-highlight,
                [class*="community-highlight-stack"],
                .community-highlight-stack__scroll-area--disable,
                .community-highlight-stack__scroll-content--disable,
                /* Also hide Twitch core error popovers/banners that appear in chat area */
                .core-error,
                [class*="core-error__container"],
                [data-a-target="core-error-message"] { display: none !important; }
            `;
        }
        const styleIdLB = 'mtw-hide-leaderboard';
        function ensureStyleLB(enabled) {
            let style = document.getElementById(styleIdLB);
            if (!enabled) {
                if (style) style.remove();
                return;
            }
            if (!style) {
                style = document.createElement('style');
                style.id = styleIdLB;
                document.head.appendChild(style);
            }
            style.textContent = `
                        const wrap = document.createElement('div');
                        wrap.style.flex = '0 0 auto';
                        wrap.style.display = 'flex';
                        wrap.style.alignItems = 'center';
                        wrap.style.height = '24px';
                        wrap.style.background = '#2a2a2a';
                        wrap.style.borderRadius = '4px';
                        wrap.style.padding = '0 6px';
                        wrap.style.boxSizing = 'border-box';
            `;
        }

        // Purge function
        function purge(root) {
            const nodes = (root || document).querySelectorAll(
                '.community-highlight, [class*="community-highlight-stack"], .community-highlight-stack__scroll-area--disable, .community-highlight-stack__scroll-content--disable, .core-error, [class*="core-error__container"], [data-a-target="core-error-message"]'
            );
            nodes.forEach(n => n.remove());
        }
        function purgeLB(root) {
            const nodes = (root || document).querySelectorAll(
                '[class*="channel-leaderboard"], [class*="leaderboard"], [aria-label*="Leaderboard"], [data-test-selector*="leaderboard"], .marquee-animation, .marquee-animation__original, .marquee-animation__wrap-view, button[aria-label="Previous leaderboard set"], button[aria-label="Next leaderboard set"]'
            );
            nodes.forEach(n => {
                let target = n;
                if (n.closest) {
                    const ancestor = n.closest('button, [role="button"], .tw-interactable, [class*="Interactable"], [class*="interactable"], [class*="channel-leaderboard"], [class*="leaderboard"]');
                    if (ancestor) target = ancestor;
                }
                try { target.remove(); } catch {}
            });
        }

        // Apply current preference
        function applyPref() {
            const on = getPref();
            const onLB = getPrefLB();
            ensureStyle(on);
            ensureStyleLB(onLB);
            if (on) purge(document);
            if (onLB) purgeLB(document);
        }
        applyPref();

        // Observe for dynamically inserted highlights and purge if enabled
        const mo = new MutationObserver(mutations => {
            const chOn = getPref();
            const lbOn = getPrefLB();
            if (!chOn && !lbOn) return;
            for (const m of mutations) {
                if (m.type === 'childList') {
                    m.addedNodes.forEach(node => {
                        if (!(node instanceof Element)) return;
                        if (chOn) purge(node);
                        if (lbOn) purgeLB(node);
                    });
                }
            }
        });
        mo.observe(document.body || document.documentElement, { childList: true, subtree: true });

        // Insert a small config button in the chat header (top-left area)
        function insertConfigButton() {
            // Find the chat header container heuristically
            const labelEl = document.querySelector('[data-test-selector="chat-room-header-label"]');
            const header = labelEl?.closest('[role="region"], .stream-chat-header');
            if (!header) return;

            if (document.getElementById('mtw-config-btn')) return;
            const btn = document.createElement('button');
            btn.id = 'mtw-config-btn';
            btn.setAttribute('aria-label', 'MultiTwitch config');
            btn.title = '';
            btn.style.border = 'none';
            btn.style.background = 'transparent';
            btn.style.cursor = 'pointer';
            btn.style.padding = '4px';
            btn.style.display = 'inline-flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.width = '28px';
            btn.style.height = '28px';
            btn.style.position = 'absolute';
            btn.style.left = '8px';
            btn.style.top = '8px';
            btn.style.zIndex = '5';
            btn.style.borderRadius = '6px';
            // Simple, recognizable gear icon (text)
            btn.innerHTML = '<span style="font-size:16px; line-height:1">⚙</span>';
            // Anchor button to header top-left separate from the title
            if (getComputedStyle(header).position === 'static') {
                header.style.position = 'relative';
            }
            header.appendChild(btn);
            // Create space so the title doesn't collide with the fixed-left button
            const computedPad = parseInt(getComputedStyle(header).paddingLeft || '0', 10);
            if (isNaN(computedPad) || computedPad < 36) {
                header.style.paddingLeft = '36px';
            }

            // Hover style like Twitch rounded square
            btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,255,255,0.08)'; });
            btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });

            // Custom tooltip
            let tooltip;
            function showTooltip() {
                if (tooltip) return;
                tooltip = document.createElement('div');
                tooltip.textContent = 'Settings';
                tooltip.style.position = 'absolute';
                tooltip.style.background = '#18181b';
                tooltip.style.color = '#fff';
                tooltip.style.fontSize = '12px';
                tooltip.style.padding = '6px 8px';
                tooltip.style.border = '1px solid #3a3a3a';
                tooltip.style.borderRadius = '6px';
                tooltip.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
                tooltip.style.whiteSpace = 'nowrap';
                tooltip.style.zIndex = '6';
                // Position just below the button
                const r = btn.getBoundingClientRect();
                const hr = header.getBoundingClientRect();
                tooltip.style.left = (r.left - hr.left) + 'px';
                tooltip.style.top = (r.bottom - hr.top + 6) + 'px';
                header.appendChild(tooltip);
            }
            function hideTooltip() { if (tooltip) { tooltip.remove(); tooltip = null; } }
            btn.addEventListener('mouseenter', showTooltip);
            btn.addEventListener('mouseleave', hideTooltip);
            btn.addEventListener('click', (e) => { hideTooltip(); openConfigModal(); });
        }

        // Inject minimal CSS to match Twitch-like toggle and popover styling
        function ensureConfigCSS() {
            const id = 'mtw-config-css';
            if (document.getElementById(id)) return;
            const style = document.createElement('style');
            style.id = id;
            style.textContent = `
                /* Popover container */
                .mtw-popover {
                    background: #18181b;
                    color: #fff;
                    border: 1px solid #3a3a3a;
                    border-radius: 8px;
                    min-width: 280px;
                    max-width: min(90vw, 360px);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.6);
                    padding: 12px 12px 10px;
                }
                .mtw-popover__title {
                    font-weight: 700;
                    margin: 0 0 8px 0;
                    font-size: 14px;
                }
                .mtw-popover__close {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    width: 28px; height: 28px;
                    border: 0; background: transparent; color: #e6e6e6;
                    border-radius: 6px; cursor: pointer;
                }
                .mtw-popover__close:hover { background: rgba(255,255,255,0.08); }
                .mtw-grid {
                    display: grid;
                    grid-template-columns: 1fr auto;
                    align-items: center;
                    row-gap: 12px;
                    column-gap: 16px;
                    margin-bottom: 10px;
                }
                .mtw-label { font-size: 13px; }
                .mtw-actions {
                    display: flex; justify-content: center; gap: 8px;
                }
                .mtw-btn { padding: 6px 12px; border: none; border-radius: 4px; color: #fff; cursor: pointer; }
                .mtw-btn--primary { background: #772ce8; }
                .mtw-btn--secondary { background: #404040; }
                /* Scoped Twitch-like toggle switch using pseudo elements */
                #mtw-config-panel .tw-toggle { position: relative; width: 44px; height: 24px; border-radius: 12px; background: #3a3a3a; }
                #mtw-config-panel .tw-toggle__input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
                #mtw-config-panel .tw-toggle__button { position: absolute; inset: 0; border-radius: 12px; pointer-events: none; }
                #mtw-config-panel .tw-toggle__button::before { content: ""; position: absolute; inset: 0; border-radius: 12px; background: #772ce8; opacity: 0; transition: opacity 180ms ease; }
                #mtw-config-panel .tw-toggle__button::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; background: #fff; border-radius: 50%; transition: left 180ms ease; }
                /* ON state: show purple track overlay and move knob right */
                #mtw-config-panel .tw-toggle__input:checked + .tw-toggle__button::before { background: #772ce8; opacity: 1; }
                #mtw-config-panel .tw-toggle__input:checked + .tw-toggle__button::after { left: 23px; }
                /* Focus ring (optional, subtle) */
                #mtw-config-panel .tw-toggle__input:focus-visible + .tw-toggle__button::before { box-shadow: 0 0 0 2px rgba(255,255,255,0.18) inset; opacity: 1; }
                /* Suggestions dropdown */
                .mtw-suggest {
                    position: fixed;
                    background: #1f1f23;
                    color: #fff;
                    border: 1px solid #3a3a3a;
                    border-radius: 6px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    z-index: 2147483000;
                    padding: 4px 0;
                    min-width: 140px;
                    max-height: 220px;
                    overflow-y: auto;
                }
                .mtw-suggest__item {
                    display: flex; align-items: center; justify-content: space-between;
                    gap: 8px;
                    padding: 6px 8px;
                    font-size: 12px;
                    cursor: pointer;
                }
                .mtw-suggest__item:hover { background: rgba(255,255,255,0.08); }
                .mtw-suggest__item--active { background: rgba(119,44,232,0.25); }
                .mtw-suggest__text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .mtw-suggest__remove { opacity: 0; color: #ccc; border: none; background: transparent; cursor: pointer; font-size: 12px; }
                .mtw-suggest__item:hover .mtw-suggest__remove { opacity: 1; }
            `;
            document.head.appendChild(style);
        }

        // Simple modal for config
        function openConfigModal() {
            if (document.getElementById('mtw-config-modal')) return;
            ensureConfigCSS();

            // Transparent overlay just for outside-click capture
            const overlay = document.createElement('div');
            overlay.id = 'mtw-config-modal';
            overlay.style.position = 'fixed';
            overlay.style.inset = '0';
            overlay.style.background = 'transparent'; // no grayed background
            overlay.style.zIndex = '9999';
            overlay.style.display = 'block';

            // Popover panel anchored near the gear button
            const panel = document.createElement('div');
            panel.className = 'mtw-popover';
            panel.id = 'mtw-config-panel';
            panel.style.position = 'absolute';
            // Anchor by gear position
            const anchor = document.getElementById('mtw-config-btn');
            const ar = anchor ? anchor.getBoundingClientRect() : { left: 12, bottom: 56 };
            const top = (ar.bottom + 8);
            const left = Math.max(8, ar.left);
            panel.style.top = top + 'px';
            panel.style.left = left + 'px';

            const title = document.createElement('div');
            title.className = 'mtw-popover__title';
            title.textContent = 'MultiTwitch Settings';

            const closeBtn = document.createElement('button');
            closeBtn.className = 'mtw-popover__close';
            closeBtn.setAttribute('aria-label', 'Close');
            closeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M8.5 10 4 5.5 5.5 4 10 8.5 14.5 4 16 5.5 11.5 10l4.5 4.5-1.5 1.5-4.5-4.5L5.5 16 4 14.5 8.5 10z" fill="currentColor"></path></svg>';

            const optsGrid = document.createElement('div');
            optsGrid.className = 'mtw-grid';

            // Row 1: Block community highlights
            const label1 = document.createElement('span');
            label1.className = 'mtw-label';
            label1.textContent = 'Block community highlights';
            const toggle1 = document.createElement('div');
            toggle1.className = 'tw-toggle';
            const input1 = document.createElement('input');
            input1.type = 'checkbox';
            input1.className = 'tw-toggle__input';
            input1.checked = getPref();
            const btn1 = document.createElement('div');
            btn1.className = 'tw-toggle__button';
            toggle1.appendChild(input1);
            toggle1.appendChild(btn1);
            optsGrid.appendChild(label1);
            optsGrid.appendChild(toggle1);

            // Row 2: Block channel leaderboard
            const label2 = document.createElement('span');
            label2.className = 'mtw-label';
            label2.textContent = 'Block channel leaderboard';
            const toggle2 = document.createElement('div');
            toggle2.className = 'tw-toggle';
            const input2 = document.createElement('input');
            input2.type = 'checkbox';
            input2.className = 'tw-toggle__input';
            input2.checked = getPrefLB();
            const btn2 = document.createElement('div');
            btn2.className = 'tw-toggle__button';
            toggle2.appendChild(input2);
            toggle2.appendChild(btn2);
            optsGrid.appendChild(label2);
            optsGrid.appendChild(toggle2);

            const actions = document.createElement('div');
            actions.className = 'mtw-actions';
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'mtw-btn mtw-btn--secondary';
            cancelBtn.textContent = 'Cancel';
            const saveBtn = document.createElement('button');
            saveBtn.className = 'mtw-btn mtw-btn--primary';
            saveBtn.textContent = 'Save';
            actions.appendChild(cancelBtn);
            actions.appendChild(saveBtn);

            panel.appendChild(title);
            panel.appendChild(closeBtn);
            panel.appendChild(optsGrid);
            panel.appendChild(actions);
            overlay.appendChild(panel);
            document.body.appendChild(overlay);

            function close() { overlay.remove(); }
            cancelBtn.addEventListener('click', close);
            closeBtn.addEventListener('click', close);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
            // Prevent clicks inside panel from bubbling to overlay
            panel.addEventListener('click', (e) => e.stopPropagation());
            // Persist on save
            saveBtn.addEventListener('click', () => {
                setPref(!!input1.checked);
                setPrefLB(!!input2.checked);
                applyPref();
                close();
            });
        }

        // Try inserting the config button now and also after header changes
        insertConfigButton();
        const headerObserver = new MutationObserver(insertConfigButton);
        headerObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });

        return true;
    }

    function interceptStreamIframes() {
        let firstStreamProcessed = false;
        let firstStreamIframe = null;

        // Observer to catch iframes as they're added to the DOM
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node instanceof HTMLIFrameElement && node.classList.contains('stream') && !firstStreamProcessed) {
                            // This is the first stream iframe being added
                            const src = node.getAttribute('src');
                            console.log('MultiTwitch: Found first stream iframe, original src:', src);
                            if (src && src.includes('muted=true')) {
                                const newSrc = src.replace('muted=true', 'muted=false');
                                node.setAttribute('src', newSrc);
                                firstStreamProcessed = true;
                                firstStreamIframe = node;
                                console.log('MultiTwitch: Changed src to:', newSrc);

                                // Try to unmute via postMessage after the iframe loads
                                node.addEventListener('load', () => {
                                    console.log('MultiTwitch: First stream iframe loaded, attempting to unmute via postMessage');
                                    tryUnmuteViaPostMessage(node);
                                });
                            }
                        }
                    });
                }
            }
        });

        // Start observing the document for added iframes
        const streamsDiv = document.getElementById('streams');
        if (streamsDiv) {
            observer.observe(streamsDiv, { childList: true, subtree: true });
            console.log('MultiTwitch: Observing #streams for iframes');
        } else {
            // If streams div doesn't exist yet, observe the whole document
            observer.observe(document.documentElement, { childList: true, subtree: true });
            console.log('MultiTwitch: Observing document for iframes');
        }

        // Also check if any stream iframes already exist (in case we're late)
        const existingStreams = document.querySelectorAll('iframe.stream');
        console.log('MultiTwitch: Found', existingStreams.length, 'existing stream iframes');
        if (existingStreams.length > 0 && !firstStreamProcessed) {
            const firstStream = existingStreams[0];
            const src = firstStream.getAttribute('src');
            console.log('MultiTwitch: First existing stream src:', src);
            if (src && src.includes('muted=true')) {
                const newSrc = src.replace('muted=true', 'muted=false');
                firstStream.setAttribute('src', newSrc);
                firstStreamProcessed = true;
                firstStreamIframe = firstStream;
                console.log('MultiTwitch: Changed existing stream src to:', newSrc);

                // Try to unmute via postMessage
                setTimeout(() => tryUnmuteViaPostMessage(firstStream), 1000);
            }
        }

        return true;
    }

    function tryUnmuteViaPostMessage(iframe) {
        if (!iframe || !iframe.contentWindow) {
            console.log('MultiTwitch: Cannot access iframe contentWindow');
            return;
        }

        // Try multiple approaches to unmute
        const attempts = [
            { eventName: 'setMuted', params: false },
            { eventName: 'setVolume', params: 0.5 },
        ];

        attempts.forEach((attempt, index) => {
            setTimeout(() => {
                try {
                    const message = JSON.stringify(attempt);
                    iframe.contentWindow.postMessage(message, 'https://player.twitch.tv');
                    console.log('MultiTwitch: Sent postMessage attempt', index + 1, ':', message);
                } catch (e) {
                    console.log('MultiTwitch: postMessage error:', e);
                }
            }, index * 500);
        });
    }

    function initTabSelector() {
        const tablist = document.getElementById('tablist');
        const bottomRightBar = document.getElementById('bottom_right_bar');

        if (tablist && bottomRightBar) {
            const chatbox = document.getElementById('chatbox');
            const SELECTED = '#772ce8'; // active tab color

            const originalTabs = tablist.querySelectorAll('li a');
            const streamerNames = Array.from(originalTabs).map(tab => {
                const href = tab.getAttribute('href');
                return href ? href.replace('#chat-', '') : '';
            }).filter(name => name);

            // Ensure suggestions CSS available on this host
            (function ensureSuggestCSS(){
                const id = 'mtw-suggest-css';
                if (document.getElementById(id)) return;
                const style = document.createElement('style');
                style.id = id;
                style.textContent = `
                    .mtw-suggest { position: fixed; background: #1f1f23; color: #fff; border: 1px solid #3a3a3a; border-radius: 6px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 2147483000; padding: 4px 0; min-width: 140px; max-height: 220px; overflow-y: auto; }
                    .mtw-suggest__item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 8px; font-size: 12px; cursor: pointer; }
                    .mtw-suggest__item:hover { background: rgba(255,255,255,0.08); }
                    .mtw-suggest__text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                    .mtw-suggest__remove { opacity: 0; color: #ccc; border: none; background: transparent; cursor: pointer; font-size: 12px; }
                    .mtw-suggest__item:hover .mtw-suggest__remove { opacity: 1; }
                `;
                document.head.appendChild(style);
            })();

            const customTabSelector = document.createElement('div');
            customTabSelector.id = 'custom-tab-selector';
            // Base styling
            customTabSelector.style.background = '#18181b';
            customTabSelector.style.border = '1px solid #464646ff';
            customTabSelector.style.borderRadius = '4px';
            // Small vertical padding; remove left/right padding to maximize viewport width
            customTabSelector.style.padding = '4px 0';
            customTabSelector.style.display = 'flex';
            // Eliminate global gap so right arrow sits flush; we'll add space only after the left arrow
            customTabSelector.style.gap = '0px';
            customTabSelector.style.boxSizing = 'border-box';
            customTabSelector.style.alignItems = 'stretch';
            // Flow directly under chatbox, align right, and handle floats
            customTabSelector.style.position = 'relative';
            customTabSelector.style.float = 'right';
            customTabSelector.style.clear = 'right';
            customTabSelector.style.marginRight = '0';

            if (chatbox) {
                chatbox.parentNode.insertBefore(customTabSelector, chatbox.nextSibling);
            }

            // Inject CSS to ensure panels/iframes fill chat height even if site sets inline px heights
            (function injectCSS(){
                const id = 'cts-fill-chat-css';
                if (document.getElementById(id)) return;
                const style = document.createElement('style');
                style.id = id;
                style.textContent = `
                    #chatbox, #chatbox.ui-widget-content { padding: 0 !important; box-sizing: border-box !important; }
                    #chatbox .ui-tabs-panel, #chatbox .stream_chat { height: 100% !important; padding: 0 !important; margin: 0 !important; box-sizing: border-box !important; }
                    #chatbox .ui-tabs-panel > iframe, #chatbox iframe { height: 100% !important; max-height: 100% !important; min-height: 0 !important; display: block !important; }
                `;
                document.head.appendChild(style);
            })();

            // Helper to sync width to chatbox (accounts for zoom/resizes)
            function syncWidth() {
                if (!chatbox) return;
                const width = chatbox.offsetWidth; // includes borders, excludes margin
                if (width > 0) {
                    customTabSelector.style.width = width + 'px';
                }
            }
            syncWidth();

            // Adjust chatbox height to fill viewport minus selector height
            function adjustChatHeight() {
                if (!chatbox) return;
                const vp = window.innerHeight || document.documentElement.clientHeight;
                const chatRect = chatbox.getBoundingClientRect();
                const selectorH = customTabSelector.offsetHeight || 0;
                const bottomGap = 0; // remove extra gap to avoid background line
                let available = Math.floor(vp - chatRect.top - selectorH - bottomGap);
                if (!Number.isFinite(available)) return;
                available = Math.max(200, available); // clamp to a sensible minimum
                chatbox.style.height = available + 'px';
                chatbox.style.padding = '0';
                chatbox.style.boxSizing = 'border-box';
                // Ensure panels/iframes fill the chatbox height
                chatbox.querySelectorAll('.stream_chat, .ui-tabs-panel').forEach(p => {
                    p.style.height = '100%';
                    p.style.boxSizing = 'border-box';
                    p.style.margin = '0';
                    p.style.padding = '0';
                });
                chatbox.querySelectorAll('iframe').forEach(f => {
                    f.style.height = '100%';
                    f.style.maxHeight = '100%';
                    f.style.minHeight = '0';
                    f.style.display = 'block';
                });
            }

            // Seed history from current URL and tablist so suggestions are populated immediately
            (function seedHistoryFromUrl(){
                const parts = (location.pathname.split('/').filter(Boolean) || []).map(sanitizeChannelName).filter(Boolean);
                parts.forEach(addToHistory);
                // Also seed from tablist-derived names as a fallback
                try { streamerNames.forEach(addToHistory); } catch {}
            })();

            // Create carousel structure: viewport (with track); arrows and fades are absolutely positioned within viewport
            const ARROW_W = 20; // arrow button width
            const FADE_W = 20; // fade gradient width
            const viewport = document.createElement('div');
            const track = document.createElement('div');
            const leftArrow = document.createElement('button');
            const rightArrow = document.createElement('button');
            const leftFade = document.createElement('div');
            const rightFade = document.createElement('div');

            // Viewport: overflow hidden, relative positioned for absolute children
            viewport.style.overflow = 'hidden';
            viewport.style.flex = '1';
            viewport.style.position = 'relative';
            viewport.style.display = 'flex';
            viewport.style.alignItems = 'stretch';

            // Track: flex row with gap, animated via transform
            track.style.display = 'flex';
            track.style.gap = '6px';
            track.style.alignItems = 'center';
            track.style.padding = '0 6px'; // small fixed padding on both ends
            track.style.transform = 'translateX(0)';
            track.style.willChange = 'transform';
            track.style.transition = 'transform 250ms cubic-bezier(0.22, 1, 0.36, 1)';

            // Arrow styling: absolutely positioned, overlay on top of content
            function styleArrow(el, side) {
                el.textContent = '';
                el.setAttribute('aria-label', side === 'left' ? 'Scroll left' : 'Scroll right');
                el.style.position = 'absolute';
                el.style.top = '0';
                el.style.bottom = '0';
                el.style[side] = '0';
                el.style.width = ARROW_W + 'px';
                el.style.minWidth = ARROW_W + 'px';
                el.style.border = '0';
                el.style.background = 'transparent';
                el.style.color = '#e6e6e6';
                el.style.borderRadius = '4px';
                el.style.cursor = 'pointer';
                el.style.display = 'none'; // hidden until overflow
                el.style.zIndex = '3'; // above fades
                el.style.alignItems = 'center';
                el.style.justifyContent = 'center';
                el.style.padding = '0';
                const svg = side === 'left'
                    ? '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#e6e6e6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
                    : '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#e6e6e6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                el.innerHTML = svg;
            }
            styleArrow(leftArrow, 'left');
            styleArrow(rightArrow, 'right');

            // Fade styling: absolutely positioned, always fixed to viewport edges
            function styleFade(el, side) {
                el.style.position = 'absolute';
                el.style.top = '0';
                el.style.bottom = '0';
                el.style[side] = '0';
                el.style.width = FADE_W + 'px';
                el.style.pointerEvents = 'none';
                el.style.zIndex = '2'; // below arrows
                el.style.display = 'none';
                const gradient = side === 'left'
                    ? 'linear-gradient(to right, #18181b 50%, rgba(24,24,27,0))'
                    : 'linear-gradient(to left, #18181b 50%, rgba(24,24,27,0))';
                el.style.background = gradient;
            }
            styleFade(leftFade, 'left');
            styleFade(rightFade, 'right');

            customTabSelector.appendChild(viewport);
            viewport.appendChild(track);
            viewport.appendChild(leftFade);
            viewport.appendChild(rightFade);
            viewport.appendChild(leftArrow);
            viewport.appendChild(rightArrow);

            // "+" Add Channel button (first item)
            const addButton = document.createElement('button');
            addButton.setAttribute('aria-label', 'Add channel');
            addButton.title = 'Add channel';
            addButton.textContent = '+';
            addButton.style.flex = '0 0 auto';
            addButton.style.width = '24px';
            addButton.style.height = '24px';
            addButton.style.padding = '0';
            addButton.style.border = 'none';
            addButton.style.borderRadius = '4px';
            addButton.style.background = '#404040';
            addButton.style.color = '#ffffff';
            addButton.style.fontSize = '16px';
            addButton.style.fontWeight = '700';
            addButton.style.lineHeight = '24px';
            addButton.style.textAlign = 'center';
            addButton.style.cursor = 'pointer';
            addButton.style.userSelect = 'none';
            addButton.addEventListener('mouseenter', () => { addButton.style.background = '#505050'; });
            addButton.addEventListener('mouseleave', () => { addButton.style.background = '#404040'; });

            function sanitizeChannelName(v) {
                return (v || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 25);
            }

            // Channel history cache for suggestions
            const HISTORY_KEY = 'mtw_channel_history';
            function readHistory() {
                try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
            }
            function writeHistory(arr) {
                try { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(0, 200))); } catch {}
            }
            function addToHistory(name) {
                const n = sanitizeChannelName(name);
                if (!n) return;
                const list = readHistory();
                const i = list.indexOf(n);
                if (i !== -1) list.splice(i, 1);
                list.unshift(n);
                writeHistory(list);
            }
            function removeFromHistory(name) {
                const n = sanitizeChannelName(name);
                const list = readHistory();
                const i = list.indexOf(n);
                if (i !== -1) { list.splice(i, 1); writeHistory(list); }
            }
            function filterHistory(prefix) {
                const p = sanitizeChannelName(prefix);
                const list = readHistory();
                if (!p) return list;
                return list.filter(x => x.startsWith(p));
            }

            // Ensure current URL channels are merged into cache (idempotent per path)
            let _mtwSeededPath;
            function ensureSeedFromUrlOncePerPath() {
                const path = location.pathname;
                if (_mtwSeededPath === path) return;
                _mtwSeededPath = path;
                const parts = (path.split('/').filter(Boolean) || []).map(sanitizeChannelName).filter(Boolean);
                parts.forEach(addToHistory);
            }

            function showSuggest(forInput, anchorRect) {
                // Merge URL channels into cache so suggestions include all connected channels
                ensureSeedFromUrlOncePerPath();
                // Remove any existing
                document.querySelectorAll('.mtw-suggest').forEach(n => n.remove());

                const valueNow = (forInput.value || '').trim();
                const items = filterHistory(valueNow);
                if (!items.length) return null;
                const listEl = document.createElement('div');
                listEl.className = 'mtw-suggest';
                // Position with viewport-aware flip (use input rect for reliability)
                const inputRect = forInput.getBoundingClientRect();
                const baseRect = inputRect && inputRect.width ? inputRect : anchorRect;
                const desiredWidth = Math.max(140, baseRect.width || 140);
                listEl.style.visibility = 'hidden';
                listEl.style.left = ((baseRect.left || 0)) + 'px';
                listEl.style.top = ((baseRect.bottom || 0) + 4) + 'px';
                listEl.style.width = desiredWidth + 'px';
                let activeIdx = -1;
                items.forEach(val => {
                    const row = document.createElement('div');
                    row.className = 'mtw-suggest__item';
                    const text = document.createElement('div');
                    text.className = 'mtw-suggest__text';
                    text.textContent = val;
                    const remove = document.createElement('button');
                    remove.className = 'mtw-suggest__remove';
                    remove.textContent = '×';
                    remove.title = 'Remove';
                    remove.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); }, true);
                    remove.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeFromHistory(val);
                        row.remove();
                        if (!listEl.querySelector('.mtw-suggest__item')) {
                            hideSuggest();
                        } else {
                            // Reposition to hug the input after height change
                            if (typeof listEl._mtwReposition === 'function') {
                                listEl._mtwReposition();
                            }
                        }
                    });
                    row.appendChild(text);
                    row.appendChild(remove);
                    row.addEventListener('click', () => {
                        forInput.value = val;
                        forInput.dispatchEvent(new Event('input', { bubbles: true }));
                        hideSuggest();
                        // Do not auto-commit on mouse click; just apply to the field like browser suggestions
                        forInput.focus();
                        if (forInput.select) try { forInput.select(); } catch {}
                    });
                    row.addEventListener('mouseenter', () => {
                        listEl.querySelectorAll('.mtw-suggest__item').forEach(n => n.classList.remove('mtw-suggest__item--active'));
                        row.classList.add('mtw-suggest__item--active');
                        activeIdx = Array.from(listEl.children).indexOf(row);
                    });
                    listEl.appendChild(row);
                });
                document.body.appendChild(listEl);
                // Prevent outside-click handlers and input blur when interacting with the list; allow click to fire
                listEl.addEventListener('mousedown', (ev) => { ev.preventDefault(); ev.stopPropagation(); }, true);
                function doPosition(ar) {
                    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
                    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
                    const h = listEl.offsetHeight;
                    let topBelow = ar.bottom + 4;
                    let top = topBelow;
                    if (topBelow + h > vh - 4) {
                        // place above
                        top = Math.max(4, ar.top - 4 - h);
                    }
                    // Clamp horizontally into viewport
                    let left = ar.left;
                    const w = listEl.offsetWidth;
                    const maxLeft = Math.max(4, vw - 4 - w);
                    if (left > maxLeft) left = maxLeft;
                    if (left < 4) left = 4;
                    listEl.style.top = top + 'px';
                    listEl.style.left = left + 'px';
                    listEl.style.visibility = 'visible';
                }
                // initial position
                doPosition(baseRect);
                // expose reposition helper for later updates (e.g., after removing an item)
                listEl._mtwReposition = () => doPosition(forInput.getBoundingClientRect());
                // Attach helpers to input for keyboard handling
                forInput._mtwSuggestList = listEl;
                forInput._mtwSuggestSetActive = (idx) => {
                    const rows = listEl.querySelectorAll('.mtw-suggest__item');
                    if (!rows.length) return;
                    rows.forEach(n => n.classList.remove('mtw-suggest__item--active'));
                    const clamped = Math.max(0, Math.min(rows.length - 1, idx));
                    rows[clamped].classList.add('mtw-suggest__item--active');
                    activeIdx = clamped;
                };
                forInput._mtwSuggestAcceptActive = () => {
                    const row = listEl.querySelector('.mtw-suggest__item--active');
                    if (!row) return false;
                    const val = row.querySelector('.mtw-suggest__text')?.textContent || '';
                    if (!val) return false;
                    forInput.value = val;
                    forInput.dispatchEvent(new Event('input', { bubbles: true }));
                    hideSuggest();
                    if (typeof forInput._mtwSuggestCommit === 'function') {
                        forInput._mtwSuggestCommit();
                    } else {
                        forInput.focus();
                        if (forInput.select) try { forInput.select(); } catch {}
                    }
                    return true;
                };
                return listEl;
            }
            function hideSuggest() { document.querySelectorAll('.mtw-suggest').forEach(n => n.remove()); }

            function buildNewUrl(newName) {
                const url = new URL(window.location.href);
                const parts = url.pathname.split('/').filter(Boolean);
                if (!parts.includes(newName)) parts.push(newName);
                url.pathname = '/' + parts.join('/');
                // update history
                addToHistory(newName);
                return url.toString();
            }

            function getPathParts() {
                const url = new URL(window.location.href);
                return url.pathname.split('/').filter(Boolean);
            }

            function buildUrlAfterRemovalAt(index) {
                const url = new URL(window.location.href);
                const parts = getPathParts();
                if (index >= 0 && index < parts.length) parts.splice(index, 1);
                url.pathname = '/' + parts.join('/');
                return url.toString();
            }

            function buildUrlAfterRenameAt(index, newName) {
                const name = sanitizeChannelName(newName);
                if (!name) return null;
                const url = new URL(window.location.href);
                const parts = getPathParts();
                if (index >= 0 && index < parts.length) {
                    const old = parts[index];
                    parts[index] = name;
                    if (old !== name) addToHistory(name);
                }
                url.pathname = '/' + parts.join('/');
                return url.toString();
            }

            function openAddInput() {
                // Replace button with input container
                const wrap = document.createElement('div');
                wrap.style.flex = '0 0 auto';
                wrap.style.display = 'flex';
                wrap.style.alignItems = 'center';
                wrap.style.height = '24px';
                wrap.style.background = '#2a2a2a';
                wrap.style.borderRadius = '4px';
                wrap.style.padding = '0 6px';
                wrap.style.boxSizing = 'border-box';

                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = 'channel';
                input.style.height = '20px';
                input.style.border = '0';
                input.style.outline = 'none';
                input.style.background = 'transparent';
                input.style.color = '#fff';
                input.style.fontSize = '12px';
                input.style.width = '80px';
                input.autocapitalize = 'none';
                input.autocomplete = 'off';
                input.spellcheck = false;

                wrap.appendChild(input);
                track.replaceChild(wrap, addButton);
                resync();
                input.focus();

                // Suggest dropdown wiring
                let dropdown = null;
                function refreshSuggest() {
                    hideSuggest();
                    const r = input.getBoundingClientRect();
                    dropdown = showSuggest(input, r);
                    // rAF pass to handle layout shifts
                    requestAnimationFrame(() => {
                        const r2 = input.getBoundingClientRect();
                        if (dropdown && dropdown._mtwReposition) dropdown._mtwReposition(r2);
                    });
                }
                const onInput = () => refreshSuggest();
                input.addEventListener('input', onInput);
                input.addEventListener('focus', onInput);
                const hideOnScroll = () => hideSuggest();
                window.addEventListener('scroll', hideOnScroll, true);
                window.addEventListener('resize', hideOnScroll, true);
                // When choosing a suggestion, commit add immediately
                input._mtwSuggestCommit = () => {
                    const name = sanitizeChannelName(input.value);
                    if (!name) return;
                    const target = buildNewUrl(name);
                    window.location.assign(target);
                };
                refreshSuggest();

                function closeRestore() {
                    if (wrap.parentNode === track) {
                        track.replaceChild(addButton, wrap);
                        resync();
                    }
                    document.removeEventListener('mousedown', outsideHandler, true);
                    hideSuggest();
                    window.removeEventListener('scroll', hideOnScroll, true);
                    window.removeEventListener('resize', hideOnScroll, true);
                }

                function submitAdd() {
                    const name = sanitizeChannelName(input.value);
                    if (!name) { closeRestore(); return; }
                    const target = buildNewUrl(name);
                    window.location.assign(target);
                }

                function outsideHandler(e) {
                    if (!(e.target instanceof Node)) return;
                    // Ignore clicks within suggestions list
                    const inSuggest = (e.target.closest && e.target.closest('.mtw-suggest'));
                    if (inSuggest) return;
                    if (!wrap.contains(e.target)) closeRestore();
                }
                document.addEventListener('mousedown', outsideHandler, true);

                input.addEventListener('keydown', (e) => {
                    const list = input._mtwSuggestList;

                    if (e.key === 'Tab') {
                        // If suggestions are showing, select bottom item
                        if (list) {
                            e.preventDefault();
                            const rows = list.querySelectorAll('.mtw-suggest__item');
                            if (rows.length) {
                                if (input._mtwSuggestSetActive) input._mtwSuggestSetActive(rows.length - 1);
                            }
                        }
                    } else if (e.key === 'Enter') {
                        // If suggestion list is open and has an active item, accept it first
                        if (input._mtwSuggestAcceptActive && input._mtwSuggestAcceptActive()) {
                            e.preventDefault();
                            return;
                        }
                        e.preventDefault();
                        submitAdd();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        closeRestore();
                    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        if (list) {
                            e.preventDefault();
                            const rows = list.querySelectorAll('.mtw-suggest__item');
                            if (!rows.length) return;
                            let idx = Array.from(rows).findIndex(n => n.classList.contains('mtw-suggest__item--active'));
                            // If no active item, Up starts from bottom, Down starts from top
                            if (idx < 0) {
                                idx = e.key === 'ArrowUp' ? rows.length - 1 : 0;
                            } else {
                                idx = idx + (e.key === 'ArrowDown' ? 1 : -1);
                            }
                            if (input._mtwSuggestSetActive) input._mtwSuggestSetActive(idx);
                        }
                    }
                });
            }

            addButton.addEventListener('click', openAddInput);
            track.appendChild(addButton);

            // Build buttons into the track
            const buttons = streamerNames.map((streamer, index) => {
                const tabButton = document.createElement('button');
                tabButton.textContent = streamer;
                tabButton.style.flex = '0 0 auto'; // fixed/content width
                tabButton.style.padding = '6px 10px';
                tabButton.style.border = 'none';
                tabButton.style.borderRadius = '4px';
                tabButton.style.background = '#404040';
                tabButton.style.color = 'white';
                tabButton.style.fontSize = '12px';
                tabButton.style.fontWeight = '600';
                tabButton.style.fontFamily = 'Inter, Roobert, "Helvetica Neue", Helvetica, Arial, sans-serif';
                tabButton.style.lineHeight = '1.5';
                tabButton.style.cursor = 'pointer';
                tabButton.style.transition = 'background-color 0.2s ease';
                tabButton.style.whiteSpace = 'nowrap';
                tabButton.style.textOverflow = 'ellipsis';
                tabButton.style.overflow = 'hidden';

                if (index === 0) {
                    tabButton.style.background = SELECTED;
                    tabButton.dataset.active = 'true';
                }

                tabButton.addEventListener('click', (e) => {
                    ensureVisible(tabButton, () => {
                        track.querySelectorAll('button').forEach(btn => {
                            btn.style.background = '#404040';
                            btn.dataset.active = 'false';
                        });
                        tabButton.style.background = SELECTED;
                        tabButton.dataset.active = 'true';
                        // Focus the button so key handlers (Delete/Backspace) apply to this item
                        try { tabButton.focus(); } catch {}
                        if (originalTabs[index]) originalTabs[index].click();
                    });
                });
                tabButton.addEventListener('mouseenter', () => {
                    if (tabButton.dataset.active !== 'true') tabButton.style.background = '#505050';
                });
                tabButton.addEventListener('mouseleave', () => {
                    if (tabButton.dataset.active !== 'true') tabButton.style.background = '#404040';
                });

                // Key handling: Delete/Backspace removes this channel from the URL
                tabButton.addEventListener('keydown', (e) => {
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                        e.preventDefault();
                        const target = buildUrlAfterRemovalAt(index);
                        if (target) window.location.assign(target);
                    }
                });

                // Double-click to rename: inline edit, select all, Enter commits, blur/Escape cancels
                tabButton.addEventListener('dblclick', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    ensureVisible(tabButton, () => {
                        const originalName = streamer;
                        const btnWidth = tabButton.offsetWidth || 120;
                        const wrap = document.createElement('div');
                        wrap.style.flex = '0 0 auto';
                        wrap.style.display = 'flex';
                        wrap.style.alignItems = 'center';
                        wrap.style.height = '24px';
                        wrap.style.background = '#2a2a2a';
                        wrap.style.borderRadius = '4px';
                        wrap.style.padding = '0 6px';
                        wrap.style.boxSizing = 'border-box';
                        wrap.style.width = btnWidth + 'px';

                        const input = document.createElement('input');
                        input.type = 'text';
                        input.value = originalName;
                        input.style.height = '20px';
                        input.style.border = '0';
                        input.style.outline = 'none';
                        input.style.background = 'transparent';
                        input.style.color = '#fff';
                        input.style.fontSize = '12px';
                        input.style.width = (btnWidth - 12) + 'px';
                        input.autocapitalize = 'none';
                        input.autocomplete = 'off';
                        input.spellcheck = false;

                        wrap.appendChild(input);
                        track.replaceChild(wrap, tabButton);
                        resync();
                        input.focus();
                        input.select();

                        // Suggest wiring
                        function refreshSuggest() {
                            hideSuggest();
                            const r = input.getBoundingClientRect();
                            const list = showSuggest(input, r);
                            // rAF pass to handle layout shifts after DOM swap
                            requestAnimationFrame(() => {
                                if (list && list._mtwReposition) list._mtwReposition(input.getBoundingClientRect());
                            });
                        }
                        const onInput = () => refreshSuggest();
                        input.addEventListener('input', onInput);
                        input.addEventListener('focus', onInput);
                        const hideOnScroll2 = () => hideSuggest();
                        window.addEventListener('scroll', hideOnScroll2, true);
                        window.addEventListener('resize', hideOnScroll2, true);
                        // When choosing a suggestion, commit rename immediately
                        input._mtwSuggestCommit = () => {
                            const newName = sanitizeChannelName(input.value);
                            if (!newName || newName === originalName) return;
                            const target = buildUrlAfterRenameAt(index, newName);
                            if (target) window.location.assign(target);
                        };
                        refreshSuggest();

                        let committed = false;
                        function closeRestore() {
                            if (committed) return;
                            if (wrap.parentNode === track) {
                                track.replaceChild(tabButton, wrap);
                                resync();
                            }
                            document.removeEventListener('mousedown', outsideHandler, true);
                            hideSuggest();
                            window.removeEventListener('scroll', hideOnScroll2, true);
                            window.removeEventListener('resize', hideOnScroll2, true);
                        }

                        function submitRename() {
                            const newName = sanitizeChannelName(input.value);
                            if (!newName || newName === originalName) { closeRestore(); return; }
                            const target = buildUrlAfterRenameAt(index, newName);
                            if (target) {
                                committed = true;
                                window.location.assign(target);
                            } else {
                                closeRestore();
                            }
                        }

                        function outsideHandler(ev) {
                            if (!(ev.target instanceof Node)) return;
                            const inSuggest = (ev.target.closest && ev.target.closest('.mtw-suggest'));
                            if (inSuggest) return;
                            if (!wrap.contains(ev.target)) closeRestore();
                        }
                        document.addEventListener('mousedown', outsideHandler, true);

                        input.addEventListener('keydown', (ke) => {
                            const list = input._mtwSuggestList;

                            if (ke.key === 'Tab') {
                                // If suggestions are showing, select bottom item
                                if (list) {
                                    ke.preventDefault();
                                    const rows = list.querySelectorAll('.mtw-suggest__item');
                                    if (rows.length) {
                                        if (input._mtwSuggestSetActive) input._mtwSuggestSetActive(rows.length - 1);
                                    }
                                }
                            } else if (ke.key === 'Enter') {
                                if (input._mtwSuggestAcceptActive && input._mtwSuggestAcceptActive()) { ke.preventDefault(); return; }
                                ke.preventDefault(); submitRename(); }
                            else if (ke.key === 'Escape') { ke.preventDefault(); closeRestore(); }
                            else if (ke.key === 'ArrowDown' || ke.key === 'ArrowUp') {
                                if (list) {
                                    ke.preventDefault();
                                    const rows = list.querySelectorAll('.mtw-suggest__item');
                                    if (!rows.length) return;
                                    let idx = Array.from(rows).findIndex(n => n.classList.contains('mtw-suggest__item--active'));
                                    // If no active item, Up starts from bottom, Down starts from top
                                    if (idx < 0) {
                                        idx = ke.key === 'ArrowUp' ? rows.length - 1 : 0;
                                    } else {
                                        idx = idx + (ke.key === 'ArrowDown' ? 1 : -1);
                                    }
                                    if (input._mtwSuggestSetActive) input._mtwSuggestSetActive(idx);
                                }
                            }
                        });
                        input.addEventListener('blur', closeRestore);
                    });
                });

                track.appendChild(tabButton);
                return tabButton;
            });

            // Continuous scrolling logic: no pages, just raw offset
            let currentOffset = 0;

            function updateScrollState() {
                const vpWidth = viewport.clientWidth;
                const contentWidth = track.scrollWidth;
                const maxOffset = Math.max(0, contentWidth - vpWidth);
                // Clamp offset
                currentOffset = Math.max(0, Math.min(currentOffset, maxOffset));
                track.style.transform = `translateX(-${currentOffset}px)`;

                // Determine if we can scroll left or right
                const canScrollLeft = currentOffset > 1;
                const canScrollRight = currentOffset < (maxOffset - 1);

                // Show/hide arrows and fades based purely on scroll capability
                leftArrow.style.display = canScrollLeft ? 'flex' : 'none';
                rightArrow.style.display = canScrollRight ? 'flex' : 'none';
                leftFade.style.display = canScrollLeft ? 'block' : 'none';
                rightFade.style.display = canScrollRight ? 'block' : 'none';
            }

            function scrollBy(deltaX) {
                currentOffset += deltaX;
                updateScrollState();
            }

            function scrollTo(offsetPx) {
                currentOffset = offsetPx;
                updateScrollState();
            }

            // Check if an element is obscured by arrows and scroll it into view if needed
            function ensureVisible(el, callback) {
                try {
                    const btnRect = el.getBoundingClientRect();
                    const vpRect = viewport.getBoundingClientRect();

                    // Check if button is obscured by arrows (with small margin)
                    const margin = 4;
                    const leftEdge = vpRect.left + (leftArrow.style.display !== 'none' ? ARROW_W : 0) + margin;
                    const rightEdge = vpRect.right - (rightArrow.style.display !== 'none' ? ARROW_W : 0) - margin;

                    const isObscuredLeft = btnRect.left < leftEdge;
                    const isObscuredRight = btnRect.right > rightEdge;

                    if (isObscuredLeft || isObscuredRight) {
                        // Calculate how much to scroll to bring button into clear view
                        const trackRect = track.getBoundingClientRect();
                        const btnLeftInTrack = btnRect.left - trackRect.left;
                        const btnRightInTrack = btnRect.right - trackRect.left;

                        let targetOffset;
                        if (isObscuredLeft) {
                            // Scroll so button's left edge is just past the left arrow
                            targetOffset = btnLeftInTrack - ARROW_W - margin - 8;
                        } else {
                            // Scroll so button's right edge is just before the right arrow
                            targetOffset = btnRightInTrack - vpRect.width + ARROW_W + margin + 8;
                        }

                        scrollTo(targetOffset);

                        // Wait for transition to complete before executing callback
                        setTimeout(() => {
                            if (callback) callback();
                        }, 260); // slightly longer than transition duration
                    } else {
                        // Not obscured, execute immediately
                        if (callback) callback();
                    }
                } catch {
                    // On error, just execute callback immediately
                    if (callback) callback();
                }
            }

            // Arrow clicks: scroll by viewport width
            leftArrow.addEventListener('click', () => {
                const vpWidth = viewport.clientWidth;
                scrollBy(-vpWidth * 0.8);
            });
            rightArrow.addEventListener('click', () => {
                const vpWidth = viewport.clientWidth;
                scrollBy(vpWidth * 0.8);
            });

            // Recalculate on width/height/layout changes
            function resync() {
                syncWidth();
                adjustChatHeight();
                void track.offsetWidth; // reflow
                updateScrollState();
            }
            window.addEventListener('resize', resync);
            const mo = new MutationObserver(resync);
            if (chatbox) {
                mo.observe(chatbox, { attributes: true, attributeFilter: ['style'], subtree: true, childList: true });
            }
            mo.observe(customTabSelector, { attributes: true, childList: true, subtree: true });
            if (window.ResizeObserver) {
                const ro = new ResizeObserver(() => resync());
                ro.observe(document.body);
                if (chatbox) ro.observe(chatbox);
            }

            // Keyboard navigation: arrow keys scroll by viewport width, Tab cycles through chat buttons
            document.addEventListener('keydown', (e) => {
                const ae = document.activeElement;
                const inInput = ae && ((ae.tagName === 'INPUT') || (ae.tagName === 'TEXTAREA') || (ae.getAttribute && ae.getAttribute('contenteditable') === 'true'));

                // Tab key: cycle through chat buttons only (unless we're in an input field)
                if (e.key === 'Tab') {
                    // If in an input field, let the input's own keydown handler deal with Tab
                    if (inInput) return;

                    e.preventDefault();
                    const allButtons = track.querySelectorAll('button');
                    if (!allButtons.length) return;

                    let currentIndex = -1;
                    allButtons.forEach((btn, idx) => {
                        if (btn === ae) currentIndex = idx;
                    });

                    let nextIndex;
                    if (e.shiftKey) {
                        // Shift+Tab: go backwards
                        nextIndex = currentIndex <= 0 ? allButtons.length - 1 : currentIndex - 1;
                    } else {
                        // Tab: go forwards
                        nextIndex = currentIndex >= allButtons.length - 1 ? 0 : currentIndex + 1;
                    }

                    const nextButton = allButtons[nextIndex];
                    if (nextButton) {
                        ensureVisible(nextButton, () => {
                            nextButton.focus();
                        });
                    }
                    return;
                }

                if (inInput) return;

                const vpWidth = viewport.clientWidth;
                if (e.key === 'ArrowRight') {
                    const contentWidth = track.scrollWidth;
                    const maxOffset = Math.max(0, contentWidth - vpWidth);
                    if (currentOffset < maxOffset - 1) {
                        e.preventDefault();
                        scrollBy(vpWidth * 0.8);
                    }
                } else if (e.key === 'ArrowLeft') {
                    if (currentOffset > 1) {
                        e.preventDefault();
                        scrollBy(-vpWidth * 0.8);
                    }
                }
            }, { passive: false });

            // Initial state
            scrollTo(0);
            adjustChatHeight();

            tablist.style.display = 'none';
            bottomRightBar.remove();

            console.log('Custom tab selector created');
        }
    }

    // Route: twitch embed chat vs multitwitch host
    if (!initTwitchChatCleaner()) {
        // Start intercepting stream iframes immediately (before DOM is ready)
        interceptStreamIframes();

        initTabSelector();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initTabSelector);
        }
    }
})();
