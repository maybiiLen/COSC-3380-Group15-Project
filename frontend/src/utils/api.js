// API configuration for both development and production
const API_BASE_URL = import.meta.env.VITE_API_URL || ""

// Fetch wrapper that auto-refreshes expired access tokens
async function authFetch(url, options = {}) {
  const token = localStorage.getItem("accessToken")
  const opts = {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  }

  let res = await fetch(url, opts)

  if (res.status === 401) {
    // Try refreshing the access token
    try {
      const refreshRes = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      })
      if (refreshRes.ok) {
        const { accessToken } = await refreshRes.json()
        localStorage.setItem("accessToken", accessToken)
        // Retry original request with new token
        opts.headers.Authorization = `Bearer ${accessToken}`
        res = await fetch(url, opts)
      }
    } catch {
      // Refresh failed — return original 401 response
    }
  }

  return res
}

export { API_BASE_URL, authFetch }