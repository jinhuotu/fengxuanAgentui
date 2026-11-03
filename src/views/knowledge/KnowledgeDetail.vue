<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  deleteDocument,
  getKnowledgeBase,
  grantPermission,
  listDocuments,
  listPermissions,
  retrieve,
  revokePermission,
  updateKnowledgeBase,
  uploadDocument,
} from '@/api/knowledge'
import { listModels } from '@/api/models'
import AppIcon from '@/components/AppIcon.vue'

const route = useRoute()
const allowedExtensions = new Set([
  'pdf',
  'txt',
  'md',
  'markdown',
  'docx',
  'html',
  'htm',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'tif',
  'tiff',
])

const kb = ref(null)
const documents = ref([])
const permissions = ref([])
const embeddingModels = ref([])
const pageError = ref('')
const docError = ref('')
const permissionError = ref('')
const retrieveError = ref('')
const configError = ref('')
const loading = ref(false)
const uploading = ref(false)
const savingConfig = ref(false)
const retrieving = ref(false)
const pendingDelete = ref(null)
const deleting = ref(false)
const hits = ref([])
const query = ref('')
const topK = ref('')
const grantUserId = ref('')
const grantRole = ref('reader')
const granting = ref(false)
const config = ref(null)
let pollTimer = 0

const isEditor = computed(() => kb.value?.role === 'editor')
const embeddingOptions = computed(() => {
  const options = embeddingModels.value.map((model) => ({
    id: model.id,
    label: `${model.name}（${model.model_name}）`,
  }))
  const currentId = Number(kb.value?.embedding_config_id)
  if (currentId && !options.some((item) => Number(item.id) === currentId)) {
    options.unshift({ id: currentId, label: `#${currentId}` })
  }
  return options
})

function errorText(err, fallback) {
  const message = err instanceof Error ? err.message : fallback
  if (err && err.code === 40300) return `403 ${message}`
  if (err && err.code === 40400) return `404 ${message}`
  return message
}

function modelName(id) {
  const found = embeddingModels.value.find((item) => Number(item.id) === Number(id))
  return found ? `${found.name}（${found.model_name}）` : `#${id}`
}

function formatScore(score) {
  const number = Number(score)
  return Number.isNaN(number) ? String(score) : number.toFixed(4)
}

function roleLabel(role) {
  if (role === 'editor') return '可编辑'
  if (role === 'reader') return '只读'
  return role || '未知'
}

function roleTone(role) {
  if (role === 'editor') return 'primary'
  if (role === 'reader') return 'outline'
  return ''
}

function statusLabel(status) {
  if (status === 'ready') return '就绪'
  if (status === 'processing') return '处理中'
  if (status === 'pending') return '排队中'
  if (status === 'failed') return '失败'
  return status || '未知'
}

function statusTone(status) {
  if (status === 'ready') return 'success'
  if (status === 'processing' || status === 'pending') return 'warning'
  if (status === 'failed') return 'danger'
  return 'outline'
}

function stopPoll() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = 0
  }
}

function schedulePoll() {
  stopPoll()
  const busy = documents.value.some(
    (item) => item.status === 'pending' || item.status === 'processing',
  )
  if (!busy || !kb.value) return
  pollTimer = setTimeout(async () => {
    await refreshDocuments()
    schedulePoll()
  }, 2000)
}

function fillConfig(row) {
  config.value = {
    name: row.name,
    description: row.description || '',
    embedding_config_id: String(row.embedding_config_id),
    chunk_size: row.chunk_size,
    chunk_overlap_ratio: row.chunk_overlap_ratio,
    retrieval_top_k: row.retrieval_top_k,
    enable_hybrid_search: Boolean(row.enable_hybrid_search),
  }
}

async function refreshDocuments() {
  if (!kb.value) return
  try {
    documents.value = await listDocuments(kb.value.id)
    docError.value = ''
  } catch (err) {
    docError.value = errorText(err, '刷新文档失败')
    stopPoll()
  }
}

async function loadAll() {
  stopPoll()
  kb.value = null
  documents.value = []
  permissions.value = []
  hits.value = []
  pageError.value = ''
  docError.value = ''
  permissionError.value = ''
  loading.value = true
  try {
    const row = await getKnowledgeBase(route.params.id)
    kb.value = row
    fillConfig(row)
    topK.value = String(row.retrieval_top_k)
    embeddingModels.value = await listModels('embedding').catch(() => [])
    try {
      documents.value = await listDocuments(row.id)
      schedulePoll()
    } catch (err) {
      docError.value = errorText(err, '加载文档失败')
    }
    try {
      permissions.value = await listPermissions(row.id)
    } catch (err) {
      permissionError.value = errorText(err, '加载权限失败')
    }
  } catch (err) {
    pageError.value = errorText(err, '无法打开知识库')
  } finally {
    loading.value = false
  }
}

async function onUpload(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || !kb.value) return
  const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
  if (!allowedExtensions.has(extension)) {
    docError.value = '只支持 pdf、txt、md、docx、html，以及需要 OCR 的图片'
    return
  }
  uploading.value = true
  docError.value = ''
  try {
    await uploadDocument(kb.value.id, file)
    await refreshDocuments()
    schedulePoll()
  } catch (err) {
    docError.value = errorText(err, '上传失败')
  } finally {
    uploading.value = false
  }
}

async function confirmDelete() {
  if (!pendingDelete.value || !kb.value) return
  deleting.value = true
  docError.value = ''
  try {
    await deleteDocument(kb.value.id, pendingDelete.value.id)
    pendingDelete.value = null
    await refreshDocuments()
    schedulePoll()
  } catch (err) {
    docError.value = errorText(err, '删除文档失败')
  } finally {
    deleting.value = false
  }
}

async function onSaveConfig() {
  if (!kb.value || !config.value) return
  configError.value = ''
  const overlap = Number(config.value.chunk_overlap_ratio)
  if (overlap < 0.1 || overlap > 0.15) {
    configError.value = 'chunk_overlap_ratio 需要在 0.10 到 0.15 之间'
    return
  }
  savingConfig.value = true
  try {
    kb.value = await updateKnowledgeBase(kb.value.id, {
      name: config.value.name.trim(),
      description: config.value.description.trim() || null,
      embedding_config_id: Number(config.value.embedding_config_id),
      chunk_size: Number(config.value.chunk_size),
      chunk_overlap_ratio: overlap,
      retrieval_top_k: Number(config.value.retrieval_top_k),
      enable_hybrid_search: config.value.enable_hybrid_search ? 1 : 0,
    })
    fillConfig(kb.value)
  } catch (err) {
    configError.value = errorText(err, '保存配置失败')
  } finally {
    savingConfig.value = false
  }
}

async function onGrant() {
  if (!kb.value) return
  permissionError.value = ''
  const userId = Number(grantUserId.value)
  if (!Number.isInteger(userId) || userId < 1) {
    permissionError.value = '请填写用户 id'
    return
  }
  granting.value = true
  try {
    await grantPermission(kb.value.id, { user_id: userId, role: grantRole.value })
    grantUserId.value = ''
    permissions.value = await listPermissions(kb.value.id)
  } catch (err) {
    permissionError.value = errorText(err, '授权失败')
  } finally {
    granting.value = false
  }
}

async function onRevoke(permissionId) {
  if (!kb.value) return
  permissionError.value = ''
  try {
    await revokePermission(kb.value.id, permissionId)
    permissions.value = await listPermissions(kb.value.id)
  } catch (err) {
    permissionError.value = errorText(err, '移除权限失败')
  }
}

async function onRetrieve() {
  if (!kb.value) return
  retrieveError.value = ''
  hits.value = []
  const body = { query: query.value.trim() }
  if (String(topK.value).trim()) body.top_k = Number(topK.value)
  retrieving.value = true
  try {
    hits.value = await retrieve(kb.value.id, body)
  } catch (err) {
    retrieveError.value = errorText(err, '检索失败')
  } finally {
    retrieving.value = false
  }
}

watch(() => route.params.id, loadAll, { immediate: true })
onUnmounted(stopPoll)
</script>

<template>
  <section class="page">
    <header class="detail-head">
      <router-link to="/knowledge" class="back">
        <AppIcon name="back" :size="15" />
        知识库
      </router-link>

      <div class="head-row">
        <div class="head-text">
          <h1>{{ kb?.name || '知识库' }}</h1>
          <p class="page-desc">{{ kb?.description || '未填写描述' }}</p>
        </div>
        <span v-if="kb" class="badge" :class="roleTone(kb.role)">{{ roleLabel(kb.role) }}</span>
      </div>
    </header>

    <p v-if="loading" class="loading">
      <span class="spinner"></span>
      加载中…
    </p>

    <p v-if="pageError" class="alert error">
      <AppIcon name="alert" :size="14" />
      <span>{{ pageError }}</span>
    </p>

    <template v-if="kb">
      <section class="card">
        <header class="card-head">
          <h2>配置</h2>
          <div class="flags">
            <span class="badge outline">{{ modelName(kb.embedding_config_id) }}</span>
            <span class="badge">chunk {{ kb.chunk_size }} · 重叠 {{ kb.chunk_overlap_ratio }}</span>
            <span class="badge">top_k {{ kb.retrieval_top_k }}</span>
            <span class="badge" :class="kb.enable_hybrid_search ? 'success' : 'outline'">
              {{ kb.enable_hybrid_search ? '混合检索' : '纯向量' }}
            </span>
          </div>
        </header>

        <form v-if="isEditor && config" class="form-grid" @submit.prevent="onSaveConfig">
          <label class="field">
            <span>名称</span>
            <input v-model="config.name" required maxlength="128" />
          </label>

          <label class="field">
            <span>向量模型</span>
            <select v-model="config.embedding_config_id">
              <option v-for="model in embeddingOptions" :key="model.id" :value="String(model.id)">
                {{ model.label }}
              </option>
            </select>
          </label>

          <label class="field">
            <span>chunk_size</span>
            <input v-model="config.chunk_size" type="number" min="64" max="8192" required />
          </label>

          <label class="field">
            <span>chunk_overlap_ratio</span>
            <input
              v-model="config.chunk_overlap_ratio"
              type="number"
              min="0.1"
              max="0.15"
              step="0.01"
              required
            />
          </label>

          <label class="field">
            <span>retrieval_top_k</span>
            <input v-model="config.retrieval_top_k" type="number" min="1" max="50" required />
          </label>

          <label class="check hybrid">
            <input v-model="config.enable_hybrid_search" type="checkbox" />
            启用混合检索
          </label>

          <p v-if="configError" class="alert error span-2">
            <AppIcon name="alert" :size="14" />
            <span>{{ configError }}</span>
          </p>

          <div class="span-2 form-actions">
            <button type="submit" class="primary" :disabled="savingConfig">
              <AppIcon v-if="!savingConfig" name="save" :size="14" />
              <span v-else class="spinner light"></span>
              {{ savingConfig ? '保存中…' : '保存配置' }}
            </button>
          </div>
        </form>

        <p v-else class="hint">只读成员只能查看配置，不能修改。</p>
      </section>

      <section class="card">
        <header class="card-head">
          <h2>
            文档
            <span class="badge outline">{{ documents.length }}</span>
          </h2>
          <button type="button" class="sm ghost" @click="refreshDocuments">
            <AppIcon name="refresh" :size="13" />
            刷新状态
          </button>
        </header>

        <label v-if="isEditor" class="dropzone" :class="{ busy: uploading }">
          <input
            type="file"
            accept=".pdf,.txt,.md,.markdown,.docx,.html,.htm,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff"
            :disabled="uploading"
            @change="onUpload"
          />
          <span class="dz-icon">
            <AppIcon name="upload" :size="18" />
          </span>
          <span class="dz-text">
            <strong>{{ uploading ? '上传中…' : '上传文档' }}</strong>
            <small>支持 pdf、txt、md、docx、html；图片会标记为需要 OCR</small>
          </span>
        </label>
        <p v-else class="hint">只读成员不能上传或删除文档。</p>

        <p v-if="docError" class="alert error">
          <AppIcon name="alert" :size="14" />
          <span>{{ docError }}</span>
        </p>

        <div v-if="documents.length === 0" class="empty">
          <span class="empty-icon">
            <AppIcon name="file" :size="20" />
          </span>
          <strong>还没有文档</strong>
          <p>上传后会自动切块并写入向量库，处理中会每 2 秒刷新状态。</p>
        </div>

        <div v-else class="table-wrap inner">
          <table>
            <thead>
              <tr>
                <th>文件名</th>
                <th>类型</th>
                <th>状态</th>
                <th>切块数</th>
                <th>OCR</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="doc in documents" :key="doc.id">
                <td>
                  <div class="cell-main">
                    <strong>{{ doc.file_name }}</strong>
                    <small v-if="doc.status === 'failed' && doc.error_msg">{{ doc.error_msg }}</small>
                  </div>
                </td>
                <td><span class="mono">{{ doc.file_type }}</span></td>
                <td>
                  <span class="badge" :class="statusTone(doc.status)">
                    <span class="dot"></span>
                    {{ statusLabel(doc.status) }}
                  </span>
                </td>
                <td>{{ doc.chunk_count }}</td>
                <td>
                  <span class="badge" :class="doc.ocr_required ? 'warning' : 'outline'">
                    {{ doc.ocr_required ? '需要' : '否' }}
                  </span>
                </td>
                <td class="col-actions">
                  <button
                    v-if="isEditor"
                    type="button"
                    class="sm icon danger"
                    title="删除文档"
                    aria-label="删除文档"
                    @click="pendingDelete = doc"
                  >
                    <AppIcon name="trash" :size="14" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <header class="card-head">
          <h2>权限</h2>
          <p>除所有者外，额外授权 {{
            permissions.length
          }} 人</p>
        </header>

        <form v-if="isEditor" class="grant" @submit.prevent="onGrant">
          <label class="field">
            <span>用户 id</span>
            <input v-model="grantUserId" type="number" min="1" step="1" placeholder="例如 12" />
          </label>

          <label class="field">
            <span>角色</span>
            <select v-model="grantRole">
              <option value="editor">editor · 可编辑</option>
              <option value="reader">reader · 只读</option>
            </select>
          </label>

          <button type="submit" class="primary grant-submit" :disabled="granting">
            <AppIcon name="plus" :size="14" />
            {{ granting ? '授权中…' : '授权' }}
          </button>
        </form>

        <p v-if="permissionError" class="alert error">
          <AppIcon name="alert" :size="14" />
          <span>{{ permissionError }}</span>
        </p>

        <div v-if="permissions.length === 0" class="empty compact">
          <span class="empty-icon">
            <AppIcon name="users" :size="18" />
          </span>
          <strong>还没有额外授权</strong>
          <p>只有你自己可以访问这个知识库。</p>
        </div>

        <div v-else class="perm-list">
          <div v-for="item in permissions" :key="item.id" class="perm-row">
            <span class="perm-who">
              <span class="avatar">
                <AppIcon name="shield" :size="12" />
              </span>
              用户 {{ item.user_id }}
            </span>
            <div class="perm-right">
              <span class="badge" :class="roleTone(item.role)">{{ roleLabel(item.role) }}</span>
              <button
                v-if="isEditor && item.user_id !== kb.user_id"
                type="button"
                class="sm icon danger"
                title="移除权限"
                aria-label="移除权限"
                @click="onRevoke(item.id)"
              >
                <AppIcon name="close" :size="13" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="card">
        <header class="card-head">
          <h2>检索测试</h2>
          <p>提交一个问题，查看 Top-K 片段与相似度</p>
        </header>

        <form class="grant" @submit.prevent="onRetrieve">
          <label class="field query-field">
            <span>query</span>
            <input v-model="query" required maxlength="4000" placeholder="例如：退款流程是怎样的？" />
          </label>

          <label class="field">
            <span>top_k</span>
            <input v-model="topK" type="number" min="1" max="50" />
          </label>

          <button type="submit" class="primary grant-submit" :disabled="retrieving">
            <AppIcon v-if="!retrieving" name="search" :size="14" />
            <span v-else class="spinner light"></span>
            {{ retrieving ? '检索中…' : '检索' }}
          </button>
        </form>

        <p v-if="retrieveError" class="alert error">
          <AppIcon name="alert" :size="14" />
          <span>{{ retrieveError }}</span>
        </p>

        <p v-else-if="!retrieving && hits.length === 0" class="hint">
          提交问题后，这里会显示召回片段与相似度分数。
        </p>

        <div v-else class="hits">
          <article v-for="(hit, index) in hits" :key="`${hit.document_id}-${hit.chunk_index}-${index}`" class="hit">
            <header class="hit-head">
              <span class="hit-doc">
                <AppIcon name="file" :size="13" />
                {{ hit.doc_name }} · {{ hit.file_type }}
              </span>
              <span class="badge primary">相似度 {{ formatScore(hit.score) }}</span>
            </header>
            <pre class="code">{{ hit.text }}</pre>
          </article>
        </div>
      </section>
    </template>

    <div v-if="pendingDelete" class="mask" @click.self="pendingDelete = null">
      <div class="dialog">
        <h2>删除文档</h2>
        <p class="hint">
          确定删除「<strong>{{ pendingDelete.file_name }}</strong>」？对应的向量切块会一起清掉。
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
.detail-head {
  display: grid;
  gap: 10px;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: fit-content;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.back:hover {
  color: var(--color-primary);
}

.head-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.head-text {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.flags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.span-2 {
  grid-column: 1 / -1;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.hybrid {
  align-self: end;
  height: 36px;
}

.dropzone {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  overflow: hidden;
  background: var(--bg-subtle);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color var(--transition), background var(--transition);
}

.dropzone:hover {
  border-color: var(--color-primary-300);
  background: var(--color-primary-50);
}

.dropzone.busy {
  opacity: 0.75;
  pointer-events: none;
}

.dropzone input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  opacity: 0;
  cursor: pointer;
}

.dz-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  color: var(--color-primary);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.dz-text {
  display: grid;
  gap: 1px;
}

.dz-text strong {
  font-size: 13px;
  font-weight: 600;
}

.dz-text small {
  font-size: 11.5px;
  color: var(--text-muted);
}

.table-wrap.inner {
  box-shadow: none;
  border-radius: var(--radius-md);
}

.mono {
  font-family: var(--font-mono);
  font-size: 12.5px;
}

.col-actions {
  width: 1%;
  text-align: right;
}

.grant {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto;
  gap: 10px;
  align-items: end;
  padding: 12px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
}

.grant-submit {
  height: 36px;
}

.perm-list {
  display: grid;
  gap: 2px;
}

.perm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-subtle);
}

.perm-who {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.perm-right {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.avatar {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  color: var(--color-primary);
  background: var(--color-primary-50);
  border: 1px solid var(--color-primary-100);
  border-radius: 50%;
}

.hits {
  display: grid;
  gap: 10px;
}

.hit {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
}

.hit-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.hit-doc {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-secondary);
}

.hit pre.code {
  margin: 0;
  background: var(--bg-card);
}

.spinner.light {
  border-color: rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
}

@media (max-width: 720px) {
  .grant {
    grid-template-columns: minmax(0, 1fr);
  }

  .grant-submit {
    width: 100%;
  }

  .hybrid {
    justify-self: start;
  }
}
</style>
