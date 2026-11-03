/** 认证：注册、登录、刷新令牌、登出和当前用户。 */
import request from './request'

export function register(data) {
  return request.post('/api/auth/register', data)
}

export function login(data) {
  return request.post('/api/auth/login', data)
}

export function refresh(refreshToken) {
  return request.post(
    '/api/auth/refresh',
    { refresh_token: refreshToken },
    { skipAuthRefresh: true },
  )
}

export function logout(refreshToken) {
  return request.post('/api/auth/logout', { refresh_token: refreshToken })
}

export function me() {
  return request.get('/api/auth/me')
}
