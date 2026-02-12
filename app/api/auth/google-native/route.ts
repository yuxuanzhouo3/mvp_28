import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { OAuth2Client } from 'google-auth-library';

/**
 * Google Native Sign-In API
 * 处理来自 Android 原生 Google Sign-In SDK 的认证请求
 */
export async function POST(request: NextRequest) {
  try {
    const { idToken, email, displayName } = await request.json();

    if (!idToken) {
      return NextResponse.json(
        { error: 'Missing idToken' },
        { status: 400 }
      );
    }

    // 验证 Google ID Token
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: 'Google Client ID not configured' },
        { status: 500 }
      );
    }

    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase Admin client not configured' },
        { status: 500 }
      );
    }

    // 检查用户是否已存在
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', payload.email)
      .maybeSingle();

    let user;

    if (existingProfile) {
      // 用户已存在,更新最后登录时间
      const { data: updatedUser } = await supabaseAdmin
        .from('profiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', existingProfile.id)
        .select()
        .single();

      user = updatedUser;
    } else {
      // 创建新用户 - 使用 Admin API 创建 auth.users，触发器会自动创建 profile
      console.log('[google-native] Creating new user with Admin API');

      let authUserId: string;

      // 尝试创建用户
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: payload.email!,
        email_confirm: true, // OAuth 用户邮箱已验证
        user_metadata: {
          full_name: displayName || payload.name,
          avatar_url: payload.picture,
          provider: 'google',
        },
      });

      if (authError) {
        // 如果错误是邮箱已存在，获取现有用户
        if (authError.message.includes('already been registered') || authError.message.includes('email_exists')) {
          console.log('[google-native] User already exists in auth.users, fetching existing user');

          // 使用 Admin API 列出用户并找到匹配的邮箱
          const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();

          if (listError || !users) {
            console.error('[google-native] Failed to list users:', listError);
            return NextResponse.json(
              { error: 'Failed to fetch existing user: ' + (listError?.message || 'Unknown error') },
              { status: 500 }
            );
          }

          const existingUser = users.users.find(u => u.email === payload.email);

          if (!existingUser) {
            console.error('[google-native] User not found after email_exists error');
            return NextResponse.json(
              { error: 'User exists but could not be found' },
              { status: 500 }
            );
          }

          authUserId = existingUser.id;
          console.log('[google-native] Found existing user:', authUserId);
        } else {
          // 其他错误
          console.error('[google-native] Failed to create auth user:', authError);
          return NextResponse.json(
            { error: 'Failed to create user: ' + authError.message },
            { status: 500 }
          );
        }
      } else if (authData?.user) {
        authUserId = authData.user.id;
        console.log('[google-native] Auth user created:', authUserId);
      } else {
        console.error('[google-native] No auth data returned');
        return NextResponse.json(
          { error: 'Failed to create user: No data returned' },
          { status: 500 }
        );
      }

      // 等待触发器创建 profile
      console.log('[google-native] Waiting for trigger to create profile');

      let profile = null;
      let attempts = 0;
      const maxAttempts = 10; // 最多等待5秒

      while (attempts < maxAttempts && !profile) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;

        const { data: fetchedProfile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', authUserId)
          .maybeSingle();

        if (fetchedProfile) {
          profile = fetchedProfile;
          console.log('[google-native] Profile found after', attempts * 500, 'ms');
          break;
        }
      }

      if (!profile) {
        console.error('[google-native] Profile not created by trigger after', maxAttempts * 500, 'ms');
        return NextResponse.json(
          { error: 'Profile creation timeout. Please try again.' },
          { status: 500 }
        );
      }

      user = profile;
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Failed to get user data' },
        { status: 500 }
      );
    }

    // 返回用户信息（不需要创建自定义 JWT，前端会直接使用用户信息）
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('[google-native] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Authentication failed' },
      { status: 500 }
    );
  }
}
