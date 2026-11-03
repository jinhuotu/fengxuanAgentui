/** 提示词：系统提示词和用户提示词模板。 */
import request from './request'

export function listSystemPrompts() {
  return request.get('/api/prompts/system')
}

export function getSystemPrompt(promptId) {
  return request.get(`/api/prompts/system/${promptId}`)
}

export function createSystemPrompt(data) {
  return request.post('/api/prompts/system', data)
}

export function updateSystemPrompt(promptId, data) {
  return request.put(`/api/prompts/system/${promptId}`, data)
}

export function deleteSystemPrompt(promptId) {
  return request.delete(`/api/prompts/system/${promptId}`)
}

export function listUserPrompts() {
  return request.get('/api/prompts/user')
}

export function getUserPrompt(promptId) {
  return request.get(`/api/prompts/user/${promptId}`)
}

export function createUserPrompt(data) {
  return request.post('/api/prompts/user', data)
}

export function updateUserPrompt(promptId, data) {
  return request.put(`/api/prompts/user/${promptId}`, data)
}

export function deleteUserPrompt(promptId) {
  return request.delete(`/api/prompts/user/${promptId}`)
}
