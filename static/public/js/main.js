import { getCookie } from "./utils.js";
import { handleRouting } from "./routing.js";
import { initializeLanguageSwitcher, loadInitialLanguage } from "./ui.js";
import { applyTranslations } from './i18n.js';
import { updateAuthUI, handleFormSubmit } from './auth.js'
import { playVideo } from './video.js';

const contentContainer = document.getElementById('content-container');


// --- EVENT LISTENERS ---

// Handle clicks on navigation links and the logout button
document.body.addEventListener('click', async (event) => {
    // Check if the clicked element or its parent is a nav-link.
    // This handles cases where the link has nested elements (like <strong>).
    const navLink = event.target.closest('.nav-link');

    if (navLink) {
        event.preventDefault();
        window.location.hash = new URL(navLink.href).pathname;
    }

    // For the logout link
    if (event.target.matches('#logout-link')) {
        event.preventDefault();
        const csrfToken = getCookie('csrf_token');
        await fetch('/api/logout', {
            method: 'POST',
            headers: { 'X-CSRF-Token': csrfToken }
        });
        await updateAuthUI();
        // After logout, go back to the landing page by setting the hash.
        window.location.hash = '/landing.html';
    }
});

// Handle form submissions within the dynamic content area
contentContainer.addEventListener('submit', (event) => {
    if (event.target.matches('#login-form') || event.target.matches('#signup-form')) {
        handleFormSubmit(event);
    }
});

// Handle clicks within the dynamic content area (e.g., video links)
contentContainer.addEventListener('click', (event) => {
    const videoLink = event.target.closest('.video-link');
    if (videoLink) {
        event.preventDefault();
        playVideo(videoLink.dataset.videoKey);
    }
});

// Listen for hash changes (e.g., back/forward buttons, or programmatic changes)
window.addEventListener('hashchange', handleRouting);

// Initial page setup
document.addEventListener('DOMContentLoaded', async () => {
    const body = document.body;
    const loader = document.getElementById('page-loader');

    try {
        // Run auth check and language detection in parallel for a faster startup.
        await Promise.all([
            updateAuthUI(),
            loadInitialLanguage()
        ]);

        initializeLanguageSwitcher();
        applyTranslations(); // Apply translations to the static shell (e.g., nav 'Overview')
        await handleRouting(); // Load the initial page content

    } catch (error) {
        console.error("Initialization failed:", error);
        // You could display a permanent error message here if needed
    } finally {
        // Fade out and remove the loader, then reveal the content.
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 300); // Remove after transition
        }
        body.classList.remove('is-loading');
    }
});