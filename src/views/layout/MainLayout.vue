<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppIcon from '@/components/AppIcon.vue'

const auth = useAuthStore()
const route = useRoute()
const drawerOpen = ref(false)

const menus = [
  { path: '/chat', label: '对话', icon: 'chat', desc: '会话与消息' },
  { path: '/models', label: '模型', icon: 'cpu', desc: '模型接入配置' },
  { path: '/prompts', label: '提示词', icon: 'terminal', desc: '系统提示词与模板' },
  { path: '/knowledge', label: '知识库', icon: 'database', desc: '文档与检索' },
  { path: '/agent', label: 'Agent', icon: 'bot', desc: 'MCP 与工具' },
  { path: '/system', label: '系统', icon: 'sliders', desc: '服务与个人设置' },
]

const displayName = computed(() => auth.user?.nickname || auth.user?.username || '未登录')
const userInitial = computed(() => (auth.user?.nickname || auth.user?.username || '玄').slice(0, 1))
const currentMenu = computed(() => menus.find((item) => route.path.startsWith(item.path)))

watch(
  () => route.fullPath,
  () => {
    drawerOpen.value = false
  },
)

onMounted(() => {
  if (auth.access_token && !auth.user) {
    auth.loadMe().catch(() => {})
  }
})
</script>

<template>
  <div class="shell">
    <aside class="sidebar" :class="{ 'is-open': drawerOpen }">
      <div class="brand">
        <span class="brand-mark">
          <AppIcon name="sparkles" :size="17" :stroke-width="1.9" />
        </span>
        <span class="brand-text">
          <strong>锋煊</strong>
          <small>Fengxuan Agent</small>
        </span>
        <button
          type="button"
          class="ghost icon drawer-close"
          aria-label="收起菜单"
          @click="drawerOpen = false"
        >
          <AppIcon name="close" :size="16" />
        </button>
      </div>

      <nav class="nav">
        <p class="nav-label">工作区</p>
        <router-link v-for="item in menus" :key="item.path" :to="item.path" class="nav-item">
          <AppIcon :name="item.icon" :size="17" />
          <span>{{ item.label }}</span>
        </router-link>
      </nav>

      <div class="sidebar-foot">
        <div class="user-card">
          <span class="avatar">{{ userInitial }}</span>
          <span class="user-meta">
            <strong>{{ displayName }}</strong>
            <small v-if="auth.user?.username">@{{ auth.user.username }}</small>
            <small v-else>尚未读取账号</small>
          </span>
          <button
            type="button"
            class="ghost icon signout"
            title="退出登录"
            aria-label="退出登录"
            @click="auth.logout()"
          >
            <AppIcon name="logout" :size="16" />
          </button>
        </div>
      </div>
    </aside>

    <div class="shell-main">
      <header class="topbar">
        <button
          type="button"
          class="ghost icon"
          aria-label="打开菜单"
          @click="drawerOpen = true"
        >
          <AppIcon name="menu" :size="18" />
        </button>
        <span class="topbar-title">{{ currentMenu?.label || '锋煊' }}</span>
        <span class="topbar-sub">{{ currentMenu?.desc || '' }}</span>
      </header>

      <main class="content">
        <router-view />
      </main>
    </div>

    <div v-if="drawerOpen" class="scrim" @click="drawerOpen = false"></div>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 28px;
  height: 100vh;
  padding: 22px 16px 18px;
  color: var(--text-on-dark);
  background:
    radial-gradient(420px 220px at 0% 0%, rgba(196, 48, 58, 0.28), transparent 58%),
    radial-gradient(520px 240px at 100% 0%, rgba(64, 139, 226, 0.34), transparent 62%),
    linear-gradient(180deg, #122644 0%, #0d1b30 58%, #0a1626 100%);
  border-right: 1px solid rgba(255, 255, 255, 0.06);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 6px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  color: #fff;
  background: linear-gradient(140deg, #4a95e6 0%, #2363a8 70%);
  border-radius: 10px;
  box-shadow: 0 6px 16px -6px rgba(35, 99, 168, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.brand-text {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.brand-text strong {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: #fff;
}

.brand-text small {
  font-size: 10.5px;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.42);
  text-transform: uppercase;
}

.drawer-close {
  display: none;
  margin-left: auto;
  color: rgba(255, 255, 255, 0.7);
  border-color: rgba(255, 255, 255, 0.16);
}

.nav {
  display: grid;
  gap: 6px;
  flex: 1;
  align-content: start;
  overflow-y: auto;
}

.nav-label {
  padding: 0 12px 8px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.34);
  text-transform: uppercase;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  font-size: 14.5px;
  color: rgba(255, 255, 255, 0.72);
  border-radius: var(--radius-md);
  transition: background var(--transition), color var(--transition);
}

.nav-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 3px;
  height: 0;
  background: #6cb2ff;
  border-radius: 0 3px 3px 0;
  transform: translateY(-50%);
  transition: height var(--transition);
}

.nav-item:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.07);
}

.nav-item.router-link-active {
  color: #fff;
  font-weight: 500;
  background: linear-gradient(90deg, rgba(75, 148, 230, 0.3), rgba(75, 148, 230, 0.12));
  box-shadow: inset 0 0 0 1px rgba(120, 178, 240, 0.16);
}

.nav-item.router-link-active::before {
  height: 18px;
}

.sidebar-foot {
  margin-top: auto;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 8px 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg);
}

.avatar {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 600;
  color: #0f1e33;
  background: linear-gradient(140deg, #d8e8fb, #9dc4ee);
  border-radius: 50%;
}

.user-meta {
  display: grid;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.user-meta strong {
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 600;
  color: #fff;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-meta small {
  overflow: hidden;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.42);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.signout {
  width: 30px;
  height: 30px;
  color: rgba(255, 255, 255, 0.6);
  border-color: transparent;
  background: transparent;
  box-shadow: none;
}

.signout:hover:not(:disabled) {
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.16);
}

.shell-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background:
    radial-gradient(760px 320px at 96% -60px, rgba(35, 99, 168, 0.2), transparent 64%),
    radial-gradient(560px 340px at -6% 108%, rgba(180, 42, 52, 0.12), transparent 60%),
    linear-gradient(180deg, #eef3fa 0%, #dce6f2 100%);
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: none;
  align-items: center;
  gap: 10px;
  height: 54px;
  padding: 0 12px;
  background: rgba(247, 249, 252, 0.88);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(12px);
}

.topbar-title {
  font-size: 14.5px;
  font-weight: 600;
}

.topbar-sub {
  overflow: hidden;
  font-size: 12px;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content {
  flex: 1;
  width: 100%;
  min-width: 0;
  padding: 36px 48px 64px;
}

.scrim {
  position: fixed;
  inset: 0;
  z-index: 55;
  background: rgba(8, 16, 28, 0.5);
  animation: scrim-in 0.16s var(--ease);
}

@keyframes scrim-in {
  from {
    opacity: 0;
  }
}

@media (max-width: 1180px) {
  .shell {
    grid-template-columns: 212px minmax(0, 1fr);
  }

  .content {
    padding: 28px 24px 40px;
  }
}

@media (max-width: 960px) {
  .shell {
    grid-template-columns: minmax(0, 1fr);
  }

  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 60;
    width: 268px;
    height: 100vh;
    transform: translateX(-102%);
    transition: transform 0.22s var(--ease);
  }

  .sidebar.is-open {
    transform: none;
    box-shadow: var(--shadow-xl);
  }

  .drawer-close {
    display: inline-flex;
  }

  .topbar {
    display: flex;
  }

  .content {
    padding: 20px 16px 36px;
  }
}
</style>
