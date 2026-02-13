/**
 * 统一的认证辅助函数
 * 支持 Supabase 认证和 Android Native Google Sign-In 的自定义 JWT 认证
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface AuthResult {
  userId: string;
  userMeta?: any;
  supabase: any;
}

/**
 * 从请求中获取用户认证信息
 * 支持两种认证方式：
 * 1. 自定义 JWT 认证（Android Native Google Sign-In）
 * 2. Supabase 认证
 */
export async function getUserFromRequest(req: NextRequest): Promise<AuthResult | null> {
  // 尝试从 Authorization header 获取自定义 JWT token（Android Native Google Sign-In）
  const authHeader = req.headers.get("authorization");
  const customToken = authHeader?.replace(/^Bearer\s+/i, "");

  if (customToken) {
    // 使用自定义 JWT 认证（Android Native Google Sign-In）
    try {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
      const decoded = jwt.verify(customToken, JWT_SECRET) as any;
      const userId = decoded.sub;
      console.log('[auth-helper] Using custom JWT auth for user:', userId);

      // 创建 supabase 客户端用于数据库查询
      const supabase = await createClient();

      return {
        userId,
        userMeta: {},
        supabase,
      };
    } catch (error) {
      console.error('[auth-helper] Custom JWT verification failed:', error);
      return null;
    }
  } else {
    // 使用 Supabase 认证
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return null;
    }

    return {
      userId: userData.user.id,
      userMeta: userData.user.user_metadata as any,
      supabase,
    };
  }
}
