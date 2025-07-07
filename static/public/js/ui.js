import { setLanguage, applyTranslations } from './i18n.js';
import { handleRouting } from './routing.js';

/**
 * A map to associate language codes with their display details.
 * This makes adding new languages much easier in the future.
 */
const langDetails = {
    en: { name: 'English', src: '/img/flags/us.svg', alt: 'English' },
    de: { name: 'Deutsch', src: '/img/flags/at.svg', alt: 'Deutsch' }
};

/**
 * Populates the language dropdown menu from the langDetails object.
 * @param {HTMLElement} dropdown The <ul> element to populate.
 */
const populateLanguageDropdown = (dropdown) => {
    const listItems = Object.entries(langDetails).map(([code, details]) => {
        return `<li><a href="#" data-lang="${code}"><img src="${details.src}" alt="${details.alt}"> ${details.name}</a></li>`;
    }).join('');
    dropdown.innerHTML = listItems;
};

/**
 * Updates the language switcher button to display the flag for the given language.
 * @param {string} langCode The language code (e.g., 'en', 'de').
 */
const setDisplayLanguage = (langCode) => {
    const currentLangButton = document.querySelector('.language-switcher .current-lang');
    if (!currentLangButton) return;

    const details = langDetails[langCode];
    if (!details) return; // Do nothing if the language code is invalid

    const currentImg = currentLangButton.querySelector('img');
    currentImg.src = details.src;
    currentImg.alt = details.alt;
    currentImg.dataset.lang = langCode;
};

/**
 * Initializes the language switcher UI component.
 */
export const initializeLanguageSwitcher = () => {
    const switcher = document.querySelector('.language-switcher');
    if (!switcher) return;

    const currentLangButton = switcher.querySelector('.current-lang');
    const dropdown = switcher.querySelector('.lang-dropdown');

    // Dynamically create the dropdown options
    populateLanguageDropdown(dropdown);

    currentLangButton.addEventListener('click', (event) => {
        event.stopPropagation();
        const isExpanded = dropdown.classList.toggle('is-open');
        currentLangButton.setAttribute('aria-expanded', isExpanded);
    });

    dropdown.addEventListener('click', async (event) => {
        const langLink = event.target.closest('a[data-lang]');
        if (langLink) {
            event.preventDefault();
            const selectedLang = langLink.dataset.lang;
            const currentLang = localStorage.getItem('userLanguage');

            setDisplayLanguage(selectedLang);
            localStorage.setItem('userLanguage', selectedLang); // Persist the choice

            if (selectedLang !== currentLang) {
                await setLanguage(selectedLang); // Load new JSON for shared snippets
                applyTranslations(); // Translate shared snippets like the nav bar

                const currentHash = window.location.hash.substring(1);
                // If on a course page, redirect to dashboard as requested.
                if (currentHash.startsWith('/protected/course/')) {
                    window.location.hash = '/protected/dashboard.html';
                } else {
                    // For all other pages, just reload the content to get the new HTML partial.
                    handleRouting();
                }
            }

            dropdown.classList.remove('is-open');
            currentLangButton.setAttribute('aria-expanded', 'false');
        }
    });

    window.addEventListener('click', () => {
        if (dropdown.classList.contains('is-open')) {
            dropdown.classList.remove('is-open');
            currentLangButton.setAttribute('aria-expanded', 'false');
        }
    });
};

/**
 * Applies the stored language preference from localStorage on page load.
 */
export const loadInitialLanguage = async () => {
    const storedLang = localStorage.getItem('userLanguage');

    if (storedLang) {
        // If user has manually selected a language, respect their choice.
        setDisplayLanguage(storedLang);
        await setLanguage(storedLang);
        return; // Exit early
    }

    // If no language is stored, try to detect it from their location.
    let langToSet = 'en'; // Default to English
    try {
        // Using a free, simple geolocation API.
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) throw new Error('Geolocation fetch failed');

        const data = await response.json();
        const country = data.country_code;

        // Set German for Austria, Germany, or Switzerland.
        if (['AT', 'DE', 'CH'].includes(country)) {
            langToSet = 'de';
        }
        console.log(`Detected country ${country}, setting language to ${langToSet}`);
    } catch (error) {
        console.warn('Could not detect language from location, defaulting to English.', error);
    } finally {
        setDisplayLanguage(langToSet);
        localStorage.setItem('userLanguage', langToSet); // Save for next time
        await setLanguage(langToSet);
    }
};