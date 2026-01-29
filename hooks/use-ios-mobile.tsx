import * as React from "react"

export function useIsIOSMobile() {
  const [isIOSMobile, setIsIOSMobile] = React.useState<boolean>(() => {
    // 在客户端立即检测，避免初始渲染闪烁
    if (typeof window === 'undefined') return false

    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIOS = /iphone|ipod/.test(userAgent)
    const isIPad = /ipad/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

    // 只有iPhone和iPod被视为移动端iOS设备，iPad不算
    const result = isIOS && !isIPad

    // 调试信息：在开发环境下输出检测结果
    if (process.env.NODE_ENV === 'development') {
      console.log('[useIsIOSMobile] 设备检测:', {
        userAgent,
        isIOS,
        isIPad,
        result
      })
    }

    return result
  })

  return isIOSMobile
}
