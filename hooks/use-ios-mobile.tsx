import * as React from "react"

export function useIsIOSMobile() {
  const [isIOSMobile, setIsIOSMobile] = React.useState<boolean>(() => {
    // 在客户端立即检测，避免初始渲染闪烁
    if (typeof window === 'undefined') return false

    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIOS = /iphone|ipod/.test(userAgent)
    const isIPad = /ipad/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

    // 只有iPhone和iPod被视为移动端iOS设备，iPad不算
    return isIOS && !isIPad
  })

  return isIOSMobile
}
