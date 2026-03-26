// pages/webshell/webshell.js
// 读取集中化配置
const appConfig = require('../../appConfig.js')
const DEFAULT_H5_URL = appConfig.general.initialUrl

function safeDecode(s) {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

function parseQuery(qs) {
  const out = {}
  const raw = String(qs || '').replace(/^\?/, '')
  if (!raw) return out

  raw.split('&').forEach((part) => {
    if (!part) return
    const idx = part.indexOf('=')
    const k = idx >= 0 ? part.slice(0, idx) : part
    const v = idx >= 0 ? part.slice(idx + 1) : ''
    const key = safeDecode(k)
    if (!key) return
    out[key] = safeDecode(v)
  })
  return out
}

function buildUrlWithQuery(baseUrl, params) {
  const raw = String(baseUrl || '')
  if (!raw) return ''

  const hashSplit = raw.split('#')
  const beforeHash = hashSplit[0]
  const hash = hashSplit.length > 1 ? '#' + hashSplit.slice(1).join('#') : ''

  const qIndex = beforeHash.indexOf('?')
  const path = qIndex >= 0 ? beforeHash.slice(0, qIndex) : beforeHash
  const qs = qIndex >= 0 ? beforeHash.slice(qIndex + 1) : ''

  const merged = {
    ...parseQuery(qs),
    ...(params || {}),
  }

  const pairs = []
  Object.keys(merged).forEach((k) => {
    const v = merged[k]
    if (v === undefined || v === null || v === '') return
    pairs.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
  })

  const nextQs = pairs.length ? '?' + pairs.join('&') : ''
  return path + nextQs + hash
}

Page({
  data: {
    src: DEFAULT_H5_URL,
    h5Url: DEFAULT_H5_URL,
    lastPushedTs: 0,
  },

  onLoad(options) {
    const h5Url = options.url || DEFAULT_H5_URL
    this.setData({
      h5Url,
      src: h5Url,
    })

    // 从集中配置读取应用名称并设置导航栏标题
    if (appConfig.general.appName) {
      wx.setNavigationBarTitle({
        title: appConfig.general.appName
      })
    }
  },

  onShow() {
    console.log('[webshell] onShow triggered')
    const pendingLogin = wx.getStorageSync('mp_pending_login')
    const pendingProfile = wx.getStorageSync('mp_pending_profile')
    console.log('[webshell] pendingLogin:', pendingLogin)
    console.log('[webshell] pendingProfile:', pendingProfile)

    const loginObj = pendingLogin && typeof pendingLogin === 'object' ? pendingLogin : null
    const profileObj = pendingProfile && typeof pendingProfile === 'object' ? pendingProfile : null

    const loginTs = loginObj ? Number(loginObj.ts || 0) : 0
    // 优先使用 token（老用户直接登录），否则使用 code（新用户需要换取 token）
    const loginToken = loginObj ? String(loginObj.token || '') : ''
    const loginOpenid = loginObj ? String(loginObj.openid || '') : ''
    const loginExpiresIn = loginObj ? String(loginObj.expiresIn || '') : ''
    const loginCode = loginObj ? String(loginObj.code || '') : ''

    const profileTs = profileObj ? Number(profileObj.ts || 0) : 0
    const userInfo = profileObj && profileObj.userInfo ? profileObj.userInfo : null

    // 有 token 或 code 都算有登录信息
    const hasLogin = (Boolean(loginToken) || Boolean(loginCode)) && loginTs > this.data.lastPushedTs
    const hasProfile = Boolean(userInfo) && profileTs > this.data.lastPushedTs
    console.log('[webshell] hasLogin:', hasLogin, 'hasProfile:', hasProfile, 'hasToken:', Boolean(loginToken), 'hasCode:', Boolean(loginCode), 'lastPushedTs:', this.data.lastPushedTs)

    if (!hasLogin && !hasProfile) {
      console.log('[webshell] No pending data, skip update')
      return
    }

    // 通过 URL 参数回传数据给 H5
    const base = this.data.src || this.data.h5Url || DEFAULT_H5_URL
    const next = buildUrlWithQuery(base, {
      // 优先传递 token（老用户），否则传递 code（新用户）
      token: hasLogin && loginToken ? loginToken : undefined,
      openid: hasLogin && loginOpenid ? loginOpenid : undefined,
      expiresIn: hasLogin && loginExpiresIn ? loginExpiresIn : undefined,
      mpCode: hasLogin && !loginToken && loginCode ? loginCode : undefined,
      mpNickName: hasProfile && userInfo.nickName ? String(userInfo.nickName) : undefined,
      mpAvatarUrl: hasProfile && userInfo.avatarUrl ? String(userInfo.avatarUrl) : undefined,
      mpProfileTs: hasProfile ? profileTs : undefined,
    })
    console.log('[webshell] Updating webview URL:', next)

    if (hasLogin) wx.removeStorageSync('mp_pending_login')
    if (hasProfile) wx.removeStorageSync('mp_pending_profile')
    this.setData({ lastPushedTs: Math.max(this.data.lastPushedTs, loginTs, profileTs) })

    if (next && next !== this.data.src) {
      console.log('[webshell] Setting new src')
      this.setData({ src: next })
    }
  },

  onWebMessage(e) {
    console.log('[webshell] onWebMessage', e)
    const raw = e && e.detail && e.detail.data
    const last = Array.isArray(raw) ? raw[raw.length - 1] : raw
    const msg = last && typeof last === 'object' ? last : null
    if (!msg) return

    const payload = msg.data && typeof msg.data === 'object' ? msg.data : msg

    if (payload.type === 'REQUEST_WX_LOGIN') {
      console.log('[webshell] REQUEST_WX_LOGIN triggered')
      const returnUrl = payload.returnUrl || this.data.h5Url
      wx.navigateTo({
        url: '/pages/webshell/login?returnUrl=' + encodeURIComponent(returnUrl)
      })
    }
  },

  // 分享给好友
  onShareAppMessage() {
    const title = appConfig.general.appName || 'WebApp'
    return {
      title: title,
      path: '/pages/webshell/webshell',
      // imageUrl: '' // 可自定义分享图片，留空使用默认截图
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    const title = appConfig.general.appName || 'WebApp'
    return {
      title: title,
      // imageUrl: '' // 可自定义分享图片
    }
  },

  // 收藏功能
  onAddToFavorites() {
    const title = appConfig.general.appName || 'WebApp'
    return {
      title: title,
      // imageUrl: '' // 可自定义收藏图片
    }
  },

  // web-view 加载完成
  onWebViewLoad(e) {
    console.log('[webshell] web-view loaded:', e)
  },

  // web-view 加载错误处理
  onWebViewError(e) {
    console.error('[webshell] web-view error:', e)
    wx.showModal({
      title: '加载失败',
      content: '页面加载出错，请检查网络后重试',
      showCancel: true,
      confirmText: '重试',
      cancelText: '关闭',
      success: (res) => {
        if (res.confirm) {
          // 重新加载当前页面
          this.setData({ src: '' })
          setTimeout(() => {
            this.setData({ src: this.data.h5Url || DEFAULT_H5_URL })
          }, 100)
        }
      }
    })
  },
})
