import axios from 'axios'
import router from '@/router'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:8000',
})

/** 并发 401 共用这一次刷新，避免同时打出多个 /api/auth/refresh。 */
let refreshing = null

function errorWithMessage(message, code) {
  const error = new Error(message || '请求失败')
  if (code !== undefined) error.code = code
  return error
}

function readMessage(data, fallback) {
  if (data && typeof data === 'object' && data.message) return data.message
  if (typeof data === 'string' && data) {
    try {
      const parsed = JSON.parse(data)
      if (parsed && parsed.message) return parsed.message
    } catch {
      return fallback
    }
  }
  return fallback
}

function clearStoredTokens() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

async function resetAuthState() {
  clearStoredTokens()
  const { useAuthStore } = await import('@/stores/auth')
  const auth = useAuthStore()
  auth.access_token = ''
  auth.refresh_token = ''
  auth.user = null
}

function goLogin() {
  if (router.currentRoute.value.path !== '/login') {
    router.push('/login')
  }
}

function refreshAccess() {
  if (!refreshing) {
    const refreshToken = localStorage.getItem('refresh_token')
    refreshing = request
      .post('/api/auth/refresh', { refresh_token: refreshToken }, { skipAuthRefresh: true })
      .then(async (data) => {
        if (!data || !data.access_token) throw errorWithMessage('刷新登录态失败')
        localStorage.setItem('access_token', data.access_token)
        if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token)
        const { useAuthStore } = await import('@/stores/auth')
        const auth = useAuthStore()
        auth.access_token = data.access_token
        if (data.refresh_token) auth.refresh_token = data.refresh_token
        return data.access_token
      })
      .catch(async (error) => {
        await resetAuthState()
        goLogin()
        throw error
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

request.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem('access_token')
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

request.interceptors.response.use(
  (response) => {
    const body = response.data
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) return body.data
      return Promise.reject(errorWithMessage(body.message, body.code))
    }
    return body
  },
  async (error) => {
    const response = error.response
    const config = error.config
    const message = readMessage(response?.data, error.message)
    const code = response?.data?.code
    const url = config?.url || ''
    const isLoginOrRegister = url.includes('/api/auth/login') || url.includes('/api/auth/register')

    if (
      !response ||
      response.status !== 401 ||
      !config ||
      config.skipAuthRefresh ||
      isLoginOrRegister
    ) {
      return Promise.reject(errorWithMessage(message, code))
    }

    if (config._retry || !localStorage.getItem('refresh_token')) {
      await resetAuthState()
      goLogin()
      return Promise.reject(errorWithMessage(message, code))
    }

    config._retry = true
    try {
      const accessToken = await refreshAccess()
      config.headers.Authorization = `Bearer ${accessToken}`
      return request(config)
    } catch (refreshError) {
      return Promise.reject(refreshError)
    }
  },
)

export default request
