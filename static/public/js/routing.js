import { initializeDashboard } from './video.js';
import { applyTranslations } from './i18n.js';

const contentContainer = document.getElementById('content-container');

// A list of page *names* that have language-specific HTML partials.
// All other pages are treated as language-independent templates.
const translatablePageNames = ['landing'];

/**
 * Fetches an HTML page and loads it into the content container.
 * @param {string} pagePath The path of the page to load (e.g., '/landing.html', '/protected/dashboard.html').
 */
const loadContent = async (pagePath) => {
    const lang = localStorage.getItem('userLanguage') || 'en';
    
    // Extract the base name of the page (e.g., 'landing' from '/landing.html')
    const pageName = pagePath.split('/').pop().replace('.html', '');
    
    let finalUrl;
    // Check if the page is one that we have translated HTML partials for.
    if (translatablePageNames.includes(pageName)) {
        finalUrl = `/locales/${lang}/${pageName}.html`;

    } else {
        // Otherwise, assume it's a language-independent template.
        finalUrl = pagePath;
    }

    try {
        let response = await fetch(finalUrl);

        // If the language-specific page wasn't found, try falling back to the English version.
        if (!response.ok && translatablePageNames.includes(pageName) && lang !== 'en') {
            console.warn(`Could not find '${finalUrl}'. Falling back to English version.`);
            const fallbackUrl = `/locales/en/${pageName}.html`;
            response = await fetch(fallbackUrl);
        }

        if (response.status === 401) { window.location.hash = '/login.html'; return; }
        if (!response.ok) { throw new Error(`Failed to load page: ${response.statusText} (${response.status})`); }

        contentContainer.innerHTML = await response.text();
        applyTranslations(); // Apply translations to any data-i18n elements in the new content.

    } catch (error) {
        contentContainer.innerHTML = `<p>Error loading page: ${error.message}</p>`;
        console.error('Failed to load content:', error);
        
    } finally {
        if (pageName === 'dashboard') { initializeDashboard(); }
    }
};

export const handleRouting = async () => {
    const path = window.location.hash.substring(1) || '/landing.html';
    await loadContent(path);
};