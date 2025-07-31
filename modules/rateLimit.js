// rateLimit.js

let rateLimited = false;

/**
 * Intercepts all Axios responses to detect 429 errors (rate-limiting),
 * and reveals a banner with ID 'rateLimitBanner' once if triggered.
 */
export function installRateLimitBanner() {
  axios.interceptors.response.use(
    response => response,
    error => {
      if (error.response?.status === 429 && !rateLimited) {
        rateLimited = true;
        const banner = document.getElementById('rateLimitBanner');
        if (banner) banner.style.display = 'block';
      }
      return Promise.reject(error);
    }
  );
}
