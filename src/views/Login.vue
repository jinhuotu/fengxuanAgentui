<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import AuthShell from '@/components/AuthShell.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const form = reactive({ username: '', password: '' })
const error = ref('')
const submitting = ref(false)

function nextPath() {
  const redirect = route.query.redirect
  if (typeof redirect !== 'string' || !redirect.startsWith('/') || redirect.startsWith('//')) {
    return '/'
  }
  if (redirect.startsWith('/login') || redirect.startsWith('/register')) return '/'
  return redirect
}

async function onSubmit() {
  error.value = ''
  submitting.value = true
  try {
    const tokens = await login({ username: form.username, password: form.password })
    auth.access_token = tokens.access_token
    auth.refresh_token = tokens.refresh_token
    localStorage.setItem('access_token', tokens.access_token)
    localStorage.setItem('refresh_token', tokens.refresh_token)
    await auth.loadMe()
    router.push(nextPath())
  } catch (err) {
    error.value = err instanceof Error ? err.message : '登录失败'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthShell>
    <header class="form-head">
      <h2>登录</h2>
      <p>使用锋煊账号进入控制台</p>
    </header>

    <form class="form" @submit.prevent="onSubmit">
      <label class="field">
        <span>用户名</span>
        <input
          v-model="form.username"
          name="username"
          autocomplete="username"
          placeholder="请输入用户名"
          required
        />
      </label>

      <label class="field">
        <span>密码</span>
        <input
          v-model="form.password"
          name="password"
          type="password"
          autocomplete="current-password"
          placeholder="请输入密码"
          required
        />
      </label>

      <p v-if="error" class="alert error">
        <span>{{ error }}</span>
      </p>

      <button type="submit" class="primary block" :disabled="submitting">
        <span v-if="submitting" class="spinner light"></span>
        {{ submitting ? '登录中…' : '登录' }}
      </button>
    </form>

    <p class="switch">
      没有账号？
      <router-link :to="{ path: '/register', query: route.query }">立即注册</router-link>
    </p>
  </AuthShell>
</template>

<style scoped>
.form-head {
  display: grid;
  gap: 5px;
}

.form-head h2 {
  font-size: 21px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.form-head p {
  font-size: 13px;
  color: var(--text-muted);
}

.form {
  display: grid;
  gap: 15px;
}

.spinner.light {
  border-color: rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
}

button.primary.block {
  height: 40px;
  margin-top: 4px;
  font-size: 14px;
  border-radius: var(--radius-md);
}

.switch {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
}

.switch a {
  font-weight: 500;
}
</style>
