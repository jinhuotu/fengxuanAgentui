import { defineStore } from 'pinia'
import router from '@/router'
import {
  login as requestLogin,
  logout as requestLogout,
  me,
  register as requestRegister,
} from '@/api/auth'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    access_token: localStorage.getItem('access_token') || '',
    refresh_token: localStorage.getItem('refresh_token') || '',
    user: null,
  }),
  actions: {
    async login(data) {
      const tokens = await requestLogin(data)
      this.access_token = tokens.access_token
      this.refresh_token = tokens.refresh_token
      localStorage.setItem('access_token', tokens.access_token)
      localStorage.setItem('refresh_token', tokens.refresh_token)
      await this.loadMe()
      return tokens
    },
    async register(data) {
      return requestRegister(data)
    },
    async logout() {
      const refreshToken = this.refresh_token
      try {
        if (refreshToken) await requestLogout(refreshToken)
      } finally {
        this.access_token = ''
        this.refresh_token = ''
        this.user = null
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        router.push('/login')
      }
    },
    async loadMe() {
      this.user = await me()
      return this.user
    },
  },
})
