let translations = {};

/**
 * Fetches the translation file for the given language.
 * @param {string} lang - The language code (e.g., 'en', 'de').
 * @returns {Promise<void>}
 */
export const setLanguage = async (lang) => {
    try {
        const response = await fetch(`/locales/${lang}.json`);
        if (!response.ok) {
            throw new Error(`Could not load translation file for language: ${lang}`);
        }
        translations = await response.json();
        document.documentElement.lang = lang; // Set the lang attribute on the <html> tag
        console.log(`Language set to ${lang}`);
    } catch (error) {
        console.error(error);
        // Fallback to English if the requested language fails to load
        if (lang !== 'en') {
            await setLanguage('en');
        }
    }
};

/**
 * Applies the loaded translations to all elements with a data-i18n attribute.
 */
export const applyTranslations = () => {
    // 1. Translate text content
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[key]) {
            // Use textContent to prevent HTML injection vulnerabilities
            element.textContent = translations[key];
        }
    });

    // 2. Translate attributes like 'placeholder', 'title', etc.
    const translatableAttributes = ['placeholder', 'title', 'aria-label'];
    translatableAttributes.forEach(attr => {
        document.querySelectorAll(`[data-i18n-${attr}]`).forEach(element => {
            const key = element.getAttribute(`data-i18n-${attr}`);
            if (translations[key]) {
                element.setAttribute(attr, translations[key]);
            }
        });
    });
};