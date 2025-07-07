import { getCookie } from "./utils.js";

const authLinks = document.getElementById('auth-links');


/**
 * Updates the navigation bar based on the user's login status.
 */
export const updateAuthUI = async () => {
    try {
        const response = await fetch('/api/check-auth');
        if (response.ok) {
            // User is logged in
            authLinks.innerHTML = `
                <li><a href="/protected/dashboard.html" class="nav-link">Videos</a></li>
                <li><a href="#" id="logout-link">Logout</a></li>
            `;
        } else {
            // User is logged out
            authLinks.innerHTML = `
                <li><a href="/signup.html" class="nav-link secondary">Sign Up</a></li>
                <li><a href="/login.html" class="nav-link">Login</a></li>
            `;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        authLinks.innerHTML = `<li><a href="/login.html" class="nav-link">Login</a></li>`;
    }
};

/**
 * Handles form submissions for both login and signup.
 * @param {Event} event The form submission event.
 */
export const handleFormSubmit = async (event) => {
    const form = event.target;
    const endpoint = form.id === 'login-form' ? '/api/login' : '/api/signup';
    event.preventDefault();

    const authFormContainer = form.closest('.auth-form');
    const errorMessage = authFormContainer ? authFormContainer.querySelector('#error-message') : null;
    if (errorMessage) errorMessage.textContent = '';

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const csrfToken = getCookie('csrf_token');

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken,
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.message || 'An error occurred.');
        }

        // On success, update the UI and change the hash to the dashboard/video page.
        // The hashchange event listener will handle loading the content.
        await updateAuthUI();
        window.location.hash = '/protected/dashboard.html';
        console.log("Hash after form submit:", window.location.hash);

    } catch (error) {
        if (errorMessage) errorMessage.textContent = error.message;
        console.error(`Error during ${endpoint}:`, error);
    }
};