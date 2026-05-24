// Shared default configuration for Gemini Ultimate
// Keywords are matched as substrings (case-insensitive) against model names.
// Gemini uses names like "3.5 Flash", "3.5 Thinking", "3.1 Pro", "Flash-Lite".
// Both logged-in and logged-out states are supported.
const DEFAULT_CONFIG = {
    // Modèles cibles (les plus rapides en priorité)
    // "Flash-Lite" est plus spécifique → testé en premier (substring matching)
    // "Flash" matche : 3.5 Flash, 1.5 Flash, etc.
    TARGET_MODELS: ['Flash-Lite', 'Flash'],
    // Modèles à éviter (lents / coûteux)
    MODELS_TO_AVOID: ['Thinking', 'Raisonnement', 'réflexion', 'Pro', 'Deep Research', 'Ultra'],
    // Délais en ms — réduits pour plus de rapidité
    DELAY_MENU_OPEN: 500,
    DELAY_PAGE_LOAD: 800,
    DELAY_BEFORE_SEND: 700
};
