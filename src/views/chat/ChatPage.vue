<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  sendMessage,
  streamMessage,
  updateConversation,
} from '@/api/chat'
import { listKnowledgeBases } from '@/api/knowledge'
import { listModels } from '@/api/models'
import { listSystemPrompts, listUserPrompts } from '@/api/prompts'
import AppIcon from '@/components/AppIcon.vue'

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MODE_OPTIONS = [
  { value: 'non_streaming', label: '非流式' },
  { value: 'streaming', label: '流式' },
  { value: 'multimodal', label: '多模态' },
]

const conversations = ref([])
const current = ref(null)
const messages = ref([])
const outputMode = ref('non_streaming')
const loading = ref(false)
const sending = ref(false)
const pageError = ref('')

const draft = ref('')
const files = ref([])
const imageUrls = ref([])
const urlDraft = ref('')
const messagePane = ref(null)
const blobUrls = []

const formOpen = ref(false)
const creating = ref(false)
const formError = ref('')
const form = ref(emptyForm())
const chatModels = ref([])
const systemPrompts = ref([])
const userPrompts = ref([])
const knowledgeBases = ref([])

const renamingId = ref(null)
const titleDraft = ref('')

function emptyForm() {
  return {
    title: '',
    model_config_id: '',
    output_mode: 'non_streaming',
    system_prompt_id: '',
    user_prompt_id: '',
    kbIds: [],
  }
}

function errorText(err, fallback) {
  const message = err instanceof Error ? err.message : fallback
  if (err && err.code === 40300) return `403 ${message}`
  if (err && err.code === 40400) return `404 ${message}`
  return message || fallback
}

function modeLabel(mode) {
  return MODE_OPTIONS.find((item) => item.value === mode)?.label || mode
}

function modeTone(mode) {
  if (mode === 'streaming') return 'primary'
  if (mode === 'multimodal') return 'violet'
  return ''
}

function roleLabel(role) {
  if (role === 'user') return '我'
  if (role === 'assistant') return '助手'
  return role || '消息'
}

function showableImage(image) {
  const url = image?.image_url || ''
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')
}

function scrollToBottom() {
  nextTick(() => {
    const pane = messagePane.value
    if (pane) pane.scrollTop = pane.scrollHeight
  })
}

async function loadConversations() {
  loading.value = true
  pageError.value = ''
  try {
    conversations.value = await listConversations()
  } catch (err) {
    pageError.value = errorText(err, '加载会话失败')
  } finally {
    loading.value = false
  }
}

async function openConversation(id) {
  if (sending.value || current.value?.id === id) return
  pageError.value = ''
  try {
    const detail = await getConversation(id)
    current.value = detail
    messages.value = detail.messages || []
    outputMode.value = detail.output_mode || 'non_streaming'
    scrollToBottom()
  } catch (err) {
    pageError.value = errorText(err, '加载会话失败')
  }
}

async function openCreate() {
  form.value = emptyForm()
  formError.value = ''
  formOpen.value = true
  try {
    const [models, systems, users, libraries] = await Promise.all([
      listModels('chat'),
      listSystemPrompts(),
      listUserPrompts(),
      listKnowledgeBases(),
    ])
    chatModels.value = models
    systemPrompts.value = systems
    userPrompts.value = users
    knowledgeBases.value = libraries
    if (models.length === 1) form.value.model_config_id = String(models[0].id)
  } catch (err) {
    formError.value = errorText(err, '加载选项失败')
  }
}

async function onCreate() {
  formError.value = ''
  if (!form.value.model_config_id) {
    formError.value = '请选择模型'
    return
  }
  const payload = {
    title: form.value.title.trim() || '新会话',
    model_config_id: Number(form.value.model_config_id),
    output_mode: form.value.output_mode,
    knowledge_bases: knowledgeBases.value
      .filter((item) => form.value.kbIds.map(Number).includes(Number(item.id)))
      .map((item) => ({
        kb_id: item.id,
        retrieval_top_k: item.retrieval_top_k || 5,
      })),
  }
  if (form.value.system_prompt_id) payload.system_prompt_id = Number(form.value.system_prompt_id)
  if (form.value.user_prompt_id) payload.user_prompt_id = Number(form.value.user_prompt_id)
  creating.value = true
  try {
    const created = await createConversation(payload)
    formOpen.value = false
    await loadConversations()
    await openConversation(created.id)
  } catch (err) {
    formError.value = errorText(err, '创建会话失败')
  } finally {
    creating.value = false
  }
}

function startRename(item) {
  renamingId.value = item.id
  titleDraft.value = item.title
}

async function saveTitle(item) {
  const title = titleDraft.value.trim()
  renamingId.value = null
  if (!title || title === item.title) return
  try {
    const updated = await updateConversation(item.id, { title })
    item.title = updated.title
    if (current.value?.id === item.id) current.value.title = updated.title
  } catch (err) {
    pageError.value = errorText(err, '修改标题失败')
  }
}

async function onDelete(item) {
  if (sending.value) return
  if (!window.confirm(`删除会话「${item.title}」？`)) return
  try {
    await deleteConversation(item.id)
    conversations.value = conversations.value.filter((row) => row.id !== item.id)
    if (current.value?.id === item.id) {
      current.value = null
      messages.value = []
    }
  } catch (err) {
    pageError.value = errorText(err, '删除会话失败')
  }
}

async function onModeChange(event) {
  const next = event.target.value
  const previous = outputMode.value
  if (!current.value || next === previous) return
  outputMode.value = next
  try {
    const updated = await updateConversation(current.value.id, { output_mode: next })
    outputMode.value = updated.output_mode
    current.value.output_mode = updated.output_mode
    const row = conversations.value.find((item) => item.id === current.value.id)
    if (row) row.output_mode = updated.output_mode
  } catch (err) {
    outputMode.value = previous
    pageError.value = errorText(err, '切换输出模式失败')
  }
}

function onPickFiles(event) {
  const picked = Array.from(event.target.files || [])
  event.target.value = ''
  for (const file of picked) {
    const mime = (file.type || '').toLowerCase()
    if (!IMAGE_TYPES.includes(mime)) {
      pageError.value = '只支持 png、jpeg、webp、gif'
      continue
    }
    const preview = URL.createObjectURL(file)
    blobUrls.push(preview)
    files.value.push({ file, name: file.name, preview })
  }
}

function removeFile(index) {
  const item = files.value[index]
  if (item?.preview) URL.revokeObjectURL(item.preview)
  files.value.splice(index, 1)
}

function addImageUrl() {
  const url = urlDraft.value.trim()
  if (!url) return
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    pageError.value = '图片 URL 需要是 http 或 https'
    return
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    pageError.value = '图片 URL 只支持 http 或 https'
    return
  }
  if (url.length > 512) {
    pageError.value = '图片 URL 最长 512 个字符'
    return
  }
  imageUrls.value.push(url)
  urlDraft.value = ''
  pageError.value = ''
}

function removeImageUrl(index) {
  imageUrls.value.splice(index, 1)
}

function readBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error || new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

async function collectImages() {
  const payload = []
  const previews = []
  for (const item of files.value) {
    payload.push({
      image_source: 'file',
      content_base64: await readBase64(item.file),
      mime_type: item.file.type,
    })
    previews.push({ image_url: item.preview, image_source: 'file' })
  }
  for (const url of imageUrls.value) {
    payload.push({ image_source: 'url', image_url: url })
    previews.push({ image_url: url, image_source: 'url' })
  }
  return { payload, previews }
}

function clearComposerImages() {
  files.value = []
  imageUrls.value = []
  urlDraft.value = ''
}

function assistantFromResult(result) {
  if (typeof result === 'string') return { role: 'assistant', content: result }
  return {
    role: 'assistant',
    id: result?.message_id || result?.id,
    content: result?.content || '',
    tokens_used: result?.tokens_used,
    latency_ms: result?.latency_ms,
    images: result?.images || [],
  }
}

async function onSend() {
  if (!current.value || sending.value) return
  const content = draft.value.trim()
  if (!content) {
    pageError.value = '请输入内容'
    return
  }
  pageError.value = ''
  const useImages = outputMode.value === 'multimodal'
  const images = useImages ? await collectImages() : { payload: [], previews: [] }
  const body = { content }
  if (images.payload.length) body.images = images.payload
  const conversationId = current.value.id
  draft.value = ''
  messages.value.push({
    role: 'user',
    content,
    images: images.previews,
  })
  scrollToBottom()
  sending.value = true
  try {
    if (outputMode.value === 'streaming') {
      const assistant = { role: 'assistant', content: '', streaming: true }
      messages.value.push(assistant)
      await streamMessage(conversationId, body, {
        onStart() {
          assistant.content = ''
        },
        onDelta(text) {
          assistant.content += text
          scrollToBottom()
        },
        onDone(data) {
          assistant.streaming = false
          assistant.id = data.message_id
          assistant.tokens_used = data.tokens_used
          assistant.latency_ms = data.latency_ms
        },
      })
      assistant.streaming = false
    } else {
      const result = await sendMessage(conversationId, body)
      messages.value.push(assistantFromResult(result))
    }
    if (useImages) clearComposerImages()
  } catch (err) {
    const last = messages.value[messages.value.length - 1]
    if (last && last.role === 'assistant' && last.streaming) {
      last.streaming = false
      last.error = errorText(err, '对话失败')
    } else {
      pageError.value = errorText(err, '发送失败')
    }
  } finally {
    sending.value = false
    scrollToBottom()
  }
}

function onComposerKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    onSend()
  }
}

onMounted(loadConversations)

onUnmounted(() => {
  blobUrls.forEach((url) => URL.revokeObjectURL(url))
})
</script>

<template>
  <section class="chat">
    <aside class="list">
      <header class="list-head">
        <div class="list-title">
          <h1>会话</h1>
          <span class="badge outline">{{ conversations.length }}</span>
        </div>
        <button
          type="button"
          class="primary icon new-conv"
          title="新建会话"
          aria-label="新建会话"
          @click="openCreate"
        >
          <AppIcon name="plus" :size="16" :stroke-width="2" />
        </button>
      </header>

      <div v-if="loading" class="loading">
        <span class="spinner"></span>
        加载中…
      </div>

      <div v-else-if="conversations.length === 0" class="empty compact">
        <span class="empty-icon">
          <AppIcon name="chat" :size="20" />
        </span>
        <strong>还没有会话</strong>
        <p>新建一个会话，选择模型后开始对话。</p>
        <button type="button" class="primary sm" @click="openCreate">
          <AppIcon name="plus" :size="13" />
          新建会话
        </button>
      </div>

      <ul v-else class="conv-list">
        <li
          v-for="item in conversations"
          :key="item.id"
          :class="{ active: current?.id === item.id }"
        >
          <form v-if="renamingId === item.id" class="rename" @submit.prevent="saveTitle(item)">
            <input v-model="titleDraft" maxlength="256" placeholder="会话标题" />
            <button type="submit" class="sm primary">保存</button>
          </form>

          <template v-else>
            <button
              type="button"
              class="conv"
              :disabled="sending"
              @click="openConversation(item.id)"
            >
              <span class="conv-title">{{ item.title }}</span>
              <span class="conv-meta">
                <span class="badge" :class="modeTone(item.output_mode)">
                  {{ modeLabel(item.output_mode) }}
                </span>
                <small v-if="item.updated_at">{{ item.updated_at }}</small>
              </span>
            </button>
            <div class="conv-ops">
              <button
                type="button"
                class="sm icon"
                title="重命名"
                aria-label="重命名"
                :disabled="sending"
                @click="startRename(item)"
              >
                <AppIcon name="edit" :size="14" />
              </button>
              <button
                type="button"
                class="sm icon danger"
                title="删除会话"
                aria-label="删除会话"
                :disabled="sending"
                @click="onDelete(item)"
              >
                <AppIcon name="trash" :size="14" />
              </button>
            </div>
          </template>
        </li>
      </ul>
    </aside>

    <main class="thread">
      <p v-if="pageError" class="alert error thread-alert">
        <AppIcon name="alert" :size="14" />
        <span>{{ pageError }}</span>
      </p>

      <template v-if="current">
        <header class="thread-head">
          <div class="thread-title">
            <h2>{{ current.title }}</h2>
            <span class="badge" :class="modeTone(outputMode)">{{ modeLabel(outputMode) }}</span>
          </div>
          <label class="mode-switch">
            <span>输出模式</span>
            <select :value="outputMode" :disabled="sending" @change="onModeChange">
              <option v-for="item in MODE_OPTIONS" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select>
          </label>
        </header>

        <p class="mode-hint">
          <AppIcon name="info" :size="13" />
          切换输出模式后从下一条消息生效，已有历史保持不变。
        </p>

        <div ref="messagePane" class="messages">
          <div v-if="messages.length === 0" class="empty">
            <span class="empty-icon">
              <AppIcon name="sparkles" :size="20" />
            </span>
            <strong>开始第一句话</strong>
            <p>当前是「{{ modeLabel(outputMode) }}」模式，输入内容后按 Enter 发送。</p>
          </div>

          <article
            v-for="(message, index) in messages"
            :key="`${message.id || 'new'}-${index}`"
            :class="['msg', message.role]"
          >
            <span class="msg-avatar">{{ message.role === 'assistant' ? 'AI' : '我' }}</span>
            <div class="msg-body">
              <div class="msg-head">
                <strong>{{ roleLabel(message.role) }}</strong>
                <small v-if="message.tokens_used != null">tokens {{ message.tokens_used }}</small>
                <small v-if="message.latency_ms != null">{{ message.latency_ms }} ms</small>
              </div>

              <div class="msg-bubble">
                <span v-if="message.streaming && !message.content" class="typing">
                  <i></i><i></i><i></i>
                </span>
                <p v-else class="text">{{ message.content }}</p>

                <div v-if="message.images?.length" class="thumbs">
                  <template v-for="image in message.images" :key="image.id || image.image_url">
                    <img v-if="showableImage(image)" :src="image.image_url" alt="" />
                    <span v-else class="badge outline">
                      图片 {{ image.mime_type || image.image_source }}
                    </span>
                  </template>
                </div>
              </div>

              <p v-if="message.error" class="alert error">
                <AppIcon name="alert" :size="14" />
                <span>{{ message.error }}</span>
              </p>
            </div>
          </article>
        </div>

        <form class="composer" @submit.prevent="onSend">
          <div class="composer-box">
            <textarea
              v-model="draft"
              rows="3"
              placeholder="输入消息，Enter 发送，Shift+Enter 换行"
              :disabled="sending"
              @keydown="onComposerKeydown"
            />

            <div v-if="outputMode === 'multimodal'" class="images">
              <div class="image-tools">
                <label class="file">
                  <AppIcon name="image" :size="14" />
                  上传图片
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    multiple
                    :disabled="sending"
                    @change="onPickFiles"
                  />
                </label>
                <div class="url-row">
                  <input
                    v-model="urlDraft"
                    type="url"
                    placeholder="https:// 图片地址"
                    :disabled="sending"
                    @keydown.enter.prevent="addImageUrl"
                  />
                  <button type="button" class="ghost sm" :disabled="sending" @click="addImageUrl">
                    添加 URL
                  </button>
                </div>
              </div>

              <ul v-if="files.length || imageUrls.length" class="picks">
                <li v-for="(item, index) in files" :key="item.preview">
                  <img :src="item.preview" alt="" />
                  <span>{{ item.name }}</span>
                  <button
                    type="button"
                    class="sm icon"
                    title="移除"
                    :disabled="sending"
                    @click="removeFile(index)"
                  >
                    <AppIcon name="close" :size="13" />
                  </button>
                </li>
                <li v-for="(url, index) in imageUrls" :key="`${url}-${index}`">
                  <img :src="url" alt="" />
                  <span>{{ url }}</span>
                  <button
                    type="button"
                    class="sm icon"
                    title="移除"
                    :disabled="sending"
                    @click="removeImageUrl(index)"
                  >
                    <AppIcon name="close" :size="13" />
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div class="composer-foot">
            <span class="foot-hint">
              <AppIcon name="info" :size="12" />
              Enter 发送 · Shift+Enter 换行
            </span>
            <button type="submit" class="primary" :disabled="sending">
              <span v-if="sending" class="spinner light"></span>
              <AppIcon v-else name="send" :size="14" />
              {{ sending ? '发送中…' : '发送' }}
            </button>
          </div>
        </form>
      </template>

      <div v-else class="empty thread-empty">
        <span class="empty-icon">
          <AppIcon name="chat" :size="22" />
        </span>
        <strong>选择一个会话，或新建一个</strong>
        <p>左侧列出了你的全部会话，选中后即可继续对话。</p>
        <button type="button" class="primary sm" @click="openCreate">
          <AppIcon name="plus" :size="13" />
          新建会话
        </button>
      </div>
    </main>

    <div v-if="formOpen" class="mask" @click.self="formOpen = false">
      <form class="dialog" @submit.prevent="onCreate">
        <header class="dialog-head">
          <h2>新建会话</h2>
          <p>选择模型、提示词与知识库，创建后可随时切换输出模式。</p>
        </header>

        <label class="field">
          <span>标题</span>
          <input v-model="form.title" maxlength="256" placeholder="不填则默认「新会话」" />
        </label>

        <label class="field">
          <span>模型</span>
          <select v-model="form.model_config_id" required>
            <option value="" disabled>请选择对话模型</option>
            <option v-for="item in chatModels" :key="item.id" :value="String(item.id)">
              {{ item.name }}
            </option>
          </select>
        </label>

        <div class="dialog-grid">
          <label class="field">
            <span>输出模式</span>
            <select v-model="form.output_mode">
              <option v-for="item in MODE_OPTIONS" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select>
          </label>

          <label class="field">
            <span>系统提示词</span>
            <select v-model="form.system_prompt_id">
              <option value="">不绑定</option>
              <option v-for="item in systemPrompts" :key="item.id" :value="String(item.id)">
                {{ item.name }}
              </option>
            </select>
          </label>
        </div>

        <label class="field">
          <span>用户模板</span>
          <select v-model="form.user_prompt_id">
            <option value="">不绑定</option>
            <option v-for="item in userPrompts" :key="item.id" :value="String(item.id)">
              {{ item.name }}
            </option>
          </select>
        </label>

        <fieldset>
          <legend>关联知识库</legend>
          <p v-if="knowledgeBases.length === 0" class="hint">没有可选知识库</p>
          <label v-for="item in knowledgeBases" :key="item.id" class="check">
            <input v-model="form.kbIds" type="checkbox" :value="item.id" />
            {{ item.name }}
            <small v-if="item.retrieval_top_k">top_k {{ item.retrieval_top_k }}</small>
          </label>
        </fieldset>

        <p v-if="formError" class="alert error">
          <AppIcon name="alert" :size="14" />
          <span>{{ formError }}</span>
        </p>

        <div class="actions">
          <button type="button" class="ghost" @click="formOpen = false">取消</button>
          <button type="submit" class="primary" :disabled="creating || chatModels.length === 0">
            {{ creating ? '创建中…' : '创建会话' }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.chat {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 24px;
  max-width: 1680px;
  margin-inline: auto;
  height: calc(100dvh - 100px);
  min-height: 540px;
}

.list,
.thread {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 18px 18px 16px 20px;
  border-bottom: 1px solid var(--border-soft);
}

.list-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.list-title h1 {
  font-size: 15px;
  letter-spacing: 0.01em;
}

button.new-conv {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
}

.conv-list {
  flex: 1;
  display: grid;
  gap: 6px;
  align-content: start;
  padding: 12px;
  overflow-y: auto;
}

.conv-list li {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: var(--radius-md);
  transition: background var(--transition);
}

.conv-list li:hover {
  background: var(--bg-hover);
}

.conv-list li.active {
  background: var(--color-primary-50);
  box-shadow: inset 0 0 0 1px var(--color-primary-100);
}

.conv {
  flex: 1;
  display: grid;
  gap: 4px;
  justify-items: start;
  min-width: 0;
  height: auto;
  padding: 12px 14px;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  box-shadow: none;
}

.conv:hover:not(:disabled) {
  background: transparent;
  border-color: transparent;
}

.conv-title {
  width: 100%;
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-list li.active .conv-title {
  font-weight: 600;
  color: var(--color-primary-700);
}

.conv-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.conv-meta small {
  overflow: hidden;
  font-size: 11px;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-ops {
  display: flex;
  gap: 1px;
  opacity: 0;
  transition: opacity var(--transition);
}

.conv-list li:hover .conv-ops,
.conv-list li:focus-within .conv-ops {
  opacity: 1;
}

.rename {
  display: flex;
  flex: 1;
  gap: 6px;
  padding: 4px;
}

.rename input {
  height: 32px;
  font-size: 13px;
}

.thread-alert {
  margin: 12px 16px 0;
}

.thread-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border-soft);
}

.thread-title {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.thread-title h2 {
  overflow: hidden;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mode-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.mode-switch select {
  width: 128px;
  height: 32px;
  font-size: 12.5px;
}

.mode-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border-soft);
}

.messages {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 22px;
  min-height: 0;
  padding: 24px 24px 28px;
  overflow-y: auto;
}

.msg {
  display: flex;
  gap: 10px;
  max-width: 100%;
}

.msg.user {
  flex-direction: row-reverse;
}

.msg-avatar {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 600;
  border-radius: 50%;
}

.msg.assistant .msg-avatar {
  color: #fff;
  background: linear-gradient(140deg, #3d86d6, #1d4f87);
  box-shadow: 0 3px 8px -3px rgba(35, 99, 168, 0.6);
}

.msg.user .msg-avatar {
  color: var(--text-secondary);
  background: var(--bg-muted);
  border: 1px solid var(--border);
}

.msg-body {
  display: grid;
  gap: 5px;
  min-width: 0;
  max-width: min(720px, 84%);
}

.msg.user .msg-body {
  justify-items: end;
}

.msg.user .msg-head {
  display: none;
}

.msg-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 2px;
}

.msg-head strong {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.msg-head small {
  font-size: 11px;
  color: var(--text-placeholder);
  font-variant-numeric: tabular-nums;
}

.msg-bubble {
  display: grid;
  gap: 8px;
  padding: 10px 13px;
  font-size: 13.5px;
  line-height: 1.72;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-card);
  box-shadow: var(--shadow-xs);
}

.msg.assistant .msg-bubble {
  border-top-left-radius: 4px;
}

.msg.user .msg-bubble {
  background: var(--color-primary-50);
  border-color: var(--color-primary-100);
  border-top-right-radius: 4px;
}

.text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.typing {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  color: var(--color-primary-400);
}

.typing i {
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
  animation: blink 1.1s infinite ease-in-out;
}

.typing i:nth-child(2) {
  animation-delay: 0.16s;
}

.typing i:nth-child(3) {
  animation-delay: 0.32s;
}

@keyframes blink {
  0%,
  70%,
  100% {
    opacity: 0.28;
    transform: translateY(0);
  }
  35% {
    opacity: 1;
    transform: translateY(-2px);
  }
}

.thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.thumbs img {
  width: 96px;
  height: 72px;
  object-fit: cover;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.composer {
  display: grid;
  gap: 8px;
  padding: 12px 16px 14px;
  border-top: 1px solid var(--border-soft);
  background: var(--bg-card);
}

.composer-box {
  display: grid;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  transition: border-color var(--transition), box-shadow var(--transition);
}

.composer-box:focus-within {
  border-color: var(--color-primary-400);
  box-shadow: var(--shadow-ring);
}

.composer textarea {
  min-height: 62px;
  padding: 6px 4px;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
  resize: none;
}

.composer textarea:focus {
  box-shadow: none;
}

.composer-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.foot-hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--text-placeholder);
}

.images {
  display: grid;
  gap: 8px;
  padding: 4px;
  border-top: 1px dashed var(--border);
}

.image-tools {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.file {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  overflow: hidden;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-primary-700);
  background: var(--color-primary-50);
  border: 1px solid var(--color-primary-100);
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
}

.file input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  opacity: 0;
  cursor: pointer;
}

.url-row {
  display: flex;
  flex: 1;
  gap: 6px;
  min-width: 220px;
}

.url-row input {
  height: 28px;
  font-size: 12px;
}

.picks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.picks li {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 4px 6px 4px 4px;
  font-size: 11.5px;
  color: var(--text-secondary);
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.picks img {
  width: 30px;
  height: 30px;
  object-fit: cover;
  border-radius: 4px;
}

.picks span {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dialog-head {
  display: grid;
  gap: 3px;
}

.dialog-head h2 {
  font-size: 16px;
}

.dialog-head p {
  font-size: 12.5px;
  color: var(--text-muted);
}

.dialog-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.empty.compact {
  flex: 1;
  align-content: center;
  padding: 24px 16px;
}

.thread-empty {
  flex: 1;
  align-content: center;
}

.spinner.light {
  border-color: rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
}

@media (max-width: 1180px) {
  .chat {
    grid-template-columns: 264px minmax(0, 1fr);
  }
}

@media (max-width: 960px) {
  .chat {
    height: calc(100dvh - 110px);
  }
}

@media (max-width: 860px) {
  .chat {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    height: calc(100dvh - 110px);
    min-height: 520px;
  }

  .list {
    max-height: 244px;
  }

  .thread {
    height: auto;
    min-height: 0;
  }

  .conv-ops {
    opacity: 1;
  }

  .msg-body {
    max-width: 88%;
  }
}

@media (max-width: 620px) {
  .dialog-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .thread-head {
    padding: 11px 14px;
  }

  .messages {
    padding: 14px 12px 16px;
  }

  .composer {
    padding: 10px 12px 12px;
  }

  .foot-hint {
    display: none;
  }
}
</style>
