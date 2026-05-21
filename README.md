# Gemini Ultimate Extension

Une extension Chrome puissante (et un script Tampermonkey) pour automatiser et améliorer votre expérience sur [Gemini](https://gemini.google.com/).

## 🌟 Fonctionnalités

- **Sélection du Modèle Préféré** : Sélectionne vos modèles préférés (ex: "Flash", "Rapid", "3.5 Flash") s'ils ne sont pas actifs par défaut.
- **Envoi rapide** : Remplit et envoie automatiquement votre prompt via une URL paramétrée.
- **Interface de Configuration** : Ajustez facilement vos modèles cibles et les délais d'exécution via un popup moderne (Thème sombre Gemini).
- **Mode Sans Compte** : Compatible avec la version publique de Gemini (sans être connecté à un compte Google).
- **Compatible Neural Expressive** : Support total de la nouvelle interface Gemini (Google I/O 2026).

## 💡 Comment ça marche ?

Google Gemini supporte nativement un **paramètre de requête dans l'URL** : `https://gemini.google.com/app?q=%s`

Le `%s` est remplacé par votre texte, ce qui permet de pré-remplir automatiquement le champ de saisie. Cette extension exploite cette fonctionnalité en :

1. **Détectant le paramètre `?q=`** dans l'URL
2. **Sélectionnant votre modèle préféré** (Flash/Rapid) si un autre modèle est actif
3. **Envoyant automatiquement le prompt** sans intervention manuelle

Cela vous permet d'obtenir des réponses instantanées avec le modèle **fast** de Google, directement depuis votre barre d'adresse !

## 🚀 Installation (Extension Chrome)

C'est la méthode la plus simple et recommandée. Cliquez simplement sur le lien ci-dessous pour l'ajouter à Chrome :

[**Télécharger sur le Chrome Web Store**](https://chromewebstore.google.com/detail/gemini-ultimate/jhpkldiddcobahfolmjiobbacjbgdegl?authuser=0&hl=en-GB)

### Installation Manuelle (Pour les développeurs)

1.  Clonez ce dépôt ou téléchargez les fichiers.
2.  Ouvrez Google Chrome et allez sur `chrome://extensions`.
3.  Activez le **Mode développeur** (en haut à droite).
4.  Cliquez sur **Charger l'extension non empaquetée**.
5.  Sélectionnez le dossier `Extension` situé dans ce projet.

## ⚡ Utilisation Rapide (Barre d'adresse)

Pour utiliser l'extension à son plein potentiel, configurez un moteur de recherche personnalisé dans votre navigateur :

1.  Allez dans les **Paramètres** de votre navigateur > **Moteur de recherche** > **Gérer les moteurs de recherche et la recherche sur le site**.
2.  À côté de "Recherche sur le site", cliquez sur **Ajouter**.
3.  Remplissez les champs comme suit :
    *   **Nom** : `Gemini Search`
    *   **Raccourci** : `:ai` (ou ce que vous préférez)
    *   **URL avec %s à la place de la requête** : `https://gemini.google.com/app?q=%s`

**Utilisation :**
Tapez simplement `:ai` + `Espace` + `Votre question` dans la barre d'adresse. L'extension se chargera de choisir le bon modèle et d'envoyer votre message !

---

## 🐒 Alternative Tampermonkey

Si vous ne souhaitez pas installer l'extension complète, vous pouvez utiliser ce script Tampermonkey.

### Installation
1.  Installez l'extension [Tampermonkey](https://www.tampermonkey.net/).
2.  Créez un nouveau script.
3.  Copiez-collez le code ci-dessous :

```javascript
// ==UserScript==
// @name         Gemini Ultimate (Legacy Script)
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  Force le modèle (supporte plusieurs alias), remplit et envoie.
// @author       Lucas_M54
// @match        https://gemini.google.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ================= CONFIGURATION =================
    const CONFIG = {
        TARGET_MODELS: ['3.5 Flash', 'Flash', 'Rapid', 'Fast'],
        MODELS_TO_AVOID: ['3.5 Thinking', '3.1 Pro', 'Thinking', 'Raisonnement'],
        DELAY_MENU_OPEN: 50,
        DELAY_PAGE_LOAD: 50,
        DELAY_BEFORE_SEND: 50
    };
    // =================================================

    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');

    function findClickableByText(text) {
        if (!text) return null;
        const textLower = text.toLowerCase();
        const xpath = \`//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '\${textLower}') or contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '\${textLower}')]\`;
        const snapshot = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for (let i = 0; i < snapshot.snapshotLength; i++) {
            let el = snapshot.snapshotItem(i);
            let current = el;
            while (current && current.tagName !== 'BODY') {
                const style = window.getComputedStyle(current);
                if (style.display === 'none' || style.visibility === 'hidden') break;
                const role = current.getAttribute('role');
                const tagName = current.tagName;
                if (tagName === 'BUTTON' || role === 'button' || role === 'menuitem') return current;
                current = current.parentElement;
            }
        }
        return null;
    }

    function waitForSelector(selector) {
        return new Promise(resolve => {
            const el = document.querySelector(selector);
            if (el) return resolve(el);
            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) { resolve(el); observer.disconnect(); }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    async function runScript() {
        if (!query) return;
        await waitForSelector('div[contenteditable="true"]');
        await new Promise(r => setTimeout(r, 800));

        let activeSwitchBtn = null;
        let foundBadKeyword = false;

        for (const badKeyword of CONFIG.MODELS_TO_AVOID) {
            const btn = findClickableByText(badKeyword);
            if (btn) {
                activeSwitchBtn = btn;
                foundBadKeyword = true;
                break;
            }
        }

        if (foundBadKeyword && activeSwitchBtn) {
            activeSwitchBtn.click();
            await new Promise(r => setTimeout(r, CONFIG.DELAY_MENU_OPEN));
            for (const targetName of CONFIG.TARGET_MODELS) {
                const targetOption = findClickableByText(targetName);
                if (targetOption) {
                    targetOption.click();
                    await new Promise(r => setTimeout(r, CONFIG.DELAY_PAGE_LOAD));
                    break;
                }
            }
        }

        const editor = await waitForSelector('div[contenteditable="true"]');
        editor.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, query);
        window.history.replaceState({}, document.title, window.location.pathname);

        setTimeout(() => {
            const sendButton = document.querySelector('button[aria-label="Envoyer"], button[aria-label="Send"], button[aria-label*="message"]');
            if (sendButton && !sendButton.disabled) {
                sendButton.click();
            } else {
                editor.dispatchEvent(new Event('input', { bubbles: true }));
                setTimeout(() => sendButton?.click(), 200);
            }
        }, CONFIG.DELAY_BEFORE_SEND);
    }
    runScript();
})();
```
