/** Agent：MCP 服务和会话上的 Agent 绑定。 */
import request from './request'

export function listMcpServers() {
  return request.get('/api/agent/mcp-servers')
}

export function getMcpServer(serverId) {
  return request.get(`/api/agent/mcp-servers/${serverId}`)
}

export function createMcpServer(data) {
  return request.post('/api/agent/mcp-servers', data)
}

export function updateMcpServer(serverId, data) {
  return request.put(`/api/agent/mcp-servers/${serverId}`, data)
}

export function deleteMcpServer(serverId) {
  return request.delete(`/api/agent/mcp-servers/${serverId}`)
}

export function getConversationAgent(conversationId) {
  return request.get(`/api/agent/conversations/${conversationId}`)
}

export function saveConversationAgent(conversationId, data) {
  return request.post(`/api/agent/conversations/${conversationId}`, data)
}

export function disableConversationAgent(conversationId) {
  return request.delete(`/api/agent/conversations/${conversationId}`)
}
