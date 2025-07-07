import { getCookie } from "./utils.js";


// Dashboard/video page specific functionality (to be called after content is loaded)
export const initializeDashboard = async (currentPageUrl) => {
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

export const playVideo = async (videoKey) => {
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
