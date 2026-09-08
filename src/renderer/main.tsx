import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import PrintDocumentView from './print-document-view'
import { RendererErrorBoundary } from './renderer-error-boundary'
import './styles.css'

// V19-E（D54）：`?print=1` = 隐藏打印窗（V19-D Main 创建）——只渲染打印视图，
// 不进 overview/路由/全局导航；主窗加载路径零变化。
const isPrintWindow = new URLSearchParams(window.location.search).get('print') === '1'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RendererErrorBoundary>
      {isPrintWindow ? <PrintDocumentView /> : <App />}
    </RendererErrorBoundary>
  </StrictMode>,
)
