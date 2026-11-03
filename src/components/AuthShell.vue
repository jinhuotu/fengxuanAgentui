<script setup>
/** 登录 / 注册共用的左右分栏外壳：左侧品牌介绍，右侧表单卡片。 */
import AppIcon from '@/components/AppIcon.vue'

const points = [
  '对话 / 向量 / 重排模型统一接入',
  '知识库检索增强，回答附来源片段',
  'MCP 工具接入，读写权限可控',
]
</script>

<template>
  <div class="auth">
    <section class="auth-brand">
      <span class="glow glow-a"></span>
      <span class="glow glow-b"></span>
      <span class="grid-lines"></span>

      <div class="brand-head">
        <span class="brand-mark">
          <AppIcon name="sparkles" :size="18" :stroke-width="1.9" />
        </span>
        <span class="brand-text">
          <strong>锋煊</strong>
          <small>Fengxuan Agent</small>
        </span>
      </div>

      <div class="brand-copy">
        <h1>把模型、知识与工具<br />收进同一个对话</h1>
        <p>一个内部控制台，管理模型接入、提示词模板、知识库与 MCP 工具，让回答真正落到业务上。</p>
        <ul class="brand-points">
          <li v-for="item in points" :key="item">
            <span class="tick"><AppIcon name="check" :size="12" :stroke-width="2.4" /></span>
            {{ item }}
          </li>
        </ul>
      </div>

      <p class="brand-foot">Fengxuan Agent · 内部控制台</p>
    </section>

    <section class="auth-panel">
      <div class="auth-mobile-brand">
        <span class="brand-mark">
          <AppIcon name="sparkles" :size="16" :stroke-width="1.9" />
        </span>
        <strong>锋煊</strong>
        <small>Fengxuan Agent</small>
      </div>
      <div class="auth-card">
        <slot />
      </div>
    </section>
  </div>
</template>

<style scoped>
.auth {
  display: grid;
  grid-template-columns: minmax(420px, 46%) minmax(0, 1fr);
  min-height: 100vh;
  background: var(--bg-page);
}

.auth-brand {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 40px;
  padding: 42px 46px;
  overflow: hidden;
  color: #fff;
  background: linear-gradient(150deg, #0b1828 0%, #102c4a 52%, #1a4878 100%);
}

.glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(10px);
  pointer-events: none;
}

.glow-a {
  top: -14%;
  left: -10%;
  width: 460px;
  height: 460px;
  background: radial-gradient(circle, rgba(80, 155, 235, 0.34), transparent 66%);
}

.glow-b {
  right: -18%;
  bottom: -22%;
  width: 520px;
  height: 520px;
  background: radial-gradient(circle, rgba(35, 99, 168, 0.44), transparent 64%);
}

.grid-lines {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
  background-size: 54px 54px;
  mask-image: radial-gradient(circle at 30% 30%, #000 0%, transparent 78%);
  pointer-events: none;
}

.brand-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  color: #fff;
  background: linear-gradient(140deg, #55a0ef 0%, #2363a8 72%);
  border-radius: 11px;
  box-shadow: 0 8px 20px -8px rgba(75, 148, 230, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.32);
}

.brand-text {
  display: grid;
  gap: 1px;
}

.brand-text strong {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.16em;
  color: #fff;
}

.brand-text small {
  font-size: 10.5px;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.45);
  text-transform: uppercase;
}

.brand-copy {
  position: relative;
  display: grid;
  gap: 16px;
  max-width: 30em;
}

.brand-copy h1 {
  font-size: 30px;
  font-weight: 600;
  line-height: 1.42;
  letter-spacing: -0.02em;
  color: #fff;
}

.brand-copy p {
  font-size: 13.5px;
  line-height: 1.75;
  color: rgba(255, 255, 255, 0.62);
}

.brand-points {
  display: grid;
  gap: 11px;
  margin-top: 4px;
}

.brand-points li {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.78);
}

.tick {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  color: #8ec7ff;
  background: rgba(120, 178, 240, 0.14);
  border: 1px solid rgba(120, 178, 240, 0.26);
  border-radius: 50%;
}

.brand-foot {
  position: relative;
  font-size: 11.5px;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.34);
}

.auth-panel {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 18px;
  padding: 40px 24px;
}

.auth-mobile-brand {
  display: none;
  align-items: center;
  gap: 9px;
}

.auth-mobile-brand strong {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.14em;
}

.auth-mobile-brand small {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.auth-card {
  width: min(400px, 100%);
  display: grid;
  gap: 20px;
  padding: 30px 30px 26px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: var(--shadow-lg);
}

@media (max-width: 980px) {
  .auth {
    grid-template-columns: minmax(340px, 42%) minmax(0, 1fr);
  }

  .auth-brand {
    padding: 32px 30px;
  }

  .brand-copy h1 {
    font-size: 25px;
  }
}

@media (max-width: 820px) {
  .auth {
    grid-template-columns: minmax(0, 1fr);
  }

  .auth-brand {
    display: none;
  }

  .auth-panel {
    padding: 34px 16px;
    align-content: start;
  }

  .auth-mobile-brand {
    display: flex;
    margin-bottom: 2px;
  }

  .auth-card {
    padding: 24px 20px 22px;
    border-radius: 16px;
    box-shadow: var(--shadow-md);
  }
}
</style>
