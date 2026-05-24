// DEFAULT_CONFIG is loaded from config.js
// Gemini Ultimate v1.8 — Compatible Neural Expressive redesign (Google I/O 2026)
// Fixes: model picker moved to header, pill prompt box, SPA-safe injection

// ─── CONFIG ──────────────────────────────────────────────────────────────────

async function getConfig() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['config'], (result) => {
            resolve(result.config || DEFAULT_CONFIG);
        });
    });
}

const params = new URLSearchParams(window.location.search);
const query  = params.get('q');

// ─── NOTIFICATION ─────────────────────────────────────────────────────────────

function showNotification(message, type = 'error') {
    const existing = document.getElementById('gemini-ultimate-notification');
    if (existing) existing.remove();

    if (!document.getElementById('gemini-ultimate-style')) {
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
        `;
        document.head.appendChild(style);
    }

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

// ─── MODEL PICKER ─────────────────────────────────────────────────────────────

/**
 * Cherche le bouton sélecteur de modèle.
 *
 * Ordre de priorité (du plus stable au plus fragile) :
 *   1. data-test-id spécifiques Gemini
 *   2. Sélecteurs stables par rôle/aria dans le HEADER (nouveau "Neural Expressive")
 *   3. Anciens sélecteurs (zone de saisie, pill)
 *   4. Fallback texte : tout bouton visible contenant un nom de modèle connu
 *
 * NOTE: Depuis le redesign "Neural Expressive" (Google I/O 2026), le picker
 * est dans le HEADER (coin supérieur gauche), plus dans la zone de saisie.
 * Les deux emplacements sont couverts pour rester rétrocompatible.
 */
function findModelSelectorPill() {
    // ── Groupe 1 : data-test-id Gemini (les plus stables) ──
    const stableSelectors = [
        '[data-test-id="model-picker-trigger"]',
        '[data-test-id="model-selector-trigger"]',
        '[data-test-id="model-chip"]',
        'button[data-test-id*="model"]',
        // Composant custom Angular / Web Component
        'model-selector-chip button',
        'model-picker button',
    ];
    for (const sel of stableSelectors) {
        const el = document.querySelector(sel);
        if (el && el.getClientRects().length > 0) return el;
    }

    // ── Groupe 2 : Header (nouveau layout Neural Expressive) ──
    // Le picker est maintenant en haut à gauche, souvent dans un <header> ou nav
    const headerContainers = document.querySelectorAll(
        'header, [role="banner"], nav, .app-header, [class*="header"], [class*="top-bar"]'
    );
    const MODEL_KW = ['flash', 'thinking', 'pro', 'ultra', 'nano', 'lite'];
    for (const container of headerContainers) {
        const btns = container.querySelectorAll('button, [role="button"], [role="combobox"]');
        for (const btn of btns) {
            if (btn.getClientRects().length === 0) continue;
            const text = (btn.textContent + ' ' + (btn.getAttribute('aria-label') || '')).toLowerCase();
            if (MODEL_KW.some(k => text.includes(k)) && text.length < 80) return btn;
        }
    }

    // ── Groupe 3 : Anciens sélecteurs (zone de saisie / pill) ──
    const legacySelectors = [
        'button.input-area-switch',
        '.logo-pill-label-container',
        '.input-area-switch-label',
        '[class*="model-selector"] button',
        '[class*="model-chip"]',
        'button[aria-label*="Flash"]',
        'button[aria-label*="flash"]',
        'button[aria-label*="modèle"]',
        'button[aria-label*="model"]',
        'button[aria-haspopup="listbox"]',
        'button[aria-haspopup="menu"]',
        '[role="combobox"]',
    ];
    for (const sel of legacySelectors) {
        const el = document.querySelector(sel);
        if (el && el.getClientRects().length > 0) return el;
    }

    // ── Groupe 4 : Fallback texte global (dernier recours) ──
    const allButtons = document.querySelectorAll('button, [role="button"]');
    for (const btn of allButtons) {
        if (btn.getClientRects().length === 0) continue;
        // Exclure les boutons dans des modales/overlays non liées
        if (btn.closest('[role="dialog"], [role="alertdialog"]')) continue;
        const text = (btn.textContent + ' ' + (btn.getAttribute('aria-label') || '')).toLowerCase().trim();
        if (MODEL_KW.some(k => text.includes(k)) && text.length < 60) return btn;
    }

    return null;
}

function currentModelContains(keywords) {
    const pill = findModelSelectorPill();
    if (!pill) return null;
    const text = (pill.textContent + ' ' + (pill.getAttribute('aria-label') || '')).toLowerCase().trim();
    for (const kw of keywords) {
        if (text.includes(kw.toLowerCase().trim())) return { element: pill, keyword: kw };
    }
    return null;
}

// ─── MENU ITEMS ───────────────────────────────────────────────────────────────

function findMenuItem(keywords) {
    for (const keyword of keywords) {
        const kw = keyword.toLowerCase().trim();

        // M1 : data-test-id (plus stable)
        const escapedKw = CSS.escape(kw);
        const byId = document.querySelector(
            `[data-test-id*="${escapedKw}" i], button[data-test-id*="${escapedKw}" i]`
        );
        if (byId && byId.getClientRects().length > 0) return { element: byId, keyword };

        // M2 : Span / libellé texte dans les items de menu
        const labelEls = document.querySelectorAll(
            '.mode-title, .gds-label-l, '
            + '[class*="option-title"], [class*="model-name"], [class*="model-title"], '
            + 'mat-option span, [role="option"] span, '
            + '[role="menuitem"] span, [role="menuitemradio"] span, '
            + 'li span, [class*="list-item"] span'
        );
        for (const el of labelEls) {
            if ((el.textContent || '').toLowerCase().trim().includes(kw)) {
                const btn = el.closest(
                    'button, [role="menuitemradio"], [role="menuitem"], [role="option"], mat-option, li'
                );
                if (btn && btn.getClientRects().length > 0) return { element: btn, keyword };
            }
        }

        // M3 : Items de menu complets (texte entier)
        const menuItems = document.querySelectorAll(
            'button[role="menuitemradio"], button[role="menuitem"], button[role="option"], '
            + 'button.bard-mode-list-button, mat-option, [role="option"], '
            + 'li[role="option"], li[role="menuitem"]'
        );
        for (const item of menuItems) {
            if (item.getClientRects().length === 0) continue;
            if ((item.textContent || '').toLowerCase().includes(kw)) return { element: item, keyword };
        }
    }
    return null;
}

// ─── WAIT HELPERS ─────────────────────────────────────────────────────────────

function waitForSelector(selector, timeout = 10000) {
    return new Promise((resolve) => {
        let resolved = false;
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        const obs = new MutationObserver(() => {
            if (resolved) return;
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
        // Couvre l'ancien menu Material ET les nouveaux menus/dropdowns
        const check = () => document.querySelector(
            '[role="menu"], [role="listbox"], [role="dialog"], '
            + '.mat-mdc-menu-panel, .menu-inner-container, '
            + 'mat-select-panel, [class*="dropdown-panel"], '
            + '[class*="model-menu"], [class*="options-list"], '
            + '[class*="picker-panel"], [class*="selector-panel"]'
        );
        const found = check();
        if (found) return resolve(found);
        const obs = new MutationObserver(() => {
            if (resolved) return;
            const f = check();
            if (f) { resolved = true; obs.disconnect(); resolve(f); }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { if (!resolved) { resolved = true; obs.disconnect(); resolve(check()); } }, timeout);
    });
}

// ─── TEXT INJECTION ───────────────────────────────────────────────────────────

/**
 * Injecte du texte dans un contenteditable.
 * Utilise d'abord execCommand (compatible, déclenche React/Angular state),
 * puis Selection/Range en fallback si le premier échoue.
 */
function injectText(editor, text) {
    editor.focus();

    // Méthode 1 : execCommand (encore fonctionnel en 2026, conserve l'undo-stack)
    document.execCommand('selectAll', false, null);
    const ok = document.execCommand('insertText', false, text);

    if (!ok || editor.innerText.trim() !== text.trim()) {
        // Méthode 2 : Selection + Range API (fallback moderne)
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

    // Déclencher les événements React/Angular/Lit
    editor.dispatchEvent(new Event('change', { bubbles: true }));
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
}

// ─── SEND ─────────────────────────────────────────────────────────────────────

function sendMessage(editor) {
    // Priorité 1 : Touche Entrée (méthode universelle)
    editor.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, cancelable: true,
        key: 'Enter', code: 'Enter', keyCode: 13
    }));

    // Priorité 2 : Bouton d'envoi (fallback)
    // Couvre les anciens et nouveaux aria-label Gemini (FR + EN + Neural Expressive)
    // Ne s'exécute que si l'éditeur contient encore du texte (= Enter n'a pas fonctionné)
    setTimeout(() => {
        if (editor.innerText.trim().length === 0) return;
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
    }, 500);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function runScript() {
    if (!query) return;

    const config = await getConfig();

    // 1. Attendre que la zone de saisie soit prête (pill ou rect)
    //    Gemini Neural Expressive = pill-shaped, toujours contenteditable
    const editorReady = await waitForSelector('div[contenteditable="true"]');
    if (!editorReady) return;

    // Délai minimal pour stabiliser l'UI après hydratation Angular/Lit
    await new Promise(r => setTimeout(r, 500));

    // 2. Vérifier si le modèle actuel doit être changé
    const badModel = currentModelContains(config.MODELS_TO_AVOID);

    // 3. Changer de modèle si nécessaire
    if (badModel) {
        badModel.element.click();

        const menu = await waitForMenu();
        // Délai adaptatif : réduit si le menu est déjà là
        await new Promise(r => setTimeout(r, menu
            ? Math.min(config.DELAY_MENU_OPEN, 400)
            : config.DELAY_MENU_OPEN
        ));

        const targetModel = findMenuItem(config.TARGET_MODELS);

        if (targetModel) {
            targetModel.element.click();
            // Attendre la mise à jour du picker
            await new Promise(r => setTimeout(r, config.DELAY_PAGE_LOAD));
        } else {
            showNotification('Aucun modèle cible trouvé dans le menu', 'warning');
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        }
    }

    // 4. Injecter le texte
    const editor = document.querySelector('div[contenteditable="true"]');
    if (!editor) return;

    injectText(editor, query);

    // Nettoyer le ?q= de l'URL (évite une double soumission en cas de reload)
    // Préserve les autres paramètres éventuels (hl=, etc.) pour ne pas casser le SPA
    const cleanParams = new URLSearchParams(window.location.search);
    cleanParams.delete('q');
    const cleanSearch = cleanParams.toString();
    const cleanUrl = window.location.pathname + (cleanSearch ? '?' + cleanSearch : '');
    window.history.replaceState({}, document.title, cleanUrl);

    // 5. Envoyer
    setTimeout(() => sendMessage(editor), config.DELAY_BEFORE_SEND);
}

runScript();
