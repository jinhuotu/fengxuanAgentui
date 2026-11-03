/** 系统信息、个人设置和全局配置。 */
import request from './request'

export function getInfo() {
  return request.get('/api/system/info')
}

export function listSettings() {
  return request.get('/api/system/settings')
}

export function updateSettings(data) {
  return request.put('/api/system/settings', data)
}

export function listConfigs() {
  return request.get('/api/system/config')
}

export function updateConfigs(data) {
  return request.put('/api/system/config', data)
}
