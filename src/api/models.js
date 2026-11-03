/** 模型配置：列表、详情、保存、连通测试和共享。 */
import request from './request'

export function listModels(modelType) {
  return request.get('/api/models', {
    params: modelType ? { model_type: modelType } : {},
  })
}

export function getModel(modelId) {
  return request.get(`/api/models/${modelId}`)
}

export function createModel(data) {
  return request.post('/api/models', data)
}

export function updateModel(modelId, data) {
  return request.put(`/api/models/${modelId}`, data)
}

export function deleteModel(modelId) {
  return request.delete(`/api/models/${modelId}`)
}

export function testModel(modelId) {
  return request.post(`/api/models/${modelId}/test`)
}

export function listShares(modelId) {
  return request.get(`/api/models/${modelId}/shares`)
}

export function addShare(modelId, data) {
  return request.post(`/api/models/${modelId}/shares`, data)
}

export function removeShare(modelId, shareId) {
  return request.delete(`/api/models/${modelId}/shares/${shareId}`)
}
