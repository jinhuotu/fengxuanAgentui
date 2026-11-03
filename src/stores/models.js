/** 模型模块跨页共享状态。单页内部状态用页面本地 ref。 */
import { defineStore } from 'pinia'

export const useModelsStore = defineStore('models', {
  state: () => ({}),
})
