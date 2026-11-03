<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createKnowledgeBase, listKnowledgeBases } from '@/api/knowledge'
import { listModels } from '@/api/models'
import AppIcon from '@/components/AppIcon.vue'

const router = useRouter()
const libraries = ref([])
const embeddingModels = ref([])
const loading = ref(false)
const pageError = ref('')
const creating = ref(false)
const formOpen = ref(false)
const formError = ref('')
const form = ref(emptyForm())

function emptyForm() {
  return {
    name: '',
    description: '',
    embedding_config_id: '',
    chunk_size: 512,
    chunk_overlap_ratio: 0.12,
    retrieval_top_k: 5,
    enable_hybrid_search: true,
  }
}

function errorText(err, fallback) {
  const message = err instanceof Error ? err.message : fallback
  if (err && err.code === 40300) return `403 ${message}`
  if (err && err.code === 40400) return `404 ${message}`
  return message
}

function modelName(id) {
  const found = embeddingModels.value.find((item) => Number(item.id) === Number(id))
  return found ? found.name : `#${id}`
}

function roleTone(role) {
  if (role === 'editor') return 'primary'
  if (role === 'reader') return 'outline'
  return ''
}

function roleLabel(role) {
  if (role === 'editor') return '可编辑'
  if (role === 'reader') return '只读'
  return role || '未知'
}

async function load() {
  loading.value = true
  pageError.value = ''
  try {
    const [rows, models] = await Promise.all([
      listKnowledgeBases(),
      listModels('embedding').catch(() => []),
    ])
    libraries.value = rows
    embeddingModels.value = models
  } catch (err) {
    pageError.value = errorText(err, '加载知识库失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.value = emptyForm()
  if (embeddingModels.value.length === 1) {
    form.value.embedding_config_id = String(embeddingModels.value[0].id)
  }
  formError.value = ''
  formOpen.value = true
}

async function onCreate() {
  formError.value = ''
  const overlap = Number(form.value.chunk_overlap_ratio)
  if (!form.value.embedding_config_id) {
    formError.value = '请选择 embedding 模型'
    return
  }
  if (overlap < 0.1 || overlap > 0.15) {
    formError.value = 'chunk_overlap_ratio 需要在 0.10 到 0.15 之间'
    return
  }
  creating.value = true
  try {
    const created = await createKnowledgeBase({
      name: form.value.name.trim(),
      description: form.value.description.trim() || null,
      embedding_config_id: Number(form.value.embedding_config_id),
      chunk_size: Number(form.value.chunk_size),
      chunk_overlap_ratio: overlap,
      retrieval_top_k: Number(form.value.retrieval_top_k),
      enable_hybrid_search: form.value.enable_hybrid_search ? 1 : 0,
    })
    formOpen.value = false
    router.push(`/knowledge/${created.id}`)
  } catch (err) {
    formError.value = errorText(err, '创建知识库失败')
  } finally {
    creating.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="page">
    <header class="page-head">
      <div class="page-head-text">
        <h1>知识库</h1>
        <p class="page-desc">
          列出本人创建的与被授权的知识库，点进任意一行管理文档、权限与检索。
        </p>
      </div>
      <div class="page-head-actions">
        <button type="button" class="ghost" :disabled="loading" @click="load">
          <AppIcon name="refresh" :size="15" />
          刷新
        </button>
        <button type="button" class="primary" @click="openCreate">
          <AppIcon name="plus" :size="15" />
          新建知识库
        </button>
      </div>
    </header>

    <p v-if="pageError" class="alert error">
      <AppIcon name="alert" :size="14" />
      <span>{{ pageError }}</span>
    </p>

    <div v-if="loading" class="loading">
      <span class="spinner"></span>
      加载中…
    </div>

    <div v-else-if="libraries.length === 0" class="card empty">
      <span class="empty-icon">
        <AppIcon name="database" :size="20" />
      </span>
      <strong>还没有知识库</strong>
      <p>先创建一个知识库，再上传文档建立索引。</p>
      <button type="button" class="primary sm" @click="openCreate">
        <AppIcon name="plus" :size="13" />
        新建知识库
      </button>
    </div>

    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>向量模型</th>
            <th>切块</th>
            <th>检索</th>
            <th>我的角色</th>
            <th class="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in libraries" :key="row.id">
            <td>
              <div class="cell-main">
                <router-link :to="`/knowledge/${row.id}`" class="kb-name">
                  {{ row.name }}
                </router-link>
                <small>{{ row.description || '暂无描述' }}</small>
              </div>
            </td>
            <td>{{ modelName(row.embedding_config_id) }}</td>
            <td>
              <div class="cell-main">
                <strong>{{ row.chunk_size }}</strong>
                <small>重叠 {{ row.chunk_overlap_ratio }}</small>
              </div>
            </td>
            <td>
              <div class="flags">
                <span class="badge">top_k {{ row.retrieval_top_k }}</span>
                <span class="badge" :class="row.enable_hybrid_search ? 'success' : 'outline'">
                  {{ row.enable_hybrid_search ? '混合检索' : '纯向量' }}
                </span>
              </div>
            </td>
            <td>
              <span class="badge" :class="roleTone(row.role)">{{ roleLabel(row.role) }}</span>
            </td>
            <td>
              <router-link :to="`/knowledge/${row.id}`" class="enter">
                进入
                <AppIcon name="chevronRight" :size="14" />
              </router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="formOpen" class="mask" @click.self="formOpen = false">
      <form class="dialog create" @submit.prevent="onCreate">
        <header class="dialog-head">
          <h2>新建知识库</h2>
          <p>创建后可以上传文档，切块参数之后仍可调整。</p>
        </header>

        <label class="field">
          <span>名称</span>
          <input v-model="form.name" required maxlength="128" placeholder="例如：产品文档库" />
        </label>

        <label class="field">
          <span>描述</span>
          <input v-model="form.description" maxlength="512" placeholder="一句话说明这个知识库放什么" />
        </label>

        <label class="field">
          <span>向量模型</span>
          <select v-model="form.embedding_config_id" required>
            <option value="">请选择</option>
            <option v-for="model in embeddingModels" :key="model.id" :value="String(model.id)">
              {{ model.name }}（{{ model.model_name }}）
            </option>
          </select>
        </label>

        <p v-if="embeddingModels.length === 0" class="alert warning">
          <AppIcon name="alert" :size="14" />
          <span>还没有可用的 embedding 模型，请先在「模型」页创建。</span>
        </p>

        <div class="form-grid">
          <label class="field">
            <span>chunk_size</span>
            <input v-model="form.chunk_size" type="number" min="64" max="8192" step="1" required />
          </label>

          <label class="field">
            <span>chunk_overlap_ratio</span>
            <input
              v-model="form.chunk_overlap_ratio"
              type="number"
              min="0.1"
              max="0.15"
              step="0.01"
              required
            />
          </label>

          <label class="field">
            <span>retrieval_top_k</span>
            <input v-model="form.retrieval_top_k" type="number" min="1" max="50" step="1" required />
          </label>

          <label class="check hybrid">
            <input v-model="form.enable_hybrid_search" type="checkbox" />
            启用混合检索
          </label>
        </div>

        <p v-if="formError" class="alert error">
          <AppIcon name="alert" :size="14" />
          <span>{{ formError }}</span>
        </p>

        <div class="actions">
          <button type="button" class="ghost" @click="formOpen = false">取消</button>
          <button type="submit" class="primary" :disabled="creating || embeddingModels.length === 0">
            <span v-if="creating" class="spinner light"></span>
            {{ creating ? '创建中…' : '创建' }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.kb-name {
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kb-name:hover {
  color: var(--color-primary);
}

.flags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.col-actions {
  width: 1%;
  text-align: right;
}

.enter {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12.5px;
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

.dialog.create {
  width: min(560px, 100%);
}

.hybrid {
  align-self: end;
  height: 36px;
}

.spinner.light {
  border-color: rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
}
</style>
