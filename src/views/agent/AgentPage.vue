<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import {
  createMcpServer,
  deleteMcpServer,
  disableConversationAgent,
  getConversationAgent,
  getMcpServer,
  listMcpServers,
  saveConversationAgent,
  updateMcpServer,
} from '@/api/agent'
import { listConversations } from '@/api/chat'
import AppIcon from '@/components/AppIcon.vue'

const auth = useAuthStore()
const servers = ref([])
const conversations = ref([])
const loading = ref(false)
const pageError = ref('')

const formOpen = ref(false)
const editingId = ref(0)
const saving = ref(false)
const formError = ref('')
const form = ref(emptyServerForm())

const conversationId = ref('')
const agent = ref(null)
const agentMissing = ref(false)
const agentError = ref('')
const agentSaving = ref(false)
const agentForm = ref(emptyAgentForm())

const serverChoices = computed(() => {
  const known = new Map(servers.value.map((item) => [Number(item.id), item]))
  for (const id of agentForm.value.serverIds) {
    const number = Number(id)
    if (!known.has(number)) {
      known.set(number, {
        id: number,
        name: `#${number}`,
        status: 0,
        server_type: '',
        missing: true,
      })
    }
  }
  return [...known.values()]
})

function emptyServerForm() {
  return {
    name: '',
    server_type: 'mysql',
    visibility_scope: 'private',
    status: 1,
    host: '127.0.0.1',
    port: 3306,
    user: '',
    password: '',
    database: '',
    allow_write: false,
    allow_ddl: false,
    base_dir: '',
  }
}

function emptyAgentForm() {
  return { enabled: false, serverIds: [], instruction: '' }
}

function errorText(err, fallback) {
  const message = err instanceof Error ? err.message : fallback
  if (err && err.code === 40300) return `403 ${message}`
  if (err && err.code === 40400) return `404 ${message}`
  return message || fallback
}

function isOwner(row) {
  if (!auth.user) return false
  return Number(row.user_id) === Number(auth.user.id)
}

function typeLabel(value) {
  if (value === 'mysql') return 'MySQL'
  if (value === 'filesystem') return '文件系统'
  return value || ''
}

function typeTone(value) {
  if (value === 'mysql') return 'primary'
  if (value === 'filesystem') return 'violet'
  return ''
}

function scopeLabel(value) {
  if (value === 'private') return '私有'
  if (value === 'shared') return '共享'
  if (value === 'public') return '公开'
  return value || ''
}

function scopeTone(value) {
  if (value === 'shared') return 'primary'
  if (value === 'public') return 'success'
  return 'outline'
}

function configSummary(row) {
  const config = row.config || {}
  if (row.server_type === 'filesystem') {
    return `${config.base_dir || ''}，写入 ${config.allow_write ? '允许' : '不允许'}`
  }
  const password = config.password ? '密码已设置' : '无密码'
  return `${config.user || ''}@${config.host || ''}:${config.port ?? ''} / ${config.database || ''}，${password}`
}

function validHost(value) {
  return (
    /^[A-Za-z0-9.\-]{1,255}$/.test(value) &&
    !value.startsWith('-') &&
    !value.endsWith('-') &&
    !value.includes('..')
  )
}

async function load() {
  loading.value = true
  pageError.value = ''
  try {
    if (auth.access_token && !auth.user) {
      await auth.loadMe().catch(() => {})
    }
    const [serverRows, conversationRows] = await Promise.all([
      listMcpServers(),
      listConversations(),
    ])
    servers.value = serverRows
    conversations.value = conversationRows
  } catch (err) {
    pageError.value = errorText(err, '加载 Agent 数据失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = 0
  form.value = emptyServerForm()
  formError.value = ''
  formOpen.value = true
}

function onTypeChange() {
  form.value.visibility_scope = form.value.server_type === 'filesystem' ? 'public' : 'private'
}

async function openEdit(row) {
  formError.value = ''
  editingId.value = row.id
  try {
    const detail = await getMcpServer(row.id)
    const config = detail.config || {}
    form.value = {
      name: detail.name,
      server_type: detail.server_type,
      visibility_scope: detail.visibility_scope,
      status: detail.status,
      host: config.host || '',
      port: config.port ?? 3306,
      user: config.user || '',
      password: '',
      database: config.database || '',
      allow_write: Boolean(config.allow_write),
      allow_ddl: Boolean(config.allow_ddl),
      base_dir: config.base_dir || '',
    }
    formOpen.value = true
  } catch (err) {
    pageError.value = errorText(err, '加载 MCP 服务失败')
  }
}

function validateServer() {
  if (!form.value.name.trim()) return '请填写名称'
  if (form.value.server_type === 'filesystem') {
    if (!form.value.base_dir.trim()) return '请填写授权目录，且必须是已存在的绝对路径'
    return ''
  }
  if (!validHost(form.value.host.trim())) return '主机名不合法'
  const port = Number(form.value.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return '端口需要在 1 到 65535'
  if (!/^[A-Za-z0-9_.$\-]{1,128}$/.test(form.value.user.trim())) return '数据库用户名不合法'
  if (!/^[A-Za-z0-9_]{1,64}$/.test(form.value.database.trim())) return '数据库名不合法'
  if (!editingId.value && !form.value.password.trim()) return '请填写数据库密码'
  return ''
}

function buildConfig() {
  if (form.value.server_type === 'filesystem') {
    return {
      base_dir: form.value.base_dir.trim(),
      allow_write: Boolean(form.value.allow_write),
    }
  }
  const config = {
    host: form.value.host.trim(),
    port: Number(form.value.port),
    user: form.value.user.trim(),
    database: form.value.database.trim(),
    allow_write: Boolean(form.value.allow_write),
    allow_ddl: Boolean(form.value.allow_ddl),
  }
  const password = form.value.password.trim()
  if (!editingId.value || (password && password !== '***')) config.password = password
  return config
}

async function onSaveServer() {
  const message = validateServer()
  if (message) {
    formError.value = message
    return
  }
  const payload = {
    name: form.value.name.trim(),
    visibility_scope: form.value.visibility_scope,
    status: Number(form.value.status),
    config: buildConfig(),
  }
  saving.value = true
  formError.value = ''
  try {
    if (editingId.value) await updateMcpServer(editingId.value, payload)
    else await createMcpServer({ ...payload, server_type: form.value.server_type })
    formOpen.value = false
    await load()
  } catch (err) {
    formError.value = errorText(err, '保存 MCP 服务失败')
  } finally {
    saving.value = false
  }
}

async function onToggleStatus(row) {
  if (!isOwner(row)) return
  pageError.value = ''
  try {
    await updateMcpServer(row.id, { status: row.status === 1 ? 0 : 1 })
    await load()
  } catch (err) {
    pageError.value = errorText(err, '更新服务状态失败')
  }
}

async function onDeleteServer(row) {
  if (!window.confirm(`删除 MCP 服务「${row.name}」？`)) return
  pageError.value = ''
  try {
    await deleteMcpServer(row.id)
    await load()
  } catch (err) {
    pageError.value = errorText(err, '删除 MCP 服务失败')
  }
}

async function onPickConversation() {
  agent.value = null
  agentMissing.value = false
  agentError.value = ''
  agentForm.value = emptyAgentForm()
  if (!conversationId.value) return
  try {
    const detail = await getConversationAgent(conversationId.value)
    agent.value = detail
    agentForm.value = {
      enabled: detail.enabled === 1,
      serverIds: (detail.mcp_server_ids || []).map(Number),
      instruction: detail.system_instruction || '',
    }
  } catch (err) {
    if (err && err.code === 40400) {
      agentMissing.value = true
      return
    }
    agentError.value = errorText(err, '加载会话 Agent 失败')
  }
}

async function onSaveAgent() {
  if (!conversationId.value) {
    agentError.value = '请选择会话'
    return
  }
  const ids = agentForm.value.serverIds.map(Number)
  if (ids.length > 8) {
    agentError.value = '最多绑定 8 个 MCP 服务'
    return
  }
  if (agentForm.value.enabled && ids.length === 0) {
    agentError.value = '启用 Agent 时至少绑定一个 MCP 服务'
    return
  }
  agentSaving.value = true
  agentError.value = ''
  try {
    agent.value = await saveConversationAgent(conversationId.value, {
      enabled: agentForm.value.enabled ? 1 : 0,
      mcp_server_ids: ids,
      system_instruction: agentForm.value.instruction.trim() || null,
    })
    agentMissing.value = false
    agentForm.value.enabled = agent.value.enabled === 1
  } catch (err) {
    agentError.value = errorText(err, '保存会话 Agent 失败')
  } finally {
    agentSaving.value = false
  }
}

async function onDisableAgent() {
  if (!conversationId.value || !agent.value) return
  if (!window.confirm('停用后该会话走普通对话，绑定关系仍保留。')) return
  agentSaving.value = true
  agentError.value = ''
  try {
    await disableConversationAgent(conversationId.value)
    await onPickConversation()
  } catch (err) {
    agentError.value = errorText(err, '停用会话 Agent 失败')
  } finally {
    agentSaving.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="page">
    <header class="page-head">
      <div class="page-head-text">
        <h1>Agent</h1>
        <p class="page-desc">
          配置 MCP 工具服务并绑定到具体会话，让助手能查询数据库或读取文件。
        </p>
      </div>
      <div class="page-head-actions">
        <button type="button" class="ghost" :disabled="loading" @click="load">
          <AppIcon name="refresh" :size="15" />
          刷新
        </button>
      </div>
    </header>

    <p v-if="pageError" class="alert error">
      <AppIcon name="alert" :size="14" />
      <span>{{ pageError }}</span>
    </p>

    <section class="card">
      <header class="card-head">
        <h2>
          MCP 服务
          <span class="badge outline">{{ servers.length }}</span>
        </h2>
        <button type="button" class="primary sm" @click="openCreate">
          <AppIcon name="plus" :size="13" />
          新建服务
        </button>
      </header>

      <p v-if="loading" class="loading">
        <span class="spinner"></span>
        加载中…
      </p>

      <div v-else-if="servers.length === 0" class="empty">
        <span class="empty-icon">
          <AppIcon name="bot" :size="20" />
        </span>
        <strong>还没有 MCP 服务</strong>
        <p>支持 MySQL 与文件系统两类服务，创建后可在会话上绑定。</p>
        <button type="button" class="primary sm" @click="openCreate">
          <AppIcon name="plus" :size="13" />
          新建服务
        </button>
      </div>

      <div v-else class="table-wrap inner">
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>类型</th>
              <th>配置</th>
              <th>可见性</th>
              <th>状态</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in servers" :key="row.id">
              <td><strong>{{ row.name }}</strong></td>
              <td>
                <span class="badge" :class="typeTone(row.server_type)">
                  {{ typeLabel(row.server_type) }}
                </span>
              </td>
              <td><span class="mono">{{ configSummary(row) }}</span></td>
              <td>
                <span class="badge" :class="scopeTone(row.visibility_scope)">
                  {{ scopeLabel(row.visibility_scope) }}
                </span>
              </td>
              <td>
                <span class="badge" :class="row.status === 1 ? 'success' : 'outline'">
                  <span class="dot"></span>
                  {{ row.status === 1 ? '启用' : '停用' }}
                </span>
              </td>
              <td class="col-actions">
                <div class="row-actions">
                  <template v-if="isOwner(row)">
                    <button type="button" class="sm" @click="onToggleStatus(row)">
                      {{ row.status === 1 ? '停用' : '启用' }}
                    </button>
                    <button
                      type="button"
                      class="sm icon"
                      title="编辑"
                      aria-label="编辑"
                      @click="openEdit(row)"
                    >
                      <AppIcon name="edit" :size="14" />
                    </button>
                    <button
                      type="button"
                      class="sm icon danger"
                      title="删除"
                      aria-label="删除"
                      @click="onDeleteServer(row)"
                    >
                      <AppIcon name="trash" :size="14" />
                    </button>
                  </template>
                  <span v-else class="badge outline">只读</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <header class="card-head">
        <h2>会话 Agent</h2>
        <p>为单个会话绑定工具与额外的系统指令</p>
      </header>

      <p v-if="!loading && conversations.length === 0" class="hint">
        还没有会话，先在「对话」页新建一个。
      </p>

      <label class="field picker">
        <span>选择会话</span>
        <select v-model="conversationId" @change="onPickConversation">
          <option value="">请选择会话</option>
          <option v-for="item in conversations" :key="item.id" :value="String(item.id)">
            {{ item.title }}
          </option>
        </select>
      </label>

      <p v-if="agentMissing" class="alert info">
        <AppIcon name="info" :size="14" />
        <span>这个会话还没有 Agent 配置，保存后会创建。</span>
      </p>

      <form v-if="conversationId" class="agent-form" @submit.prevent="onSaveAgent">
        <label class="switch-row">
          <input v-model="agentForm.enabled" type="checkbox" />
          <span class="switch"></span>
          <span class="switch-text">
            <strong>启用 Agent</strong>
            <small>停用后该会话走普通对话，绑定关系仍然保留</small>
          </span>
        </label>

        <fieldset>
          <legend>绑定 MCP 服务（最多 8 个，且需要处于启用状态）</legend>
          <p v-if="serverChoices.length === 0" class="hint">没有可选服务</p>
          <div class="server-grid">
            <label v-for="item in serverChoices" :key="item.id" class="check server-choice">
              <input v-model="agentForm.serverIds" type="checkbox" :value="Number(item.id)" />
              <span class="server-name">{{ item.name }}</span>
              <span v-if="item.server_type" class="badge outline">
                {{ typeLabel(item.server_type) }}
              </span>
              <span v-if="item.status !== 1" class="badge warning">已停用</span>
            </label>
          </div>
        </fieldset>

        <label class="field">
          <span>系统指令</span>
          <textarea
            v-model="agentForm.instruction"
            rows="4"
            maxlength="4000"
            placeholder="例如：先查库再回答，涉及写操作必须二次确认。"
          />
        </label>

        <p v-if="agent" class="hint">
          当前{{ agent.enabled === 1 ? '已启用' : '已停用' }}
          <span v-if="agent.updated_at">，更新于 {{ agent.updated_at }}</span>
        </p>

        <p v-if="agentError" class="alert error">
          <AppIcon name="alert" :size="14" />
          <span>{{ agentError }}</span>
        </p>

        <div class="actions">
          <button type="button" class="ghost" :disabled="agentSaving || !agent" @click="onDisableAgent">
            停用 Agent
          </button>
          <button type="submit" class="primary" :disabled="agentSaving">
            <span v-if="agentSaving" class="spinner light"></span>
            {{ agentSaving ? '保存中…' : '保存' }}
          </button>
        </div>
      </form>
    </section>

    <div v-if="formOpen" class="mask" @click.self="formOpen = false">
      <form class="dialog server-dialog" @submit.prevent="onSaveServer">
        <header class="dialog-head">
          <h2>{{ editingId ? '编辑 MCP 服务' : '新建 MCP 服务' }}</h2>
          <p>文件系统默认公开，MySQL 默认私有；共享目前没有名单，其他用户看不到。</p>
        </header>

        <div class="form-grid">
          <label class="field">
            <span>名称</span>
            <input v-model="form.name" maxlength="128" required placeholder="例如：生产库（只读）" />
          </label>

          <label class="field">
            <span>类型</span>
            <select v-if="!editingId" v-model="form.server_type" @change="onTypeChange">
              <option value="mysql">MySQL</option>
              <option value="filesystem">文件系统</option>
            </select>
            <input v-else :value="typeLabel(form.server_type)" disabled />
          </label>

          <label class="field">
            <span>可见性</span>
            <select v-model="form.visibility_scope">
              <option value="private">私有</option>
              <option value="shared">共享</option>
              <option value="public">公开</option>
            </select>
          </label>

          <label class="field">
            <span>状态</span>
            <select v-model.number="form.status">
              <option :value="1">启用</option>
              <option :value="0">停用</option>
            </select>
          </label>

          <template v-if="form.server_type === 'mysql'">
            <label class="field">
              <span>主机</span>
              <input v-model="form.host" maxlength="255" required />
            </label>

            <label class="field">
              <span>端口</span>
              <input v-model.number="form.port" type="number" min="1" max="65535" step="1" required />
            </label>

            <label class="field">
              <span>用户名</span>
              <input v-model="form.user" maxlength="128" required />
            </label>

            <label class="field">
              <span>密码</span>
              <input
                v-model="form.password"
                type="password"
                maxlength="256"
                :placeholder="editingId ? '留空表示不修改' : ''"
                :required="!editingId"
              />
            </label>

            <label class="field span-2">
              <span>数据库</span>
              <input v-model="form.database" maxlength="64" required />
            </label>

            <fieldset class="span-2 perms">
              <legend>写权限</legend>
              <label class="check">
                <input v-model="form.allow_write" type="checkbox" />
                允许 INSERT、UPDATE、DELETE
              </label>
              <label class="check">
                <input v-model="form.allow_ddl" type="checkbox" />
                允许 CREATE、DROP、ALTER、TRUNCATE
              </label>
            </fieldset>
          </template>

          <template v-else>
            <label class="field span-2">
              <span>授权目录</span>
              <input
                v-model="form.base_dir"
                maxlength="512"
                placeholder="已存在的绝对路径"
                required
              />
            </label>

            <fieldset class="span-2 perms">
              <legend>写权限</legend>
              <label class="check">
                <input v-model="form.allow_write" type="checkbox" />
                允许写入、覆盖和删除
              </label>
            </fieldset>
          </template>
        </div>

        <p v-if="formError" class="alert error">
          <AppIcon name="alert" :size="14" />
          <span>{{ formError }}</span>
        </p>

        <div class="actions">
          <button type="button" class="ghost" @click="formOpen = false">取消</button>
          <button type="submit" class="primary" :disabled="saving">
            <span v-if="saving" class="spinner light"></span>
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.table-wrap.inner {
  box-shadow: none;
  border-radius: var(--radius-md);
}

.mono {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.col-actions {
  width: 1%;
  text-align: right;
}

.agent-form {
  display: grid;
  gap: 14px;
  max-width: 720px;
}

.picker {
  max-width: 420px;
}

.switch-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.switch-row input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.switch {
  position: relative;
  width: 36px;
  height: 20px;
  flex: 0 0 auto;
  margin-top: 2px;
  background: var(--border-strong);
  border-radius: var(--radius-pill);
  transition: background var(--transition);
}

.switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.24);
  transition: transform var(--transition);
}

.switch-row input:checked + .switch {
  background: var(--color-primary);
}

.switch-row input:checked + .switch::after {
  transform: translateX(16px);
}

.switch-row input:focus-visible + .switch {
  outline: 2px solid var(--color-primary-400);
  outline-offset: 2px;
}

.switch-text {
  display: grid;
  gap: 1px;
}

.switch-text strong {
  font-size: 13px;
  font-weight: 600;
}

.switch-text small {
  font-size: 11.5px;
  color: var(--text-muted);
}

.server-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 6px;
  margin-top: 8px;
}

.server-choice {
  padding: 7px 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  transition: border-color var(--transition), background var(--transition);
}

.server-choice:hover {
  border-color: var(--color-primary-200);
  background: var(--color-primary-50);
}

.server-name {
  overflow: hidden;
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dialog-head {
  display: grid;
  gap: 3px;
}

.dialog-head p {
  font-size: 12.5px;
  color: var(--text-muted);
}

.dialog.server-dialog {
  width: min(640px, 100%);
}

.span-2 {
  grid-column: 1 / -1;
}

.perms {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
}

.actions {
  padding-top: 4px;
}

.spinner.light {
  border-color: rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
}

@media (max-width: 720px) {
  .perms {
    display: grid;
    gap: 8px;
  }
}
</style>
