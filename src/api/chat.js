/** 会话和消息。流式回答由 streamMessage 按 SSE 事件块读取。 */
import router from '@/router'
import request from './request'

const baseURL = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export function listConversations() {
  return request.get('/api/chat/conversations')
}

export function getConversation(conversationId) {
  return request.get(`/api/chat/conversations/${conversationId}`)
}

export function createConversation(data) {
  return request.post('/api/chat/conversations', data)
}

export function updateConversation(conversationId, data) {
  return request.put(`/api/chat/conversations/${conversationId}`, data)
}

export function deleteConversation(conversationId) {
  return request.delete(`/api/chat/conversations/${conversationId}`)
}

let refreshing = null

function apiUrl(path) {
  return `${baseURL}${path}`
}

function clearLogin() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  if (router.currentRoute.value.path !== '/login') {
    router.push('/login')
  }
}

/** 流式请求不走 axios，401 时单独刷新一次 access token。 */
function refreshAccessToken() {
  if (refreshing) return refreshing
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) {
    clearLogin()
    return Promise.reject(new Error('登录已过期'))
  }
  refreshing = (async () => {
    const response = await fetch(apiUrl('/api/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload.code !== 0) {
      clearLogin()
      throw new Error(payload.message || '登录已过期')
    }
    localStorage.setItem('access_token', payload.data.access_token)
    if (payload.data.refresh_token) {
      localStorage.setItem('refresh_token', payload.data.refresh_token)
    }
    return payload.data.access_token
  })().finally(() => {
    refreshing = null
  })
  return refreshing
}

async function postMessage(conversationId, body, retried = false) {
  const headers = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('access_token')
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(apiUrl(`/api/chat/conversations/${conversationId}/messages`), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (response.status === 401 && !retried) {
    await refreshAccessToken()
    return postMessage(conversationId, body, true)
  }
  if (!response.ok) {
    let message = '发送失败'
    const text = await response.text()
    try {
      const payload = JSON.parse(text)
      if (payload.message) message = payload.message
    } catch {
      if (text) message = text.slice(0, 200)
    }
    throw new Error(message)
  }
  return response
}

/**
 * 处理一块 SSE。
 * event:start 清空；event:delta 的 data.text 追加；
 * event:done 带回 message_id、tokens_used、latency_ms；event:error 抛出 message。
 */
function readSseBlock(block, handlers) {
  let eventName = ''
  const dataLines = []
  for (const rawLine of block.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith(':')) continue
    if (line.startsWith('event:')) eventName = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  if (!eventName) return
  let data = {}
  if (dataLines.length) {
    try {
      data = JSON.parse(dataLines.join('\n'))
    } catch {
      throw new Error('无法解析流式数据')
    }
  }
  if (eventName === 'start') {
    handlers.onStart?.()
    return
  }
  if (eventName === 'delta') {
    handlers.onDelta?.(typeof data.text === 'string' ? data.text : '')
    return
  }
  if (eventName === 'done') {
    handlers.onDone?.(data)
    return
  }
  if (eventName === 'error') {
    throw new Error(data.message || '对话失败')
  }
}

function consumeSseText(text, handlers) {
  const normalized = text.replace(/\r\n/g, '\n')
  for (const block of normalized.split('\n\n')) {
    if (block.trim()) readSseBlock(block, handlers)
  }
}

/**
 * 流式发送。fetch POST 后用 ReadableStream + TextDecoder，按空行切事件。
 * handlers: { onStart, onDelta(text), onDone(data) }
 */
export async function streamMessage(conversationId, body, handlers) {
  const response = await postMessage(conversationId, body)
  if (!response.body) throw new Error('浏览器没有返回可读流')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        buffer += decoder.decode()
        break
      }
      buffer += decoder.decode(value, { stream: true })
      const blocks = buffer.split('\n\n')
      buffer = blocks.pop() ?? ''
      for (const block of blocks) {
        if (block.trim()) readSseBlock(block, handlers)
      }
    }
    if (buffer.trim()) readSseBlock(buffer, handlers)
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  }
}

/**
 * 非流式发送。响应是 JSON 时直接返回 data；
 * 若仍是一条 SSE（start / 一段 delta / done），收齐后一次返回。
 */
export async function sendMessage(conversationId, body) {
  const response = await postMessage(conversationId, body)
  const type = response.headers.get('content-type') || ''
  if (type.includes('application/json')) {
    const payload = await response.json()
    if (payload && typeof payload === 'object' && 'code' in payload) {
      if (payload.code !== 0) throw new Error(payload.message || '发送失败')
      return payload.data
    }
    return payload
  }
  const text = await response.text()
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    const payload = JSON.parse(trimmed)
    if (payload && typeof payload === 'object' && 'code' in payload) {
      if (payload.code !== 0) throw new Error(payload.message || '发送失败')
      return payload.data
    }
    return payload
  }
  let content = ''
  let doneData = {}
  consumeSseText(trimmed, {
    onDelta(piece) {
      content += piece
    },
    onDone(data) {
      doneData = data || {}
    },
  })
  return {
    content,
    message_id: doneData.message_id,
    tokens_used: doneData.tokens_used,
    latency_ms: doneData.latency_ms,
  }
}
