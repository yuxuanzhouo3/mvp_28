import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const PROFILE_POLL_INTERVAL_MS = 500;
const PROFILE_POLL_ATTEMPTS = 20;

async function fetchProfileById(userId: string) {
  if (!supabaseAdmin) return null;

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  return data;
}

async function ensureProfileAndWallet(
  userId: string,
  payload: Record<string, any>,
  displayName?: string,
) {
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin client not configured');
  }

  const profileName =
    displayName || payload.name || payload.email?.split('@')[0] || 'User';
  const avatar = payload.picture || '';

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: userId,
        email: payload.email,
        name: profileName,
        avatar,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .select()
    .single();

  if (profileError || !profile) {
    throw new Error(
      `Failed to create profile: ${profileError?.message || 'Unknown error'}`,
    );
  }

  const { error: walletError } = await supabaseAdmin.from('user_wallets').upsert(
    {
      user_id: userId,
      plan: 'Free',
      subscription_tier: 'Free',
      monthly_image_balance: 30,
      monthly_video_balance: 5,
      addon_image_balance: 0,
      addon_video_balance: 0,
      daily_external_plan: 'free',
      daily_external_used: 0,
      billing_cycle_anchor: new Date().getUTCDate(),
    },
    { onConflict: 'user_id' },
  );

  if (walletError) {
    // Wallet creation should not block login once the profile exists.
    console.warn('[google-native] Failed to ensure wallet:', walletError.message);
  }

  return profile;
}

export async function POST(request: NextRequest) {
  try {
    const { idToken, displayName } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: 'Google Client ID not configured' },
        { status: 500 },
      );
    }

    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase Admin client not configured' },
        { status: 500 },
      );
    }

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', payload.email)
      .maybeSingle();

    let user;

    if (existingProfile) {
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', existingProfile.id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: `Failed to update user: ${updateError.message}` },
          { status: 500 },
        );
      }

      user = updatedUser;
    } else {
      console.log('[google-native] Creating new user with Admin API');

      let authUserId: string;

      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: payload.email,
          email_confirm: true,
          user_metadata: {
            full_name: displayName || payload.name,
            avatar_url: payload.picture,
            provider: 'google',
          },
        });

      if (authError) {
        if (
          authError.message.includes('already been registered') ||
          authError.message.includes('email_exists')
        ) {
          console.log(
            '[google-native] User already exists in auth.users, fetching existing user',
          );

          const { data: users, error: listError } =
            await supabaseAdmin.auth.admin.listUsers();

          if (listError || !users) {
            return NextResponse.json(
              {
                error:
                  'Failed to fetch existing user: ' +
                  (listError?.message || 'Unknown error'),
              },
              { status: 500 },
            );
          }

          const existingUser = users.users.find((entry) => entry.email === payload.email);

          if (!existingUser) {
            return NextResponse.json(
              { error: 'User exists but could not be found' },
              { status: 500 },
            );
          }

          authUserId = existingUser.id;
        } else {
          console.error('[google-native] Failed to create auth user:', authError);
          return NextResponse.json(
            { error: `Failed to create user: ${authError.message}` },
            { status: 500 },
          );
        }
      } else if (authData?.user) {
        authUserId = authData.user.id;
        console.log('[google-native] Auth user created:', authUserId);
      } else {
        return NextResponse.json(
          { error: 'Failed to create user: No data returned' },
          { status: 500 },
        );
      }

      console.log('[google-native] Waiting for trigger to create profile');

      let profile = null;
      let attempts = 0;

      while (attempts < PROFILE_POLL_ATTEMPTS && !profile) {
        await new Promise((resolve) => setTimeout(resolve, PROFILE_POLL_INTERVAL_MS));
        attempts += 1;

        const fetchedProfile = await fetchProfileById(authUserId);
        if (fetchedProfile) {
          profile = fetchedProfile;
          console.log(
            '[google-native] Profile found after',
            attempts * PROFILE_POLL_INTERVAL_MS,
            'ms',
          );
        }
      }

      if (!profile) {
        console.warn(
          '[google-native] Trigger did not create profile in time, creating fallback profile',
        );
        profile = await ensureProfileAndWallet(authUserId, payload, displayName);
      }

      user = profile;
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Failed to get user data' },
        { status: 500 },
      );
    }

    const jwt = require('jsonwebtoken');
    const JWT_SECRET =
      process.env.JWT_SECRET || 'default-secret-key-change-in-production';

    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: 'authenticated',
      },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    const refreshToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: '7d' },
    );

    const session = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      refresh_token_expires_in: 604800,
      token_type: 'bearer',
      user: {
        id: user.id,
        email: user.email,
        role: 'authenticated',
      },
    };

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
      session,
    });
  } catch (error) {
    console.error('[google-native] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Authentication failed' },
      { status: 500 },
    );
  }
}
