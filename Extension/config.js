// Shared default configuration for Gemini Ultimate
// Keywords are matched as substrings (case-insensitive) against model names.
// Gemini uses names like "3.5 Flash-Lite", "3.7 Flash", "3.1 Pro",
// and a separate "Extended thinking" mode below a divider.
// Both logged-in and logged-out states are supported.
const DEFAULT_CONFIG = {
    // Modèles cibles (les plus rapides en priorité)
    // "Flash-Lite" est plus spécifique → testé en premier (substring matching)
    // "Flash" matche : 3.7 Flash, 3.5 Flash, etc.
    TARGET_MODELS: ['Flash-Lite', 'Flash'],
    // Modèles à éviter (lents / coûteux)
    MODELS_TO_AVOID: ['Pro', 'Deep Research', 'Ultra'],
    // Activer ou non le mode Raisonnement étendu (Extended thinking)
    EXTENDED_THINKING: false,
    // Mots-clés pour identifier le mode ou badge Raisonnement étendu / Extended thinking
    EXTENDED_KEYWORDS: ['Raisonnement étendu', 'Extended thinking', 'Thinking', 'Raisonnement', 'réflexion', 'Extended'],
    // Délais en ms
    DELAY_MENU_OPEN: 500,
    DELAY_PAGE_LOAD: 800,
    DELAY_BEFORE_SEND: 1000,
    // Debug logs in browser console
    DEBUG_LOGS: false
};
