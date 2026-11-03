<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { register } from '@/api/auth'
import AuthShell from '@/components/AuthShell.vue'

const route = useRoute()
const router = useRouter()
const form = reactive({ username: '', password: '', nickname: '' })
const error = ref('')
const submitting = ref(false)

async function onSubmit() {
  error.value = ''
  submitting.value = true
  try {
    await register({
      username: form.username,
      password: form.password,
      nickname: form.nickname,
    })
    const redirect = route.query.redirect
    router.push(typeof redirect === 'string' ? { path: '/login', query: { redirect } } : '/login')
  } catch (err) {
    error.value = err instanceof Error ? err.message : '注册失败'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthShell>
    <header class="form-head">
      <h2>创建账号</h2>
      <p>注册后即可创建会话、接入模型与知识库</p>
    </header>

    <form class="form" @submit.prevent="onSubmit">
      <label class="field">
        <span>用户名</span>
        <input
          v-model="form.username"
          name="username"
          autocomplete="username"
          placeholder="用于登录，建议英文或数字"
          required
        />
      </label>

      <label class="field">
        <span>昵称</span>
        <input
          v-model="form.nickname"
          name="nickname"
          autocomplete="nickname"
          placeholder="显示在侧边栏的名字"
          required
        />
      </label>

      <label class="field">
        <span>密码</span>
        <input
          v-model="form.password"
          name="password"
          type="password"
          autocomplete="new-password"
          placeholder="请输入登录密码"
          required
        />
      </label>

      <p v-if="error" class="alert error">
        <span>{{ error }}</span>
      </p>

      <button type="submit" class="primary block" :disabled="submitting">
        <span v-if="submitting" class="spinner light"></span>
        {{ submitting ? '注册中…' : '注册' }}
      </button>
    </form>

    <p class="switch">
      已有账号？
      <router-link :to="{ path: '/login', query: route.query }">去登录</router-link>
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
