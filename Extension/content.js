// DEFAULT_CONFIG is loaded from config.js
// Gemini Ultimate v2.1 — Styled debug logs + config-driven toggle

// ─── LOGGER ──────────────────────────────────────────────────────────────────

let DEBUG = false; // Will be set from config

const STYLES = {
    title:  'color:#fff;background:#6C5CE7;padding:2px 6px;border-radius:4px;font-weight:bold',
    step:   'color:#fff;background:#00B894;padding:2px 6px;border-radius:4px;font-weight:bold',
    info:   'color:#74b9ff;font-weight:normal',
    warn:   'color:#fdcb6e;font-weight:bold',
    error:  'color:#ff7675;font-weight:bold',
    data:   'color:#dfe6e9;font-weight:normal',
    match:  'color:#55efc4;font-weight:bold',
};

function log(style, ...args) {
    if (!DEBUG) return;
    console.log('%c🔮 Gemini Ultimate %c' + args[0], STYLES.title, style, ...args.slice(1));
}
function logStep(step, ...args) {
    if (!DEBUG) return;
    console.log('%c🔮 Gemini Ultimate %c▸ ' + step, STYLES.title, STYLES.step, ...args);
}
function logWarn(...args) {
    if (!DEBUG) return;
    console.warn('%c🔮 Gemini Ultimate %c⚠ ' + args[0], STYLES.title, STYLES.warn, ...args.slice(1));
}

// ─── CONFIG ──────────────────────────────────────────────────────────────────

async function getConfig() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['config'], (result) => {
            let needsSave = false;
            let config;
            if (result.config) {
                config = { ...DEFAULT_CONFIG, ...result.config };
                // Migration: remove old thinking/extended keywords from MODELS_TO_AVOID
                const thinkingKeywords = ['extended', 'thinking', 'raisonnement', 'réflexion'];
                if (Array.isArray(config.MODELS_TO_AVOID)) {
                    const initialLen = config.MODELS_TO_AVOID.length;
                    config.MODELS_TO_AVOID = config.MODELS_TO_AVOID.filter(
                        m => !thinkingKeywords.includes(m.toLowerCase().trim())
                    );
                    if (config.MODELS_TO_AVOID.length !== initialLen) {
                        needsSave = true;
                    }
                }
                if (typeof config.EXTENDED_THINKING !== 'boolean') {
                    config.EXTENDED_THINKING = (typeof DEFAULT_CONFIG.EXTENDED_THINKING === 'boolean')
                        ? DEFAULT_CONFIG.EXTENDED_THINKING
                        : false;
                    needsSave = true;
                }
                if (!Array.isArray(config.EXTENDED_KEYWORDS) || config.EXTENDED_KEYWORDS.length === 0) {
                    config.EXTENDED_KEYWORDS = Array.isArray(DEFAULT_CONFIG.EXTENDED_KEYWORDS)
                        ? [...DEFAULT_CONFIG.EXTENDED_KEYWORDS]
                        : ['Raisonnement étendu', 'Extended thinking', 'Thinking', 'Raisonnement', 'réflexion', 'Extended'];
                    needsSave = true;
                }
                if (needsSave) {
                    chrome.storage.sync.set({ config });
                }
            } else {
                config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
                chrome.storage.sync.set({ config });
            }
            // Set global debug flag
            DEBUG = config.DEBUG_LOGS === true;
            resolve(config);
        });
    });
}

const params = new URLSearchParams(window.location.search);
const query  = params.get('q');

// ─── CANCELLATION & SESSION STATE ────────────────────────────────────────────

let isCancelled = false;
let cancelBannerEl = null;
let countdownInterval = null;
let sendTimeoutId = null;
let textInjectedByExtension = false;

function cleanUrlQuery() {
    try {
        const cleanParams = new URLSearchParams(window.location.search);
        if (cleanParams.has('q')) {
            cleanParams.delete('q');
            const cleanSearch = cleanParams.toString();
            const cleanUrl = window.location.pathname + (cleanSearch ? '?' + cleanSearch : '') + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);
            log(STYLES.info, 'URL cleaned of ?q= parameter');
        }
    } catch (e) {}
}

const SESSION_PREFIX = 'gu_processed_';

function isQueryAlreadyProcessed(q) {
    try {
        const key = SESSION_PREFIX + encodeURIComponent(q);
        return sessionStorage.getItem(key) !== null;
    } catch (e) {
        return false;
    }
}

function markQueryProcessed(q, status = 'sent') {
    try {
        const key = SESSION_PREFIX + encodeURIComponent(q);
        sessionStorage.setItem(key, status);
    } catch (e) {}
}

// ─── STYLES & NOTIFICATION ───────────────────────────────────────────────────

function ensureStyles() {
    if (document.getElementById('gemini-ultimate-style')) return;
    const style = document.createElement('style');
    style.id = 'gemini-ultimate-style';
    style.textContent = `
        @keyframes guSlideUp {
            from { opacity: 0; transform: translateX(-50%) translateY(20px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0);    }
        }
        @keyframes guSlideDown {
            from { opacity: 1; transform: translateX(-50%) translateY(0);    }
            to   { opacity: 0; transform: translateX(-50%) translateY(20px); }
        }
        @keyframes guBannerIn {
            from { opacity: 0; transform: translateX(-50%) translateY(-24px) scale(0.96); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1);       }
        }
        @keyframes guBannerOut {
            from { opacity: 1; transform: translateX(-50%) translateY(0) scale(1);       }
            to   { opacity: 0; transform: translateX(-50%) translateY(-24px) scale(0.96); }
        }
        @keyframes guSpin {
            from { transform: rotate(0deg);   }
            to   { transform: rotate(360deg); }
        }
        @keyframes guPulseGlow {
            0%, 100% { box-shadow: 0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(138,180,248,0.25); }
            50%      { box-shadow: 0 8px 32px rgba(0,0,0,0.55), 0 0 0 2px rgba(138,180,248,0.55), 0 0 18px rgba(138,180,248,0.25); }
        }
        .gu-cancel-btn:hover {
            background: rgba(242, 139, 130, 0.28) !important;
            border-color: rgba(242, 139, 130, 0.6) !important;
            transform: translateY(-1px);
        }
        .gu-cancel-btn:active {
            transform: translateY(0) scale(0.96);
        }
        .gu-clear-btn:hover {
            background: rgba(255, 255, 255, 0.16) !important;
            border-color: rgba(255, 255, 255, 0.3) !important;
            transform: translateY(-1px);
        }
        .gu-clear-btn:active {
            transform: translateY(0) scale(0.96);
        }
    `;
    document.head.appendChild(style);
}

function showNotification(message, type = 'error') {
    const existing = document.getElementById('gemini-ultimate-notification');
    if (existing) existing.remove();

    ensureStyles();

    const colors = {
        info:    { bg: 'rgba(138, 180, 248, 0.95)', text: '#000' },
        success: { bg: 'rgba(129, 201, 149, 0.95)', text: '#000' },
        warning: { bg: 'rgba(251, 188, 4,   0.95)', text: '#000' },
        error:   { bg: 'rgba(242, 139, 130, 0.95)', text: '#000' },
    };
    const color = colors[type] || colors.error;

    const notifEl = document.createElement('div');
    notifEl.id = 'gemini-ultimate-notification';
    notifEl.style.cssText = `
        position:fixed; bottom:20px; left:50%;
        transform:translateX(-50%);
        padding:12px 24px;
        background:${color.bg}; color:${color.text};
        border-radius:12px;
        font-family:'Google Sans','Segoe UI',Roboto,sans-serif;
        font-size:14px; font-weight:500;
        box-shadow:0 4px 12px rgba(0,0,0,.3);
        z-index:999999; display:flex; align-items:center; gap:10px;
        animation:guSlideUp .3s ease; backdrop-filter:blur(10px);
    `;
    const span = document.createElement('span');
    span.textContent = `⚠️ ${message}`;
    notifEl.appendChild(span);
    document.body.appendChild(notifEl);

    setTimeout(() => {
        notifEl.style.animation = 'guSlideDown .3s ease forwards';
        setTimeout(() => notifEl.remove(), 300);
    }, 4000);
}

// ─── CANCEL BANNER UI ────────────────────────────────────────────────────────

function createCancelBanner(queryText) {
    ensureStyles();

    const existing = document.getElementById('gemini-ultimate-cancel-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'gemini-ultimate-cancel-banner';
    banner.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 12px;
        background: rgba(18, 19, 24, 0.92);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 9999px;
        padding: 8px 12px 8px 16px;
        font-family: 'Google Sans', 'Inter', system-ui, -apple-system, sans-serif;
        color: #e8eaed;
        box-shadow: 0 8px 32px rgba(0,0,0,0.55);
        animation: guBannerIn .3s cubic-bezier(0.2, 0, 0, 1), guPulseGlow 2.2s ease-in-out infinite;
        user-select: none;
    `;

    const iconWrap = document.createElement('div');
    iconWrap.id = 'gu-banner-icon';
    iconWrap.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: rgba(138, 180, 248, 0.15);
        color: #8ab4f8;
        flex-shrink: 0;
    `;
    iconWrap.innerHTML = `
        <svg style="width:15px; height:15px; animation:guSpin 1.4s linear infinite;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
    `;

    const contentWrap = document.createElement('div');
    contentWrap.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
    `;

    const statusEl = document.createElement('span');
    statusEl.id = 'gu-banner-status';
    statusEl.style.cssText = 'font-weight:600; color:#e8eaed; white-space:nowrap;';
    const preparingMsg = chrome.i18n.getMessage('cancelBannerPreparing') || 'Préparation de la requête...';
    statusEl.textContent = preparingMsg;

    const previewEl = document.createElement('span');
    previewEl.style.cssText = 'font-size:12px; color:#9aa0a6; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-style:italic;';
    previewEl.textContent = `« ${queryText} »`;

    contentWrap.appendChild(statusEl);
    contentWrap.appendChild(previewEl);

    const actionContainer = document.createElement('div');
    actionContainer.id = 'gu-banner-actions';
    actionContainer.style.cssText = 'display: flex; align-items: center; gap: 6px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'gu-cancel-btn';
    cancelBtn.className = 'gu-cancel-btn';
    cancelBtn.style.cssText = `
        background: rgba(242, 139, 130, 0.16);
        color: #f28b82;
        border: 1px solid rgba(242, 139, 130, 0.35);
        border-radius: 9999px;
        padding: 5px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all .2s ease;
        outline: none;
        font-family: inherit;
    `;

    const cancelLabel = chrome.i18n.getMessage('btnCancel') || 'Annuler';
    const cancelHint = chrome.i18n.getMessage('btnCancelHint') || 'Échap';
    cancelBtn.innerHTML = `
        <span>${cancelLabel}</span>
        <kbd style="background:rgba(242,139,130,0.22); padding:1px 5px; border-radius:4px; font-size:10px; text-transform:uppercase; font-family:inherit;">${cancelHint}</kbd>
    `;

    cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelExecution();
    });

    actionContainer.appendChild(cancelBtn);

    banner.appendChild(iconWrap);
    banner.appendChild(contentWrap);
    banner.appendChild(actionContainer);

    document.body.appendChild(banner);
    cancelBannerEl = banner;

    const onKeyDown = (e) => {
        if (e.key === 'Escape') {
            if (!isCancelled && cancelBannerEl) {
                e.preventDefault();
                e.stopPropagation();
                cancelExecution();
            }
        }
    };
    window.addEventListener('keydown', onKeyDown, true);
    cancelBannerEl._cleanupKeydown = () => window.removeEventListener('keydown', onKeyDown, true);

    return banner;
}

function updateBannerCountdown(remainingMs) {
    if (!cancelBannerEl || isCancelled) return;
    const statusEl = document.getElementById('gu-banner-status');
    if (!statusEl) return;
    const sec = (Math.max(0, remainingMs) / 1000).toFixed(1);
    const msg = chrome.i18n.getMessage('cancelBannerSending', [sec]) || `Envoi automatique dans ${sec}s...`;
    statusEl.textContent = msg;
}

function closeOpenMenu() {
    // 1. Click Angular Material CDK overlay backdrop if present
    const backdrop = document.querySelector('.cdk-overlay-backdrop, [class*="overlay-backdrop"]');
    if (backdrop && backdrop.getClientRects().length > 0) {
        backdrop.click();
        return;
    }

    // 2. If the pill button has aria-expanded="true", click to toggle it closed
    const pill = findModelSelectorPill();
    if (pill && pill.getAttribute('aria-expanded') === 'true') {
        pill.click();
        return;
    }

    // 3. Fallback: click outside on body if an open menu is detected
    const openMenu = document.querySelector('gem-menu[data-visible="true"], gem-menu, [role="menu"], [role="listbox"], .mat-mdc-menu-panel');
    if (openMenu) {
        document.body.click();
    }
}

function cancelExecution() {
    if (isCancelled) return;
    isCancelled = true;
    logWarn('Auto-send cancelled by user');

    if (sendTimeoutId) {
        clearTimeout(sendTimeoutId);
        sendTimeoutId = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    if (query) {
        markQueryProcessed(query, 'cancelled');
    }

    // Close any open menus via DOM interaction
    closeOpenMenu();

    if (!cancelBannerEl) return;

    cancelBannerEl.style.animation = 'guBannerIn .25s ease';
    cancelBannerEl.style.borderColor = 'rgba(242, 139, 130, 0.35)';

    const iconWrap = document.getElementById('gu-banner-icon');
    if (iconWrap) {
        iconWrap.style.background = 'rgba(242, 139, 130, 0.15)';
        iconWrap.style.color = '#f28b82';
        iconWrap.innerHTML = `
            <svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M15 9l-6 6M9 9l6 6"/>
            </svg>
        `;
    }

    const statusEl = document.getElementById('gu-banner-status');
    if (statusEl) {
        statusEl.textContent = chrome.i18n.getMessage('cancelBannerCancelled') || 'Envoi automatique annulé';
        statusEl.style.color = '#f28b82';
    }

    const actionContainer = document.getElementById('gu-banner-actions');
    if (actionContainer) {
        actionContainer.innerHTML = '';

        // Only display the "Clear" button if the extension actually injected the text into the editor
        if (textInjectedByExtension) {
            const clearBtn = document.createElement('button');
            clearBtn.id = 'gu-clear-btn';
            clearBtn.className = 'gu-clear-btn';
            clearBtn.style.cssText = `
                background: rgba(255, 255, 255, 0.08);
                color: #e8eaed;
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 9999px;
                padding: 5px 12px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all .2s ease;
                outline: none;
                font-family: inherit;
            `;
            clearBtn.textContent = chrome.i18n.getMessage('btnClearText') || 'Effacer';

            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                clearEditorText();
                dismissBanner();
            });

            actionContainer.appendChild(clearBtn);
        }
    }

    setTimeout(() => {
        dismissBanner();
    }, textInjectedByExtension ? 3500 : 2500);
}

function clearEditorText() {
    if (!textInjectedByExtension) return;
    const editor = document.querySelector('div[contenteditable="true"]');
    if (editor) {
        editor.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        editor.innerHTML = '';
        editor.dispatchEvent(new Event('change', { bubbles: true }));
        editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
        log(STYLES.info, 'Editor content cleared');
    }
}

function dismissBanner() {
    if (!cancelBannerEl) return;
    if (cancelBannerEl._cleanupKeydown) {
        cancelBannerEl._cleanupKeydown();
    }
    cancelBannerEl.style.animation = 'guBannerOut .3s cubic-bezier(0.2, 0, 0, 1) forwards';
    setTimeout(() => {
        if (cancelBannerEl) {
            cancelBannerEl.remove();
            cancelBannerEl = null;
        }
    }, 300);
}

// ─── MODEL PICKER ─────────────────────────────────────────────────────────────

function getPickerFullText(pillElement) {
    const primary   = pillElement.querySelector('.picker-primary-text');
    const secondary = pillElement.querySelector('.picker-secondary-text');
    if (primary) {
        const parts = [primary.textContent.trim()];
        if (secondary) parts.push(secondary.textContent.trim());
        return parts.join(' ');
    }

    const ariaLabel = pillElement.getAttribute('aria-label') || '';
    const currentlyMatch = ariaLabel.match(/currently\s+(.+)/i);
    if (currentlyMatch) return currentlyMatch[1].trim();

    const labelContainer = pillElement.querySelector(
        '.logo-pill-label-container, .input-area-switch-label'
    );
    if (labelContainer) {
        let text = '';
        for (const child of labelContainer.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                text += child.textContent;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const tag = child.tagName.toLowerCase();
                if (tag !== 'gem-icon' && tag !== 'mat-icon') {
                    text += child.textContent;
                }
            }
        }
        return text.trim();
    }

    return (pillElement.textContent || '').trim();
}

function findModelSelectorPill() {
    const stableSelectors = [
        '[data-test-id="bard-mode-menu-button"]',
        '[data-test-id="model-picker-trigger"]',
        '[data-test-id="model-selector-trigger"]',
        '[data-test-id="model-chip"]',
        'button[data-test-id*="model"]',
        'model-selector-chip button',
        'model-picker button',
    ];
    for (const sel of stableSelectors) {
        const el = document.querySelector(sel);
        if (el && el.getClientRects().length > 0) {
            log(STYLES.info, `Pill found via ${sel}`);
            return el;
        }
    }

    const modeSwitcher = document.querySelector('bard-mode-switcher');
    if (modeSwitcher) {
        const btn = modeSwitcher.querySelector('button');
        if (btn && btn.getClientRects().length > 0) {
            log(STYLES.info, 'Pill found via bard-mode-switcher');
            return btn;
        }
    }

    const headerContainers = document.querySelectorAll(
        'header, [role="banner"], nav, .app-header, [class*="header"], [class*="top-bar"]'
    );
    const MODEL_KW = ['flash', 'thinking', 'pro', 'ultra', 'nano', 'lite', 'extended'];
    for (const container of headerContainers) {
        const btns = container.querySelectorAll('button, [role="button"], [role="combobox"]');
        for (const btn of btns) {
            if (btn.getClientRects().length === 0) continue;
            const text = (btn.textContent + ' ' + (btn.getAttribute('aria-label') || '')).toLowerCase();
            if (MODEL_KW.some(k => text.includes(k)) && text.length < 80) {
                log(STYLES.info, 'Pill found via header keyword');
                return btn;
            }
        }
    }

    const legacySelectors = [
        'button.input-area-switch',
        '.model-picker-container button',
        '.logo-pill-label-container',
        '.input-area-switch-label',
        '[class*="model-selector"] button',
        '[class*="model-chip"]',
        'button[aria-label*="mode picker"]',
        'button[aria-label*="Flash"]',
        'button[aria-label*="flash"]',
        'button[aria-label*="modèle"]',
        'button[aria-label*="model"]',
    ];
    for (const sel of legacySelectors) {
        const el = document.querySelector(sel);
        if (el && el.getClientRects().length > 0) {
            log(STYLES.info, `Pill found via legacy: ${sel}`);
            if (el.tagName !== 'BUTTON') {
                const btn = el.closest('button') || el.querySelector('button');
                if (btn && btn.getClientRects().length > 0) return btn;
            }
            return el;
        }
    }

    const allButtons = document.querySelectorAll('button, [role="button"]');
    for (const btn of allButtons) {
        if (btn.getClientRects().length === 0) continue;
        if (btn.closest('[role="dialog"], [role="alertdialog"]')) continue;
        const text = (btn.textContent + ' ' + (btn.getAttribute('aria-label') || '')).toLowerCase().trim();
        if (MODEL_KW.some(k => text.includes(k)) && text.length < 60) {
            log(STYLES.info, 'Pill found via fallback button');
            return btn;
        }
    }

    return null;
}

function getPickerModelOnlyText(pillElement) {
    if (!pillElement) return '';
    const primary = pillElement.querySelector('.picker-primary-text');
    if (primary) return primary.textContent.trim();
    return getPickerFullText(pillElement);
}

function isPillShowingExtended(pillElement, keywords = []) {
    if (!pillElement) return false;
    const list = (Array.isArray(keywords) && keywords.length > 0)
        ? keywords
        : ['raisonnement étendu', 'extended thinking', 'thinking', 'raisonnement', 'réflexion', 'extended'];

    // 1. Check secondary text specifically against keywords (never assume any text = extended)
    const secondary = pillElement.querySelector('.picker-secondary-text');
    if (secondary) {
        const secText = secondary.textContent.toLowerCase().trim();
        if (list.some(kw => secText.includes(kw.toLowerCase().trim()))) {
            return true;
        }
    }

    // 2. Check badges or tags inside the pill specifically against keywords
    const badgeEls = pillElement.querySelectorAll('.picker-badge, [class*="badge"], [class*="tag"], [class*="sub-label"]');
    for (const badge of badgeEls) {
        const badgeText = badge.textContent.toLowerCase().trim();
        if (list.some(kw => badgeText.includes(kw.toLowerCase().trim()))) {
            return true;
        }
    }

    // 3. Fallback: check full pill text or aria-label against keywords,
    // making sure not to falsely match the primary model name
    const primary = pillElement.querySelector('.picker-primary-text');
    const primaryText = primary ? primary.textContent.toLowerCase().trim() : '';
    const fullText = (getPickerFullText(pillElement) + ' ' + (pillElement.getAttribute('aria-label') || '')).toLowerCase();

    return list.some(kw => {
        const kwLower = kw.toLowerCase().trim();
        return fullText.includes(kwLower) && !primaryText.includes(kwLower);
    });
}

function currentModelContains(keywords) {
    const pill = findModelSelectorPill();
    if (!pill) {
        logWarn('No pill element found');
        return null;
    }
    const text = getPickerModelOnlyText(pill).toLowerCase();
    log(STYLES.data, `Current model (primary): "${text}"`);
    for (const kw of keywords) {
        if (text.includes(kw.toLowerCase().trim())) {
            log(STYLES.match, `Match: "${kw}" → switching model`);
            return { element: pill, keyword: kw };
        }
    }
    log(STYLES.info, 'Model is OK, no change needed');
    return null;
}

// ─── MENU ITEMS ───────────────────────────────────────────────────────────────

function getMenuItemLabel(menuItem) {
    const labelSpan = menuItem.querySelector('.label');
    if (labelSpan) return labelSpan.textContent.trim();
    const titleEl = menuItem.querySelector(
        '.mode-title, [class*="model-name"], [class*="model-title"], [class*="option-title"]'
    );
    if (titleEl) return titleEl.textContent.trim();
    return (menuItem.textContent || '').trim();
}

function isExtendedMenuItem(item, keywords = []) {
    if (!item) return false;
    const label = getMenuItemLabel(item).toLowerCase();
    const list = (Array.isArray(keywords) && keywords.length > 0)
        ? keywords
        : ['raisonnement étendu', 'extended thinking', 'thinking', 'raisonnement', 'réflexion', 'extended'];

    // Direct match on item primary label
    if (list.some(kw => label.includes(kw.toLowerCase().trim()))) {
        return true;
    }

    // Only check full text if item is NOT an explicit base model option (which has data-mode-id)
    const isModelItem = item.hasAttribute('data-mode-id') ||
        (item.getAttribute('data-test-id') || '').includes('mode-option');
    if (!isModelItem) {
        const fullText = (item.textContent || '').toLowerCase();
        if (list.some(kw => fullText.includes(kw.toLowerCase().trim()))) {
            return true;
        }
    }

    return false;
}

function findExtendedMenuItem(menu, keywords = []) {
    const root = menu || document;
    const allItems = root.querySelectorAll(
        'gem-menu-item, [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'
    );
    for (const item of allItems) {
        if (item.getClientRects().length === 0) continue;
        if (isExtendedMenuItem(item, keywords)) {
            return item;
        }
    }
    return null;
}

function isExtendedItemActive(item) {
    if (!item) return false;
    if (item.getAttribute('data-active') === 'true') return true;
    if (item.getAttribute('aria-checked') === 'true') return true;
    if (item.getAttribute('aria-selected') === 'true') return true;
    if (item.classList.contains('selected') || item.classList.contains('active')) return true;

    const content = item.querySelector('gem-menu-item-content');
    if (content && (content.classList.contains('selected') || content.classList.contains('active'))) {
        return true;
    }

    const checkIcon = item.querySelector('[fonticon="check"], [data-mat-icon-name="check"], gem-icon[aria-label*="Sélectionné" i], gem-icon[aria-label*="Selected" i]');
    if (checkIcon) return true;

    return false;
}

function setExtendedThinkingMode(menu, desiredState, keywords = []) {
    const item = findExtendedMenuItem(menu, keywords);
    if (!item) {
        logWarn('Extended thinking menu item not found');
        return false;
    }
    const currentlyActive = isExtendedItemActive(item);
    log(STYLES.info, `Extended thinking in menu: currently=${currentlyActive ? 'ON' : 'OFF'}, target=${desiredState ? 'ON' : 'OFF'}`);
    if (currentlyActive !== desiredState) {
        log(STYLES.match, `Toggling Extended Thinking to ${desiredState ? 'ON' : 'OFF'} ✓`);
        item.click();
        return true;
    }
    log(STYLES.info, `Extended thinking already in target state (${desiredState ? 'ON' : 'OFF'})`);
    return false;
}

function findMenuItem(keywords, extendedKeywords = []) {
    const allGemItems = document.querySelectorAll('gem-menu-item');
    if (DEBUG && allGemItems.length > 0) {
        const labels = Array.from(allGemItems).map(item => getMenuItemLabel(item));
        log(STYLES.data, `Menu items: [${labels.join(', ')}]`);
    }

    for (const keyword of keywords) {
        const kw = keyword.toLowerCase().trim();

        for (const item of allGemItems) {
            if (item.getClientRects().length === 0) continue;
            if (isExtendedMenuItem(item, extendedKeywords)) continue;
            const label = getMenuItemLabel(item).toLowerCase();
            if (matchesModelKeyword(label, kw)) {
                log(STYLES.match, `Menu match: "${label}" for keyword "${kw}"`);
                return { element: item, keyword };
            }
        }

        const escapedKw = CSS.escape(kw);
        const byId = document.querySelector(
            `[data-test-id*="${escapedKw}" i], button[data-test-id*="${escapedKw}" i]`
        );
        if (byId && byId.getClientRects().length > 0) return { element: byId, keyword };

        const labelEls = document.querySelectorAll(
            '.mode-title, .gds-label-l, .label, '
            + '[class*="option-title"], [class*="model-name"], [class*="model-title"], '
            + 'mat-option span, [role="option"] span, '
            + '[role="menuitem"] span, [role="menuitemradio"] span, '
            + 'li span, [class*="list-item"] span'
        );
        for (const el of labelEls) {
            const elText = (el.textContent || '').toLowerCase().trim();
            if (matchesModelKeyword(elText, kw)) {
                const btn = el.closest(
                    'gem-menu-item, button, [role="menuitemradio"], [role="menuitem"], [role="option"], mat-option, li'
                );
                if (btn && btn.getClientRects().length > 0) {
                    if (isExtendedMenuItem(btn, extendedKeywords)) continue;
                    return { element: btn, keyword };
                }
            }
        }

        const menuItems = document.querySelectorAll(
            'gem-menu-item, button[role="menuitemradio"], button[role="menuitem"], button[role="option"], '
            + 'button.bard-mode-list-button, mat-option, [role="option"], '
            + 'li[role="option"], li[role="menuitem"]'
        );
        for (const item of menuItems) {
            if (item.getClientRects().length === 0) continue;
            if (isExtendedMenuItem(item, extendedKeywords)) continue;
            const label = getMenuItemLabel(item).toLowerCase();
            if (matchesModelKeyword(label, kw)) return { element: item, keyword };
        }
    }
    logWarn('No target model found in menu');
    return null;
}

function matchesModelKeyword(text, keyword) {
    if (!text.includes(keyword)) return false;
    if (keyword.includes('-') || keyword.includes(' ')) return true;
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![a-z\\-])${escaped}(?!\\-[a-z])`, 'i');
    return re.test(text);
}

// ─── WAIT HELPERS ─────────────────────────────────────────────────────────────

function waitForSelector(selector, timeout = 10000) {
    return new Promise((resolve) => {
        let resolved = false;
        if (isCancelled) return resolve(null);
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        const obs = new MutationObserver(() => {
            if (resolved) return;
            if (isCancelled) { resolved = true; obs.disconnect(); return resolve(null); }
            const found = document.querySelector(selector);
            if (found) { resolved = true; obs.disconnect(); resolve(found); }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { if (!resolved) { resolved = true; obs.disconnect(); resolve(null); } }, timeout);
    });
}

function waitForMenu(timeout = 2500) {
    return new Promise((resolve) => {
        let resolved = false;
        if (isCancelled) return resolve(null);
        const check = () => document.querySelector(
            'gem-menu[data-visible="true"], gem-menu, [role="menu"], [role="listbox"], '
            + '.mat-mdc-menu-panel, .menu-inner-container, '
            + 'mat-select-panel, [class*="dropdown-panel"], '
            + '[class*="model-menu"], [class*="options-list"], '
            + '[class*="picker-panel"], [class*="selector-panel"]'
        );
        const found = check();
        if (found) return resolve(found);
        const obs = new MutationObserver(() => {
            if (resolved) return;
            if (isCancelled) { resolved = true; obs.disconnect(); return resolve(null); }
            const f = check();
            if (f) { resolved = true; obs.disconnect(); resolve(f); }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { if (!resolved) { resolved = true; obs.disconnect(); resolve(check()); } }, timeout);
    });
}

function waitForModelPicker(timeout = 8000) {
    return new Promise((resolve) => {
        let resolved = false;
        if (isCancelled) return resolve(null);
        const pill = findModelSelectorPill();
        if (pill) return resolve(pill);
        log(STYLES.info, 'Waiting for model picker...');
        const obs = new MutationObserver(() => {
            if (resolved) return;
            if (isCancelled) { resolved = true; obs.disconnect(); return resolve(null); }
            const found = findModelSelectorPill();
            if (found) {
                resolved = true;
                obs.disconnect();
                resolve(found);
            }
        });
        obs.observe(document.body, { childList: true, subtree: true, attributes: true });
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                obs.disconnect();
                logWarn(`Model picker TIMEOUT (${timeout}ms)`);
                resolve(null);
            }
        }, timeout);
    });
}

// ─── TEXT INJECTION ───────────────────────────────────────────────────────────

function injectText(editor, text) {
    editor.focus();
    document.execCommand('selectAll', false, null);
    const ok = document.execCommand('insertText', false, text);

    if (!ok || editor.innerText.trim() !== text.trim()) {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        sel.removeAllRanges();
        sel.addRange(range);
        sel.deleteFromDocument();
        const textNode = document.createTextNode(text);
        editor.appendChild(textNode);
        range.selectNodeContents(editor);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    editor.dispatchEvent(new Event('change', { bubbles: true }));
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
}

// ─── SEND ─────────────────────────────────────────────────────────────────────

function sendMessage(editor) {
    if (isCancelled) return;
    editor.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, cancelable: true,
        key: 'Enter', code: 'Enter', keyCode: 13
    }));

    setTimeout(() => {
        if (isCancelled) return;
        if (editor.innerText.trim().length === 0) {
            log(STYLES.info, 'Sent via Enter key');
            return;
        }
        log(STYLES.info, 'Enter failed, trying send button...');
        const btn = document.querySelector(
            'button[aria-label="Envoyer un message"], '
            + 'button[aria-label="Envoyer le message"], '
            + 'button[aria-label="Envoyer"], '
            + 'button[aria-label="Send message"], '
            + 'button[aria-label="Send"], '
            + 'button[data-test-id="send-button"], '
            + 'button[jsname="vSSGHe"], '
            + 'button[class*="send-button"], '
            + 'button.submit, '
            + '[data-test-id="send-btn"]'
        );
        if (btn && !btn.disabled && btn.getClientRects().length > 0) btn.click();
        else logWarn('No send button found');
    }, 500);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function runScript() {
    if (!query) return;

    // Clean URL immediately so refreshed/restored pages don't keep ?q=
    cleanUrlQuery();

    // Prevent re-sending in the same tab session (e.g. reopened closed tab, page restore)
    if (isQueryAlreadyProcessed(query)) {
        log(STYLES.warn, 'Query already processed in this tab session — ignoring to avoid duplicate sending.');
        return;
    }

    const config = await getConfig();
    if (isCancelled) return;

    logStep('START', `query="${query.substring(0, 40)}..."`);
    log(STYLES.data, 'Config:', JSON.stringify(config, null, 0));

    // Show cancel banner immediately
    createCancelBanner(query);

    // 1. Wait for editor
    logStep('Step 1', 'Waiting for editor...');
    const editorReady = await waitForSelector('div[contenteditable="true"]');
    if (isCancelled || !editorReady) {
        if (!editorReady) logWarn('Editor not found — aborting');
        return;
    }
    log(STYLES.info, 'Editor ready ✓');

    // 2. Wait for model picker
    logStep('Step 2', 'Waiting for model picker...');
    const pickerPill = await waitForModelPicker(8000);
    if (isCancelled) return;
    if (!pickerPill) logWarn('Model picker not found — skipping model switch');
    await new Promise(r => setTimeout(r, 300));
    if (isCancelled) return;

    // 3. Check & switch model + extended thinking
    if (pickerPill) {
        logStep('Step 3', 'Checking current model & extended thinking...');
        const extKeywords = config.EXTENDED_KEYWORDS || [];
        const badModel = currentModelContains(config.MODELS_TO_AVOID);
        const pillExtended = isPillShowingExtended(pickerPill, extKeywords);
        const needExtendedToggle = (typeof config.EXTENDED_THINKING === 'boolean')
            && (pillExtended !== config.EXTENDED_THINKING);

        log(STYLES.info, `Check: badModel=${badModel ? badModel.keyword : 'none'}, pillExtended=${pillExtended}, targetExtended=${config.EXTENDED_THINKING}`);

        if (badModel || needExtendedToggle) {
            pickerPill.click();
            log(STYLES.info, 'Waiting for menu...');
            const menu = await waitForMenu();
            if (isCancelled) {
                closeOpenMenu();
                return;
            }
            await new Promise(r => setTimeout(r, menu
                ? Math.min(config.DELAY_MENU_OPEN, 400)
                : config.DELAY_MENU_OPEN
            ));
            if (isCancelled) {
                closeOpenMenu();
                return;
            }

            // A. Switch model if bad
            if (badModel) {
                const targetModel = findMenuItem(config.TARGET_MODELS, extKeywords);
                if (targetModel) {
                    targetModel.element.click();
                    log(STYLES.match, `Switched to ${targetModel.keyword} ✓`);
                    await new Promise(r => setTimeout(r, config.DELAY_PAGE_LOAD));
                    if (isCancelled) return;
                } else {
                    showNotification('Aucun modèle cible trouvé dans le menu', 'warning');
                }
            }

            // B. Toggle extended thinking if needed
            if (typeof config.EXTENDED_THINKING === 'boolean') {
                let currentMenu = document.querySelector('gem-menu[data-visible="true"], gem-menu, [role="menu"]');
                if (!currentMenu) {
                    const pillNow = findModelSelectorPill() || pickerPill;
                    if (isPillShowingExtended(pillNow, extKeywords) !== config.EXTENDED_THINKING) {
                        pillNow.click();
                        currentMenu = await waitForMenu();
                        await new Promise(r => setTimeout(r, 200));
                    }
                }
                if (currentMenu && !isCancelled) {
                    const toggled = setExtendedThinkingMode(currentMenu, config.EXTENDED_THINKING, extKeywords);
                    if (toggled) {
                        await new Promise(r => setTimeout(r, 300));
                    }
                }
            }

            closeOpenMenu();
        }
    }

    if (isCancelled) return;

    // 4. Inject text
    logStep('Step 4', 'Injecting text...');
    const editor = document.querySelector('div[contenteditable="true"]');
    if (!editor) { logWarn('Editor disappeared'); return; }
    injectText(editor, query);
    textInjectedByExtension = true;

    if (isCancelled) return;

    // 5. Send with live countdown & cancel opportunity
    const sendDelay = (typeof config.DELAY_BEFORE_SEND === 'number') ? config.DELAY_BEFORE_SEND : 1000;
    logStep('Step 5', `Sending in ${sendDelay}ms with cancellation window...`);

    const startTimestamp = Date.now();
    updateBannerCountdown(sendDelay);

    countdownInterval = setInterval(() => {
        if (isCancelled) {
            clearInterval(countdownInterval);
            return;
        }
        const elapsed = Date.now() - startTimestamp;
        const remaining = Math.max(0, sendDelay - elapsed);
        updateBannerCountdown(remaining);
        if (remaining <= 0) {
            clearInterval(countdownInterval);
        }
    }, 100);

    sendTimeoutId = setTimeout(() => {
        clearInterval(countdownInterval);
        if (isCancelled) return;
        sendMessage(editor);
        markQueryProcessed(query, 'sent');
        dismissBanner();
    }, sendDelay);
}

runScript();
