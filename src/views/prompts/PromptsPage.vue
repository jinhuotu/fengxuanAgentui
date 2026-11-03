<script setup>
import { onMounted, ref } from 'vue'
import {
  createSystemPrompt,
  createUserPrompt,
  deleteSystemPrompt,
  deleteUserPrompt,
  getSystemPrompt,
  getUserPrompt,
  listSystemPrompts,
  listUserPrompts,
  updateSystemPrompt,
  updateUserPrompt,
} from '@/api/prompts'
import AppIcon from '@/components/AppIcon.vue'

const tabs = [
  { key: 'system', label: '系统提示词' },
  { key: 'user', label: '用户模板' },
]
const variables = ['{{question}}', '{{history}}', '{{context}}', '{{system_prompt}}']

const tab = ref('system')
const items = ref([])
const loading = ref(false)
const pageError = ref('')
const editorOpen = ref(false)
const editingId = ref(null)
const saving = ref(false)
const formError = ref('')
const form = ref({ name: '', description: '', content: '' })
const contentRef = ref(null)
const pendingDelete = ref(null)
const deleting = ref(false)

function endpoints() {
  if (tab.value === 'system') {
    return {
      list: listSystemPrompts,
      get: getSystemPrompt,
      create: createSystemPrompt,
      update: updateSystemPrompt,
      remove: deleteSystemPrompt,
    }
  }
  return {
    list: listUserPrompts,
    get: getUserPrompt,
    create: createUserPrompt,
    update: updateUserPrompt,
    remove: deleteUserPrompt,
  }
}

async function load() {
  loading.value = true
  pageError.value = ''
  try {
    items.value = await endpoints().list()
  } catch (err) {
    pageError.value = err instanceof Error ? err.message : '加载提示词失败'
  } finally {
    loading.value = false
  }
}

function switchTab(key) {
  if (tab.value === key) return
  tab.value = key
  editorOpen.value = false
  editingId.value = null
  load()
}

function openCreate() {
  editingId.value = null
  form.value = { name: '', description: '', content: '' }
  formError.value = ''
  editorOpen.value = true
}

async function openEdit(row) {
  formError.value = ''
  pageError.value = ''
  try {
    const detail = await endpoints().get(row.id)
    editingId.value = detail.id
    form.value = {
      name: detail.name,
      description: detail.description || '',
      content: detail.content,
    }
    editorOpen.value = true
  } catch (err) {
    pageError.value = err instanceof Error ? err.message : '读取提示词失败'
  }
}

function insertVariable(token) {
  const el = contentRef.value
  const current = form.value.content
  if (!el) {
    form.value.content = current + token
    return
  }
  const start = el.selectionStart ?? current.length
  const end = el.selectionEnd ?? start
  form.value.content = current.slice(0, start) + token + current.slice(end)
  const caret = start + token.length
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(caret, caret)
  })
}

async function onSave() {
  formError.value = ''
  const description = form.value.description.trim()
  const payload = {
    name: form.value.name,
    content: form.value.content,
    description: description || null,
  }
  saving.value = true
  try {
    const saved = editingId.value
      ? await endpoints().update(editingId.value, payload)
      : await endpoints().create(payload)
    form.value.content = saved.content
    editorOpen.value = false
    await load()
  } catch (err) {
    formError.value = err instanceof Error ? err.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!pendingDelete.value) return
  deleting.value = true
  pageError.value = ''
  try {
    await endpoints().remove(pendingDelete.value.id)
    if (editingId.value === pendingDelete.value.id) editorOpen.value = false
    pendingDelete.value = null
    await load()
  } catch (err) {
    pageError.value = err instanceof Error ? err.message : '删除失败'
  } finally {
    deleting.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="page">
    <header class="page-head">
      <div class="page-head-text">
        <h1>提示词</h1>
        <p class="page-desc">
          维护系统提示词与用户模板，可在新建会话时直接绑定。
        </p>
      </div>
      <div class="page-head-actions">
        <button type="button" class="ghost" :disabled="loading" @click="load">
          <AppIcon name="refresh" :size="15" />
          刷新
        </button>
        <button type="button" class="primary" @click="openCreate">
          <AppIcon name="plus" :size="15" />
          新建{{ tab === 'system' ? '提示词' : '模板' }}
        </button>
      </div>
    </header>

    <div class="toolbar">
      <div class="segmented" role="tablist" aria-label="提示词类型">
        <button
          v-for="item in tabs"
          :key="item.key"
          type="button"
          role="tab"
          :aria-selected="tab === item.key"
          :class="{ active: tab === item.key }"
          @click="switchTab(item.key)"
        >
          {{ item.label }}
        </button>
      </div>
      <span class="hint">列表只包含当前账号自己的{{ tab === 'system' ? '提示词' : '模板' }}</span>
    </div>

    <p v-if="pageError" class="alert error">
      <AppIcon name="alert" :size="14" />
      <span>{{ pageError }}</span>
    </p>

    <div v-if="loading" class="loading">
      <span class="spinner"></span>
      加载中…
    </div>

    <div v-else-if="items.length === 0" class="card empty">
      <span class="empty-icon">
        <AppIcon name="terminal" :size="20" />
      </span>
      <strong>还没有{{ tab === 'system' ? '系统提示词' : '用户模板' }}</strong>
      <p>新建一条，就可以在创建会话时直接绑定。</p>
      <button type="button" class="primary sm" @click="openCreate">
        <AppIcon name="plus" :size="13" />
        新建
      </button>
    </div>

    <ul v-else class="prompt-list">
      <li v-for="row in items" :key="row.id" class="card prompt-card">
        <div class="prompt-main">
          <div class="prompt-head">
            <strong>{{ row.name }}</strong>
            <span class="badge" :class="tab === 'system' ? 'primary' : 'violet'">
              {{ tab === 'system' ? '系统提示词' : '用户模板' }}
            </span>
          </div>
          <p v-if="row.description" class="desc">{{ row.description }}</p>
          <pre class="code prompt-preview">{{ row.content }}</pre>
        </div>
        <div class="prompt-ops">
          <button type="button" class="sm" @click="openEdit(row)">
            <AppIcon name="edit" :size="13" />
            编辑
          </button>
          <button
            type="button"
            class="sm icon danger"
            title="删除"
            aria-label="删除"
            @click="pendingDelete = row"
          >
            <AppIcon name="trash" :size="14" />
          </button>
        </div>
      </li>
    </ul>

    <div v-if="editorOpen" class="mask" @click.self="editorOpen = false">
      <form class="dialog editor" @submit.prevent="onSave">
        <header class="dialog-head">
          <h2>
            {{ editingId ? '编辑' : '新建' }}{{ tab === 'system' ? '系统提示词' : '用户模板' }}
          </h2>
          <p>占位符会在发送时按上下文替换，其余内容原样传给模型。</p>
        </header>

        <label class="field">
          <span>名称</span>
          <input v-model="form.name" required maxlength="128" placeholder="例如：通用助手" />
        </label>

        <label class="field">
          <span>说明</span>
          <input v-model="form.description" maxlength="512" placeholder="一句话说明这条提示词的用途" />
        </label>

        <label class="field">
          <span>正文</span>
          <textarea
            ref="contentRef"
            v-model="form.content"
            required
            rows="12"
            spellcheck="false"
            placeholder="在这里编写提示词正文…"
          />
        </label>

        <div class="vars">
          <span class="vars-label">插入变量</span>
          <button
            v-for="token in variables"
            :key="token"
            type="button"
            class="sm"
            @click="insertVariable(token)"
          >
            {{ token }}
          </button>
        </div>

        <p v-if="formError" class="alert error">
          <AppIcon name="alert" :size="14" />
          <span>{{ formError }}</span>
        </p>

        <div class="actions">
          <button type="button" class="ghost" @click="editorOpen = false">取消</button>
          <button type="submit" class="primary" :disabled="saving">
            <span v-if="saving" class="spinner light"></span>
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </form>
    </div>

    <div v-if="pendingDelete" class="mask" @click.self="pendingDelete = null">
      <div class="dialog">
        <h2>删除提示词</h2>
        <p class="hint">
          确定删除「<strong>{{ pendingDelete.name }}</strong>」？已绑定该提示词的会话会回退到默认行为。
        </p>
        <div class="actions">
          <button type="button" class="ghost" @click="pendingDelete = null">取消</button>
          <button type="button" class="danger-solid" :disabled="deleting" @click="confirmDelete">
            {{ deleting ? '删除中…' : '删除' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.prompt-list {
  display: grid;
  gap: 18px;
}

.prompt-card {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 22px;
  padding: 22px 26px;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.prompt-card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}

.prompt-main {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.prompt-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.prompt-head strong {
  font-size: 14px;
  font-weight: 600;
}

.desc {
  font-size: 12.5px;
  color: var(--text-secondary);
}

.prompt-preview {
  max-height: 92px;
  overflow: hidden;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  mask-image: linear-gradient(180deg, #000 62%, transparent);
}

.prompt-ops {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dialog-head {
  display: grid;
  gap: 3px;
}

.dialog-head p {
  font-size: 12.5px;
  color: var(--text-muted);
}

.dialog.editor {
  width: min(680px, 100%);
}

.editor textarea {
  min-height: 190px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.7;
  resize: vertical;
}

.vars {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.vars-label {
  margin-right: 2px;
  font-size: 12px;
  color: var(--text-muted);
}

.vars button {
  height: 26px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--color-primary-700);
  background: var(--color-primary-50);
  border-color: var(--color-primary-100);
}

.spinner.light {
  border-color: rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
}

@media (max-width: 640px) {
  .prompt-card {
    grid-template-columns: minmax(0, 1fr);
  }

  .prompt-ops {
    justify-content: flex-end;
  }
}
</style>
