<script setup>
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import {
  addShare,
  createModel,
  deleteModel,
  listModels,
  listShares,
  removeShare,
  testModel,
  updateModel,
} from '@/api/models'
import { listGroups } from '@/api/group'
import ModelForm from '@/components/ModelForm.vue'
import AppIcon from '@/components/AppIcon.vue'

const TYPE_FILTERS = [
  { value: '', label: '全部' },
  { value: 'chat', label: '对话' },
  { value: 'embedding', label: '向量' },
  { value: 'rerank', label: '重排' },
]

const auth = useAuthStore()
const typeFilter = ref('')
const models = ref([])
const loading = ref(false)
const pageError = ref('')

const formOpen = ref(false)
const editing = ref(null)
const saving = ref(false)
const saveError = ref('')

const pendingDelete = ref(null)
const deleting = ref(false)

const testingId = ref(0)
const testResult = ref(null)

const shareModel = ref(null)
const shares = ref([])
const groups = ref([])
const shareTarget = ref('user')
const targetUserId = ref('')
const targetGroupId = ref('')
const shareError = ref('')
const sharing = ref(false)

function isOwner(row) {
  if (!auth.user) return false
  return Number(row.user_id) === Number(auth.user.id)
}

function scopeLabel(value) {
  if (value === 'private') return '私有'
  if (value === 'shared') return '共享'
  if (value === 'public') return '公开'
  return value || '未知'
}

function scopeTone(value) {
  if (value === 'shared') return 'primary'
  if (value === 'public') return 'success'
  return 'outline'
}

function typeTone(value) {
  if (value === 'embedding') return 'violet'
  if (value === 'rerank') return 'warning'
  return 'primary'
}

function typeLabel(value) {
  if (value === 'chat') return '对话'
  if (value === 'embedding') return '向量'
  if (value === 'rerank') return '重排'
  return value || '未知'
}

async function load() {
  loading.value = true
  pageError.value = ''
  try {
    models.value = await listModels(typeFilter.value)
  } catch (err) {
    pageError.value = err instanceof Error ? err.message : '加载模型失败'
  } finally {
    loading.value = false
  }
}

function setFilter(value) {
  if (typeFilter.value === value) return
  typeFilter.value = value
  load()
}

function openCreate() {
  editing.value = null
  saveError.value = ''
  formOpen.value = true
}

function openEdit(row) {
  editing.value = row
  saveError.value = ''
  formOpen.value = true
}

async function onSave(payload) {
  saving.value = true
  saveError.value = ''
  try {
    if (editing.value) await updateModel(editing.value.id, payload)
    else await createModel(payload)
    formOpen.value = false
    await load()
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function onTest(row) {
  testingId.value = row.id
  testResult.value = null
  try {
    const result = await testModel(row.id)
    testResult.value = { id: row.id, name: row.name, ...result }
  } catch (err) {
    testResult.value = {
      id: row.id,
      name: row.name,
      ok: false,
      sample: '',
      latency_ms: null,
      message: err instanceof Error ? err.message : '连通测试失败',
    }
  } finally {
    testingId.value = 0
  }
}

async function confirmDelete() {
  if (!pendingDelete.value) return
  deleting.value = true
  pageError.value = ''
  try {
    await deleteModel(pendingDelete.value.id)
    pendingDelete.value = null
    await load()
  } catch (err) {
    pageError.value = err instanceof Error ? err.message : '删除失败'
  } finally {
    deleting.value = false
  }
}

async function openShare(row) {
  shareModel.value = row
  shares.value = []
  groups.value = []
  shareTarget.value = 'user'
  targetUserId.value = ''
  targetGroupId.value = ''
  shareError.value = ''
  try {
    shares.value = await listShares(row.id)
  } catch (err) {
    shareError.value = err instanceof Error ? err.message : '加载共享失败'
  }
  try {
    groups.value = await listGroups()
  } catch (err) {
    if (!shareError.value) shareError.value = err instanceof Error ? err.message : '加载群组失败'
  }
}

function groupName(groupId) {
  const found = groups.value.find((item) => Number(item.id) === Number(groupId))
  return found ? found.name : ''
}

async function onAddShare() {
  if (!shareModel.value) return
  shareError.value = ''
  const body =
    shareTarget.value === 'group'
      ? { share_target_type: 'group', target_group_id: Number(targetGroupId.value) }
      : { share_target_type: 'user', target_user_id: Number(targetUserId.value) }
  const targetId = body.target_user_id ?? body.target_group_id
  if (!Number.isInteger(targetId) || targetId < 1) {
    shareError.value = shareTarget.value === 'group' ? '请选择群组' : '请填写用户 id'
    return
  }
  sharing.value = true
  try {
    await addShare(shareModel.value.id, body)
    targetUserId.value = ''
    targetGroupId.value = ''
    shares.value = await listShares(shareModel.value.id)
  } catch (err) {
    shareError.value = err instanceof Error ? err.message : '添加共享失败'
  } finally {
    sharing.value = false
  }
}

async function onRemoveShare(shareId) {
  if (!shareModel.value) return
  shareError.value = ''
  try {
    await removeShare(shareModel.value.id, shareId)
    shares.value = await listShares(shareModel.value.id)
  } catch (err) {
    shareError.value = err instanceof Error ? err.message : '移除共享失败'
  }
}

onMounted(async () => {
  if (!auth.user && auth.access_token) {
    try {
      await auth.loadMe()
    } catch {
      pageError.value = '无法读取当前用户'
    }
  }
  await load()
})
</script>

<template>
  <section class="page">
    <header class="page-head">
      <div class="page-head-text">
        <h1>模型</h1>
        <p class="page-desc">
          统一管理对话、向量与重排模型的接入参数与可见范围。
        </p>
      </div>
      <div class="page-head-actions">
        <button type="button" class="ghost" :disabled="loading" @click="load">
          <AppIcon name="refresh" :size="15" />
          刷新
        </button>
        <button type="button" class="primary" @click="openCreate">
          <AppIcon name="plus" :size="15" />
          新建模型
        </button>
      </div>
    </header>

    <div class="toolbar">
      <div class="segmented" role="group" aria-label="按用途筛选">
        <button
          v-for="item in TYPE_FILTERS"
          :key="item.value"
          type="button"
          :class="{ active: typeFilter === item.value }"
          @click="setFilter(item.value)"
        >
          {{ item.label }}
        </button>
      </div>
      <span class="hint">共 {{ models.length }} 个模型</span>
    </div>

    <p v-if="pageError" class="alert error">
      <AppIcon name="alert" :size="14" />
      <span>{{ pageError }}</span>
    </p>

    <p v-if="testResult" class="alert" :class="testResult.ok ? 'success' : 'error'">
      <AppIcon :name="testResult.ok ? 'check' : 'alert'" :size="14" />
      <span>
        连通测试「{{ testResult.name }}」{{ testResult.ok ? '通过' : '失败' }}
        <template v-if="testResult.ok">
          ，返回「{{ testResult.sample }}」，耗时 {{ testResult.latency_ms }} ms
        </template>
        <template v-else-if="testResult.message">，{{ testResult.message }}</template>
      </span>
    </p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>用途</th>
            <th>供应商</th>
            <th>模型名</th>
            <th>可见性</th>
            <th>能力</th>
            <th>密钥</th>
            <th class="col-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="8">
              <div class="loading">
                <span class="spinner"></span>
                加载中…
              </div>
            </td>
          </tr>
          <tr v-else-if="models.length === 0">
            <td colspan="8">
              <div class="empty">
                <span class="empty-icon">
                  <AppIcon name="cpu" :size="20" />
                </span>
                <strong>没有可见模型</strong>
                <p>新建一个模型配置，或在筛选里换一个用途。</p>
                <button type="button" class="primary sm" @click="openCreate">
                  <AppIcon name="plus" :size="13" />
                  新建模型
                </button>
              </div>
            </td>
          </tr>
          <tr v-for="row in models" :key="row.id">
            <td>
              <div class="cell-main">
                <strong>{{ row.name }}</strong>
                <small>{{ row.base_url || '未设置 base_url' }}</small>
              </div>
            </td>
            <td>
              <span class="badge" :class="typeTone(row.model_type)" :title="row.model_type">
                {{ typeLabel(row.model_type) }}
              </span>
            </td>
            <td>{{ row.provider_type }}</td>
            <td><code class="mono">{{ row.model_name }}</code></td>
            <td>
              <span class="badge" :class="scopeTone(row.visibility_scope)">
                {{ scopeLabel(row.visibility_scope) }}
              </span>
            </td>
            <td>
              <div class="flags">
                <span v-if="row.is_vision" class="badge violet">视觉</span>
                <span v-if="row.supports_streaming" class="badge primary">流式</span>
                <span v-if="row.is_local" class="badge outline">本地</span>
                <span
                  v-if="!row.is_vision && !row.supports_streaming && !row.is_local"
                  class="muted"
                >
                  —
                </span>
              </div>
            </td>
            <td>
              <span v-if="row.api_key_masked" class="mono muted">{{ row.api_key_masked }}</span>
              <span v-else class="muted">未设置</span>
            </td>
            <td>
              <div class="row-actions">
                <button
                  type="button"
                  class="sm"
                  :disabled="testingId === row.id"
                  @click="onTest(row)"
                >
                  <AppIcon name="activity" :size="13" />
                  {{ testingId === row.id ? '测试中' : '测试' }}
                </button>
                <template v-if="isOwner(row)">
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
                    v-if="row.visibility_scope === 'shared'"
                    type="button"
                    class="sm icon"
                    title="共享设置"
                    aria-label="共享设置"
                    @click="openShare(row)"
                  >
                    <AppIcon name="users" :size="14" />
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
                </template>
                <span v-else class="badge outline">只读</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ModelForm
      v-if="formOpen"
      :key="editing ? editing.id : 'create'"
      :model="editing"
      :submitting="saving"
      :error="saveError"
      @submit="onSave"
      @cancel="formOpen = false"
    />

    <div v-if="pendingDelete" class="mask" @click.self="pendingDelete = null">
      <div class="dialog">
        <h2>删除模型</h2>
        <p class="hint">
          确定删除「<strong>{{ pendingDelete.name }}</strong>」？删除后引用该模型的会话将无法继续对话。
        </p>
        <div class="actions">
          <button type="button" class="ghost" @click="pendingDelete = null">取消</button>
          <button type="button" class="danger-solid" :disabled="deleting" @click="confirmDelete">
            {{ deleting ? '删除中…' : '删除' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="shareModel" class="mask" @click.self="shareModel = null">
      <div class="dialog share">
        <header class="dialog-head">
          <h2>共享「{{ shareModel.name }}」</h2>
          <p>共享后，指定用户或群组可以看到这个模型配置。</p>
        </header>

        <form class="share-form" @submit.prevent="onAddShare">
          <label class="field">
            <span>共享给</span>
            <select v-model="shareTarget">
              <option value="user">用户</option>
              <option value="group">群组</option>
            </select>
          </label>

          <label v-if="shareTarget === 'user'" class="field">
            <span>用户 id</span>
            <input v-model="targetUserId" type="number" min="1" step="1" placeholder="例如 12" />
          </label>

          <label v-else class="field">
            <span>群组</span>
            <select v-model="targetGroupId">
              <option value="">请选择</option>
              <option v-for="group in groups" :key="group.id" :value="String(group.id)">
                {{ group.name }}（{{ group.id }}）
              </option>
            </select>
          </label>

          <button type="submit" class="primary share-submit" :disabled="sharing">
            <AppIcon name="plus" :size="14" />
            {{ sharing ? '添加中…' : '新增共享' }}
          </button>
        </form>

        <p v-if="shareError" class="alert error">
          <AppIcon name="alert" :size="14" />
          <span>{{ shareError }}</span>
        </p>

        <div class="share-list">
          <p v-if="shares.length === 0" class="hint">还没有共享记录</p>
          <div v-for="item in shares" :key="item.id" class="share-row">
            <span class="share-who">
              <AppIcon :name="item.share_target_type === 'group' ? 'users' : 'shield'" :size="14" />
              <span v-if="item.share_target_type === 'group'">
                群组 {{ groupName(item.target_group_id) || item.target_group_id }}
              </span>
              <span v-else>用户 {{ item.target_user_id }}</span>
            </span>
            <button
              type="button"
              class="sm icon danger"
              title="移除共享"
              aria-label="移除共享"
              @click="onRemoveShare(item.id)"
            >
              <AppIcon name="close" :size="13" />
            </button>
          </div>
        </div>

        <div class="actions">
          <button type="button" class="ghost" @click="shareModel = null">关闭</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.mono {
  font-family: var(--font-mono);
  font-size: 12.5px;
}

.muted {
  color: var(--text-muted);
}

.col-actions {
  width: 1%;
  text-align: right;
}

.flags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.share-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 10px;
  align-items: end;
  padding: 12px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
}

.share-submit {
  height: 36px;
}

.dialog-head {
  display: grid;
  gap: 3px;
}

.dialog-head p {
  font-size: 12.5px;
  color: var(--text-muted);
}

.share-list {
  display: grid;
  gap: 2px;
}

.share-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 8px 7px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-subtle);
}

.share-who {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: var(--text-secondary);
}

.dialog.share {
  width: min(560px, 100%);
}

@media (max-width: 640px) {
  .share-form {
    grid-template-columns: minmax(0, 1fr);
  }

  .share-submit {
    width: 100%;
  }
}
</style>
