# mvp28-fix 功能概览

## 部署
- 国际版（EN）：Vercel 线上访问 `https://mvp28-max-2326815976s-projects.vercel.app`
- 国内版（ZH）：本地/自有环境，后端接入 CloudBase 文档数据库（users、sessions、messages、conversations）。

## 登录与账户
- 国际版：Google OAuth（Supabase）登录全链路。
- 国内版：邮箱注册/登录 + 微信扫码登录（二维码生成、回调、用户写入 CloudBase），但是目前未配置具体的环境变量。

## 聊天与会话
- 历史会话：登录后自动拉取用户历史对话；刷新或重登保持一致。
- 消息存储：对话与消息落库 CloudBase；删除对话、停止对话均保持数据一致。
- 流式聊天：支持中途停止，已生成内容会被保存；中止不会抛错到界面。

## 地域与访问控制
- IP 检测：使用 `IP_API_URL=https://ipapi.co/json/` 获取地域，屏蔽欧洲 IP 。