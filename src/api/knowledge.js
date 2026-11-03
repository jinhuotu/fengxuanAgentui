/** 知识库：库、授权、文档和检索。 */
import request from './request'

export function listKnowledgeBases() {
  return request.get('/api/knowledge/kb')
}

export function getKnowledgeBase(kbId) {
  return request.get(`/api/knowledge/kb/${kbId}`)
}

export function createKnowledgeBase(data) {
  return request.post('/api/knowledge/kb', data)
}

export function updateKnowledgeBase(kbId, data) {
  return request.put(`/api/knowledge/kb/${kbId}`, data)
}

export function deleteKnowledgeBase(kbId) {
  return request.delete(`/api/knowledge/kb/${kbId}`)
}

export function listPermissions(kbId) {
  return request.get(`/api/knowledge/kb/${kbId}/permissions`)
}

export function grantPermission(kbId, data) {
  return request.post(`/api/knowledge/kb/${kbId}/permissions`, data)
}

export function revokePermission(kbId, permissionId) {
  return request.delete(`/api/knowledge/kb/${kbId}/permissions/${permissionId}`)
}

export function listDocuments(kbId) {
  return request.get(`/api/knowledge/kb/${kbId}/documents`)
}

export function getDocument(kbId, documentId) {
  return request.get(`/api/knowledge/kb/${kbId}/documents/${documentId}`)
}

export function uploadDocument(kbId, file) {
  const form = new FormData()
  form.append('file', file)
  return request.post(`/api/knowledge/kb/${kbId}/documents`, form)
}

export function deleteDocument(kbId, documentId) {
  return request.delete(`/api/knowledge/kb/${kbId}/documents/${documentId}`)
}

export function retrieve(kbId, data) {
  return request.post(`/api/knowledge/kb/${kbId}/retrieve`, data)
}
