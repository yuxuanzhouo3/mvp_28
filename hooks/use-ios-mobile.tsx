import * as React from "react"

export function useIsIOSMobile() {
  const [isIOSMobile, setIsIOSMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    const checkIOSMobile = () => {
      const userAgent = window.navigator.userAgent.toLowerCase()
      const isIOS = /iphone|ipad|ipod/.test(userAgent)
      return isIOS
    }

    setIsIOSMobile(checkIOSMobile())
  }, [])

  return isIOSMobile
}
