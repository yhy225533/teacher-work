/**
 * V1.11（D66）测试基建：pdfjs-dist 的 ESM 构建在模块级引用浏览器 DOMMatrix 类（node 无此全局）。
 * 渲染器源码钉测（renderToStaticMarkup）静态 import LessonMaterialReader → pdf-preview →
 * react-pdf 的链路，需在测试环境补一个模块级占位；纯占位不参与任何断言，对其余测试零影响。
 */
if (typeof globalThis.DOMMatrix === 'undefined') {
  ;(globalThis as { DOMMatrix: unknown }).DOMMatrix = class DOMMatrix {}
}
