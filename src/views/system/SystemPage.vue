<script setup>
import { computed, onMounted, ref } from 'vue'
import { getInfo, listConfigs, listSettings, updateSettings } from '@/api/system'
import { listModels } from '@/api/models'
import AppIcon from '@/components/AppIcon.vue'

const OUTPUT_MODES = [
  { value: 'streaming', label: '流式' },
  { value: 'non_streaming', label: '非流式' },
  { value: 'multimodal', label: '多模态' },
]
const KNOWN_KEYS = ['default_model_id', 'default_output_mode', 'history_recent_turns']

const info = ref(null)
const infoError = ref('')
const configs = ref([])
const configError = ref('')
const chatModels = ref([])
const extraSettings = ref([])
const settingsError = ref('')
const saving = ref(false)
const loading = ref(false)
const settings = ref(emptySettings())

function emptySettings() {
  return {
    default_model_id: '',
    default_output_mode: '',
    history_recent_turns: '',
  }
}

const dependencies = computed(() => [
  { name: 'MySQL', item: info.value?.mysql },
  { name: 'Redis', item: info.value?.redis },
  { name: 'Qdrant', item: info.value?.qdrant },
])

function errorText(err, fallback) {
  const message = err instanceof Error ? err.message : fallback
  if (err && err.code === 40300) return `403 ${message}`
  if (err && err.code === 40400) return `404 ${message}`
  return message || fallback
}

function formatUptime(seconds) {
  const total = Math.max(0, Number(seconds) || 0)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remain = total % 60
  const parts = []
  if (days) parts.push(`${days} 天`)
  if (hours) parts.push(`${hours} 小时`)
  if (minutes) parts.push(`${minutes} 分`)
  parts.push(`${remain} 秒`)
  return parts.join(' ')
}

function dependencyText(item) {
  if (!item) return '未知'
  return item.ok ? `连通（${item.detail}）` : `未连通（${item.detail || '连通失败'}）`
}

function dependencyTone(item) {
  if (!item) return 'outline'
  return item.ok ? 'success' : 'danger'
}

function configValue(row) {
  if (row.is_encrypted) return row.config_value ? '已设置（密文）' : '未设置'
  return row.config_value ?? ''
}

function applySettings(rows) {
  const map = Object.fromEntries(rows.map((row) => [row.settings_key, row.settings_value]))
  settings.value = {
    default_model_id: map.default_model_id ?? '',
    default_output_mode: map.default_output_mode ?? '',
    history_recent_turns: map.history_recent_turns ?? '',
  }
  extraSettings.value = rows.filter((row) => !KNOWN_KEYS.includes(row.settings_key))
}

async function load() {
  loading.value = true
  infoError.value = ''
  settingsError.value = ''
  configError.value = ''
  const [infoResult, settingsResult, configResult] = await Promise.allSettled([
    getInfo(),
    Promise.all([listSettings(), listModels('chat').catch(() => [])]),
    listConfigs(),
  ])
  if (infoResult.status === 'fulfilled') info.value = infoResult.value
  else infoError.value = errorText(infoResult.reason, '加载系统信息失败')
  if (settingsResult.status === 'fulfilled') {
    applySettings(settingsResult.value[0])
    chatModels.value = settingsResult.value[1]
  } else {
    settingsError.value = errorText(settingsResult.reason, '加载设置失败')
  }
  if (configResult.status === 'fulfilled') configs.value = configResult.value
  else configError.value = errorText(configResult.reason, '加载全局配置失败')
  loading.value = false
}

function settingsPayload() {
  const history = settings.value.history_recent_turns
  return {
    items: [
      {
        settings_key: 'default_model_id',
        settings_value: settings.value.default_model_id
          ? String(settings.value.default_model_id)
          : null,
      },
      {
        settings_key: 'default_output_mode',
        settings_value: settings.value.default_output_mode || null,
      },
      {
        settings_key: 'history_recent_turns',
        settings_value: history === '' || history === null ? null : String(Number(history)),
      },
    ],
  }
}

function validateSettings() {
  const modelId = settings.value.default_model_id
  if (modelId && !/^[1-9]\d*$/.test(String(modelId))) return '默认模型必须是正整数'
  const mode = settings.value.default_output_mode
  if (mode && !OUTPUT_MODES.some((item) => item.value === mode)) {
    return '默认输出模式只能是 streaming、non_streaming 或 multimodal'
  }
  const history = settings.value.history_recent_turns
  if (history === '' || history === null) return ''
  const turns = Number(history)
  if (!Number.isInteger(turns) || turns < 0 || turns > 50) {
    return '历史兜底轮数需要是 0 到 50 的整数'
  }
  return ''
}

async function onSaveSettings() {
  const message = validateSettings()
  if (message) {
    settingsError.value = message
    return
  }
  saving.value = true
  settingsError.value = ''
  try {
    applySettings(await updateSettings(settingsPayload()))
  } catch (err) {
    settingsError.value = errorText(err, '保存设置失败')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="page">
    <header class="page-head">
      <div class="page-head-text">
        <h1>系统</h1>
        <p class="page-desc">查看服务运行状态与依赖连通性，维护个人默认设置与只读的全局配置。</p>
      </div>
      <div class="page-head-actions">
        <button type="button" class="ghost" :disabled="loading" @click="load">
          <AppIcon name="refresh" :size="15" />
          刷新
        </button>
      </div>
    </header>

    <section class="card">
      <header class="card-head">
        <h2>服务信息</h2>
        <p v-if="info">运行时长 {{ formatUptime(info.uptime_seconds) }}</p>
      </header>

      <p v-if="infoError" class="alert error">
        <AppIcon name="alert" :size="14" />
        <span>{{ infoError }}</span>
      </p>

      <p v-else-if="!info" class="loading">
        <span class="spinner"></span>
        加载中…
      </p>

      <template v-else>
        <dl class="kv-list versions">
          <div>
            <dt>服务版本</dt>
            <dd>{{ info.app_version }}</dd>
          </div>
          <div>
            <dt>Python</dt>
            <dd>{{ info.python_version }}</dd>
          </div>
          <div>
            <dt>FastAPI</dt>
            <dd>{{ info.fastapi_version }}</dd>
          </div>
          <div>
            <dt>运行时长</dt>
            <dd>{{ formatUptime(info.uptime_seconds) }}</dd>
          </div>
        </dl>

        <div class="deps">
          <div v-for="dep in dependencies" :key="dep.name" class="dep">
            <span class="dep-name">{{ dep.name }}</span>
            <span class="badge" :class="dependencyTone(dep.item)">
              <span class="dot"></span>
              {{ dependencyText(dep.item) }}
            </span>
          </div>
        </div>
      </template>
    </section>

    <section class="card">
      <header class="card-head">
        <h2>我的设置</h2>
        <p>只影响当前账号的默认行为</p>
      </header>

      <form class="settings-form" @submit.prevent="onSaveSettings">
        <div class="form-grid">
          <label class="field">
            <span>默认模型</span>
            <select v-model="settings.default_model_id">
              <option value="">未设置</option>
              <option
                v-if="
                  settings.default_model_id &&
                  !chatModels.some((item) => String(item.id) === String(settings.default_model_id))
                "
                :value="String(settings.default_model_id)"
              >
                #{{ settings.default_model_id }}
              </option>
              <option v-for="item in chatModels" :key="item.id" :value="String(item.id)">
                {{ item.name }}
              </option>
            </select>
          </label>

          <label class="field">
            <span>默认输出模式</span>
            <select v-model="settings.default_output_mode">
              <option value="">未设置</option>
              <option v-for="item in OUTPUT_MODES" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select>
          </label>

          <label class="field">
            <span>历史兜底轮数</span>
            <input
              v-model="settings.history_recent_turns"
              type="number"
              min="0"
              max="50"
              step="1"
              placeholder="0 到 50"
            />
          </label>
        </div>

        <p v-if="extraSettings.length" class="hint">
          其他设置：
          <span v-for="item in extraSettings" :key="item.settings_key" class="extra-item">
            {{ item.settings_key }}={{ item.settings_value ?? '空' }}
          </span>
        </p>

        <p v-if="settingsError" class="alert error">
          <AppIcon name="alert" :size="14" />
          <span>{{ settingsError }}</span>
        </p>

        <div class="actions">
          <button type="submit" class="primary" :disabled="saving">
            <span v-if="saving" class="spinner light"></span>
            {{ saving ? '保存中…' : '保存设置' }}
          </button>
        </div>
      </form>
    </section>

    <section class="card">
      <header class="card-head">
        <h2>全局配置</h2>
        <span class="badge outline">
          <AppIcon name="lock" :size="11" />
          只读
        </span>
      </header>

      <p class="hint">
        全局配置仅管理员可修改。非管理员保存时后端返回 403，当前页面只做只读展示。
      </p>

      <p v-if="configError" class="alert error">
        <AppIcon name="alert" :size="14" />
        <span>{{ configError }}</span>
      </p>

      <div v-else-if="configs.length === 0" class="empty compact">
        <span class="empty-icon">
          <AppIcon name="sliders" :size="18" />
        </span>
        <strong>没有全局配置</strong>
      </div>

      <div v-else class="table-wrap inner">
        <table>
          <thead>
            <tr>
              <th>键</th>
              <th>值</th>
              <th>说明</th>
              <th>密文</th>
              <th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in configs" :key="row.config_key">
              <td><code class="mono">{{ row.config_key }}</code></td>
              <td>{{ configValue(row) }}</td>
              <td>{{ row.description || '—' }}</td>
              <td>
                <span class="badge" :class="row.is_encrypted ? 'warning' : 'outline'">
                  {{ row.is_encrypted ? '是' : '否' }}
                </span>
              </td>
              <td><span class="mono">{{ row.updated_at || '—' }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
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

.settings-form {
  display: grid;
  gap: 14px;
  max-width: 720px;
}

.settings-form .actions {
  justify-content: flex-start;
}

.extra-item {
  display: inline-block;
  margin-right: 8px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--text-secondary);
}

.spinner.light {
  border-color: rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
}

.kv-list.versions {
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.deps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--border-soft);
}

.dep {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 12px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
}

.dep-name {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-secondary);
}
</style>
