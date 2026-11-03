<script setup>
import { reactive, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'

const props = defineProps({
  model: { type: Object, default: null },
  submitting: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['submit', 'cancel'])

const source = props.model
const localError = ref('')
const form = reactive({
  name: source?.name || '',
  model_type: source?.model_type || 'chat',
  provider_type: source?.provider_type || '',
  model_name: source?.model_name || '',
  base_url: source?.base_url || '',
  api_key: '',
  is_vision: Boolean(source?.is_vision),
  supports_streaming: source ? Boolean(source.supports_streaming) : true,
  is_local: Boolean(source?.is_local),
  visibility_scope: source?.visibility_scope || 'private',
  embedding_source: source?.embedding_source || '',
  local_model_name: source?.local_model_name || '',
  dimension: source?.dimension ?? '',
})

function emptyToNull(value) {
  const text = String(value ?? '').trim()
  return text ? text : null
}

function buildPayload() {
  const dimensionText = String(form.dimension ?? '').trim()
  const dimension = dimensionText === '' ? null : Number(dimensionText)
  const payload = {
    name: form.name.trim(),
    model_type: form.model_type,
    provider_type: form.provider_type.trim(),
    model_name: form.model_name.trim(),
    base_url: emptyToNull(form.base_url),
    is_vision: form.is_vision,
    supports_streaming: form.supports_streaming,
    is_local: form.is_local,
    visibility_scope: form.visibility_scope,
    embedding_source: form.embedding_source || null,
    local_model_name: emptyToNull(form.local_model_name),
    dimension: Number.isInteger(dimension) ? dimension : null,
  }
  const apiKey = form.api_key.trim()
  if (apiKey) payload.api_key = apiKey
  return payload
}

function onSubmit() {
  localError.value = ''
  if (form.model_type === 'embedding') {
    if (!form.embedding_source) {
      localError.value = 'embedding 模型必须指定 embedding_source'
      return
    }
    if (!Number.isInteger(Number(form.dimension)) || Number(form.dimension) <= 0) {
      localError.value = 'embedding 模型必须填写正整数 dimension'
      return
    }
    if (form.embedding_source === 'local' && !form.local_model_name.trim()) {
      localError.value = '本地 embedding 必须填写 local_model_name'
      return
    }
  }
  emit('submit', buildPayload())
}
</script>

<template>
  <div class="mask" @mousedown.self="emit('cancel')">
    <form class="dialog panel" @submit.prevent="onSubmit">
      <header class="panel-head">
        <h2>{{ model ? '编辑模型' : '新建模型' }}</h2>
        <p>api_key 只随本次请求提交，列表里只显示打码值。</p>
      </header>

      <div class="form-grid">
        <label class="field">
          <span>名称</span>
          <input v-model="form.name" required maxlength="128" placeholder="便于识别的名字" />
        </label>

        <label class="field">
          <span>用途 model_type</span>
          <select v-model="form.model_type" required>
            <option value="chat">chat · 对话</option>
            <option value="embedding">embedding · 向量</option>
            <option value="rerank">rerank · 重排</option>
          </select>
        </label>

        <label class="field">
          <span>供应商 provider_type</span>
          <input v-model="form.provider_type" required maxlength="32" placeholder="openai / ollama / custom" />
        </label>

        <label class="field">
          <span>模型名 model_name</span>
          <input v-model="form.model_name" required maxlength="128" placeholder="gpt-4o-mini" />
        </label>

        <label class="field span-2">
          <span>接口地址 base_url</span>
          <input v-model="form.base_url" maxlength="512" placeholder="https://api.example.com/v1" />
        </label>

        <label class="field span-2">
          <span>API 密钥 api_key</span>
          <input
            v-model="form.api_key"
            type="password"
            autocomplete="off"
            :placeholder="model?.api_key_masked ? '留空表示不修改' : '仅在提交时发送'"
          />
          <small v-if="model?.api_key_masked">
            已保存 {{ model.api_key_masked }}，留空不会改密钥，也不会回显明文。
          </small>
          <small v-else>密钥只随本次请求提交，列表里只显示打码值。</small>
        </label>

        <label class="field">
          <span>可见性 visibility_scope</span>
          <select v-model="form.visibility_scope">
            <option value="private">private · 仅自己</option>
            <option value="shared">shared · 共享</option>
            <option value="public">public · 公开</option>
          </select>
        </label>

        <label class="field">
          <span>向量来源 embedding_source</span>
          <select v-model="form.embedding_source">
            <option value="">不使用</option>
            <option value="local">local · 本地</option>
            <option value="online">online · 在线</option>
          </select>
        </label>

        <label class="field">
          <span>本地模型名 local_model_name</span>
          <input v-model="form.local_model_name" maxlength="128" placeholder="bge-m3" />
        </label>

        <label class="field">
          <span>向量维度 dimension</span>
          <input v-model="form.dimension" type="number" min="1" max="20000" step="1" placeholder="1024" />
        </label>
      </div>

      <fieldset class="flags">
        <legend>能力开关</legend>
        <label class="check">
          <input v-model="form.is_vision" type="checkbox" />
          支持图片输入 is_vision
        </label>
        <label class="check">
          <input v-model="form.supports_streaming" type="checkbox" />
          支持流式输出 supports_streaming
        </label>
        <label class="check">
          <input v-model="form.is_local" type="checkbox" />
          本地部署 is_local
        </label>
      </fieldset>

      <p v-if="localError || error" class="alert error">
        <AppIcon name="alert" :size="14" />
        <span>{{ localError || error }}</span>
      </p>

      <div class="actions">
        <button type="button" class="ghost" @click="emit('cancel')">取消</button>
        <button type="submit" class="primary" :disabled="submitting">
          <span v-if="submitting" class="spinner light"></span>
          {{ submitting ? '保存中…' : '保存' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.panel {
  width: min(680px, 100%);
}

.panel-head {
  display: grid;
  gap: 3px;
}

.panel-head h2 {
  font-size: 16px;
}

.panel-head p {
  font-size: 12.5px;
  color: var(--text-muted);
}

.span-2 {
  grid-column: 1 / -1;
}

.flags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
}

.flags legend {
  margin-bottom: 2px;
}

.spinner.light {
  border-color: rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
}

@media (max-width: 640px) {
  .flags {
    display: grid;
    gap: 8px;
  }
}
</style>
