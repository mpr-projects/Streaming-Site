/**
 * Reads a cookie by name.
 * @param {string} name The name of the cookie.
 * @returns {string|null} The cookie value or null.
 */
export const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
};