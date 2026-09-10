/**
 * V1.11（D68）：binary dataUrl → ArrayBuffer/Uint8Array 工具（无 DOM 依赖，测试可静态导入）。
 * V1.12.1（D73）：预分配 for 循环——实测（tmp/v112-bench，42MB 档 production 渲染进程）
 * `Uint8Array.from(s, c => c.charCodeAt(0))` 回调循环 3809ms（GC 风暴，174MB 档挂死），
 * 本实现 149ms（快 25 倍）；atob 主体仅 ~115ms 不是瓶颈。禁止回退 Uint8Array.from（钉测）。
 */
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}
