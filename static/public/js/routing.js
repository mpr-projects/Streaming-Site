import { initializeDashboard } from './video.js'

const contentContainer = document.getElementById('content-container');


/**
 * Fetches an HTML page and loads it into the content container.
 * This function does NOT handle URL/hash changes.
 * @param {string} pageUrl The URL of the page to load.
 */
const loadContent = async (pageUrl) => {
    try {
        const response = await fetch(pageUrl);
        if (!response.ok) {
            // If the user is not authorized for a resource, redirect to the login page.
            if (response.status === 401) {
                window.location.hash = '/login.html';
                return;
            }
            // For other errors (e.g., 404), throw an error to be caught below.
            throw new Error(`Failed to load page: ${response.statusText}`);
        }
        contentContainer.innerHTML = await response.text();
        console.info(`Successfully loaded content for: ${pageUrl}`);
        
    } catch (error) {
        contentContainer.innerHTML = `<p>Error loading page: ${error.message}</p>`;
        console.error('Failed to load content:', error);

    } finally {
        initializeDashboard(pageUrl);
    }
};


/**
 * Determines which page to load based on the URL hash.
 */
export const handleRouting = () => {
    // Get the path from the hash, remove the leading '#', or default to landing page.
    const path = window.location.hash.substring(1) || '/landing.html';
    loadContent(path);
};