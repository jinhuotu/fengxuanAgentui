import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/Login.vue'),
      meta: { public: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/Register.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/views/layout/MainLayout.vue'),
      children: [
        { path: '', redirect: '/chat' },
        { path: 'chat', name: 'chat', component: () => import('@/views/chat/ChatPage.vue') },
        {
          path: 'models',
          name: 'models',
          component: () => import('@/views/models/ModelsPage.vue'),
        },
        {
          path: 'prompts',
          name: 'prompts',
          component: () => import('@/views/prompts/PromptsPage.vue'),
        },
        {
          path: 'knowledge',
          name: 'knowledge',
          component: () => import('@/views/knowledge/KnowledgePage.vue'),
        },
        {
          path: 'knowledge/:id',
          name: 'knowledge-detail',
          component: () => import('@/views/knowledge/KnowledgeDetail.vue'),
        },
        {
          path: 'system',
          name: 'system',
          component: () => import('@/views/system/SystemPage.vue'),
        },
        { path: 'agent', name: 'agent', component: () => import('@/views/agent/AgentPage.vue') },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const accessToken = localStorage.getItem('access_token')
  const isPublic = to.path === '/login' || to.path === '/register'
  if (!accessToken && !isPublic) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (accessToken && to.path === '/login') return '/'
})

export default router
