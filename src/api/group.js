/** 我的群组，供模型共享时选择。 */
import request from './request'

export function listGroups() {
  return request.get('/api/group')
}
