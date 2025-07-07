import { getCookie } from "./utils.js";
import { handleRouting } from "./routing.js";
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
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    // Load the initial content based on the current URL hash
    handleRouting();
});