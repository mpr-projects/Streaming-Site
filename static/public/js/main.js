const contentContainer = document.getElementById('content-container');
const authLinks = document.getElementById('auth-links');

/**
 * Reads a cookie by name.
 * @param {string} name The name of the cookie.
 * @returns {string|null} The cookie value or null.
 */
const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
};

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
 * Updates the navigation bar based on the user's login status.
 */
const updateAuthUI = async () => {
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
const handleFormSubmit = async (event) => {
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

/**
 * Determines which page to load based on the URL hash.
 */
const handleRouting = () => {
    // Get the path from the hash, remove the leading '#', or default to landing page.
    const path = window.location.hash.substring(1) || '/landing.html';
    loadContent(path);
};

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
        const videoKey = videoLink.dataset.videoKey;
        playVideo(videoKey);
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


// Dashboard/video page specific functionality (to be called after content is loaded)
const initializeDashboard = async (currentPageUrl) => {
    console.log("initializeDashboard called for page:", currentPageUrl);
    if (currentPageUrl === '/protected/dashboard.html') {
        await loadVideoList();
    }
};


const loadVideoList = async () => {
    console.log("in loadVideoList");
    const videoListContainer = document.getElementById('video-list');
    const videoPlayer = document.getElementById('main-video-player');

    if (!videoListContainer || !videoPlayer) {
        console.error("Video elements not found on dashboard.");
        return;
    }
    try {
        const csrfToken = getCookie('csrf_token');
        const response = await fetch('/api/videos', {
            headers: {
                'X-CSRF-Token': csrfToken,
            },
        });
        if (!response.ok) throw new Error(`Failed to load video list: ${response.statusText}`);

        const videos = await response.json();

        if (videos.length === 0) {
            videoListContainer.innerHTML = "<p>No videos available. An admin needs to upload some.</p>";

        } else {
            let videoListHTML = `<ul>`;  // style="list-style-type: none; padding: 0;">`;
            videos.forEach(video => {
                const videoName = video.key;
                const label = video.label;
                const thumbnailUrl = video.thumbnail_url;
                
                videoListHTML += `<li class="video-link" data-video-key="${video.key}">`;

                if (thumbnailUrl) {
                    videoListHTML += `<img src="${thumbnailUrl}" alt="Thumbnail for ${label}">`;

                } else {
                    videoListHTML += `<div class="thumbnail-placeholder">No Thumbnail</div>`;
                }

                videoListHTML += `<span>${label}</span>`;
                videoListHTML += `</li>`;
            });
            videoListHTML += "</ul>";
            videoListContainer.innerHTML = videoListHTML;
        }

    } catch (error) {
        console.error("Error loading videos:", error);
        videoListContainer.innerHTML = `<p>Error loading videos: ${error.message}</p>`;
    }
};

const playVideo = async (videoKey) => {
    const videoPlayer = document.getElementById('main-video-player');

    // First, remove the 'is-playing' class from any currently highlighted item
    const currentlyPlaying = document.querySelector('.video-link.is-playing');
    if (currentlyPlaying) {
        currentlyPlaying.classList.remove('is-playing');
    }    

    // Then, add the class to the item that was just clicked
    const newPlayingItem = document.querySelector(`.video-link[data-video-key="${videoKey}"]`);
    if (newPlayingItem) {
        newPlayingItem.classList.add('is-playing');
    }

    try {
        const csrfToken = getCookie('csrf_token');
        const response = await fetch(`/api/stream/${encodeURIComponent(videoKey)}`, {
            headers: {
                'X-CSRF-Token': csrfToken,
            },
        });
        if (!response.ok) throw new Error(`Failed to get video URL: ${response.statusText}`);

        const { url } = await response.json();
        videoPlayer.src = url;
        videoPlayer.play();
        
    } catch (error) {
        console.error("Error playing video:", error);
        // Consider showing an error message to the user in the UI
    }
};
