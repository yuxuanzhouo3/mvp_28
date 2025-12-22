// 登录用户与游客使用同一套配额/扣费逻辑
export { POST } from "../stream-guest/route";

// Next.js 路由配置必须直接定义，不能重新导出（否则 Vercel 构建警告）
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
