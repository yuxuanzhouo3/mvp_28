import * as React from "react"

export function useIsIOSMobile() {
  const [isIOSMobile, setIsIOSMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    const checkIOSMobile = () => {
      const userAgent = window.navigator.userAgent.toLowerCase()
      const isIOS = /iphone|ipod/.test(userAgent)
      const isIPad = /ipad/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

      // 只有iPhone和iPod被视为移动端iOS设备，iPad不算
      return isIOS && !isIPad
    }

    setIsIOSMobile(checkIOSMobile())
  }, [])

  return isIOSMobile
}
