/**
 * CloudBase 认证服务（国内版）
 * 使用 CloudBase 文档库的 users 与 sessions 两张集合
 * 不做邮箱验证，直接写入并返回会话 token
 */

import bcrypt from "bcryptjs";
import { CloudBaseConnector } from "./connector";
import { seedWalletForPlan } from "@/services/wallet";

export interface CloudBaseUser {
  _id?: string;
  email: string | null;
  password: string | null;
  name: string | null;
  avatar: string | null;
  wechatOpenId?: string;
  wechatUnionId?: string | null;
  createdAt: string;
  lastLoginAt: string;
  pro: boolean;
  region: "CN";
  subscriptionTier?: string;
  plan?: string | null;
  plan_exp?: string | null;
  planExp?: string | null;
  paymentMethod: string | null;
  pendingDowngrade?: {
    targetPlan: string;
    effectiveAt?: string;
  } | null;
  hide_ads?: boolean; // 是否去除广告
}

export interface CloudBaseSession {
  access_token: string;
  expires_at: number;
  user: CloudBaseAuthUser;
}

export interface CloudBaseAuthUser {
  id: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  createdAt: Date;
  metadata: {
    pro: boolean;
    region: "CN";
    plan?: string | null;
    plan_exp?: string | null;
    hide_ads?: boolean; // 是否去除广告
  };
}

export class CloudBaseAuthService {
  private db: any = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize() {
    const connector = new CloudBaseConnector({});
    await connector.initialize();
    this.db = connector.getClient();
  }

  private async ensureReady() {
    if (this.initPromise) await this.initPromise;
    if (!this.db) throw new Error("CloudBase database not ready");
  }

  async signInWithEmail(email: string, password: string): Promise<{
    user: CloudBaseAuthUser | null;
    session?: CloudBaseSession;
    error?: Error;
  }> {
    try {
      await this.ensureReady();
      const result = await this.db.collection("users").where({ email }).get();
      let user = result.data[0] as CloudBaseUser | undefined;
      if (!user || !user.password) {
        return { user: null, error: new Error("User not found") };
      }

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        return { user: null, error: new Error("Invalid password") };
      }

      if (user._id) {
        user = await this.applyPendingDowngradeIfNeeded(user._id, user);
      }

      const authUser = this.mapUser(user._id!, user);
      const session = await this.createSession(user._id!);

      await this.db
        .collection("users")
        .doc(user._id)
        .update({ lastLoginAt: new Date().toISOString() });

      return { user: authUser, session };
    } catch (error) {
      console.error("[cloudbase] signIn error", error);
      return { user: null, error: error as Error };
    }
  }

  async signUpWithEmail(email: string, password: string, name?: string): Promise<{
    user: CloudBaseAuthUser | null;
    session?: CloudBaseSession;
    error?: Error;
  }> {
    try {
      await this.ensureReady();
      const existing = await this.db.collection("users").where({ email }).get();
      if (existing.data.length > 0) {
        return { user: null, error: new Error("User already exists") };
      }

      const hashed = await bcrypt.hash(password, 10);
      const now = new Date().toISOString();

      const userData: CloudBaseUser = {
        email,
        password: hashed,
        name: name || null,
        avatar: null,
        createdAt: now,
        lastLoginAt: now,
        pro: false,
        region: "CN",
        subscriptionTier: "free",
        plan: "free",
        plan_exp: null,
        paymentMethod: null,
      };

      const result = await this.db.collection("users").add(userData);

    const authUser = this.mapUser(result.id, userData);
    const session = await this.createSession(result.id);

      return { user: authUser, session };
    } catch (error) {
      console.error("[cloudbase] signUp error", error);
      return { user: null, error: error as Error };
    }
  }

  async validateToken(token: string): Promise<CloudBaseAuthUser | null> {
    try {
      await this.ensureReady();
      const sessions = await this.db.collection("sessions").where({ token }).limit(1).get();
      const session = sessions.data[0] as { userId: string; expiresAt: number } | undefined;
      if (!session) {
        console.warn("[cloudbase] validateToken: session not found for token", token);
        return null;
      }
      if (session.expiresAt < Date.now()) {
        console.warn("[cloudbase] validateToken: session expired", session);
        return null;
      }

      const users = await this.db.collection("users").doc(session.userId).get();
      let user = users.data[0] as CloudBaseUser | undefined;
      if (!user || !user._id) {
        console.warn("[cloudbase] validateToken: user not found for session", session);
        return null;
      }

      user = await this.applyPendingDowngradeIfNeeded(user._id, user);
      return this.mapUser(user._id, user);
    } catch (error) {
      console.error("[cloudbase] validate token error", error);
      return null;
    }
  }

  async signInWithWechat(params: {
    openid: string;
    unionid?: string | null;
    nickname?: string | null;
    avatar?: string | null;
  }): Promise<{
    user: CloudBaseAuthUser | null;
    session?: CloudBaseSession;
    error?: Error;
  }> {
    const { openid, unionid, nickname, avatar } = params;

    if (!openid) {
      return { user: null, error: new Error("Missing openid") };
    }

    try {
      await this.ensureReady();
      const usersColl = this.db.collection("users");

      // 优先按 wechatOpenId 查找
      let existing = await usersColl.where({ wechatOpenId: openid }).limit(1).get();
      let user = existing.data[0] as CloudBaseUser | undefined;

      // 兼容早期用 email 存 openid 的情况
      if (!user) {
        const emailKey = `wechat_${openid}@local.wechat`;
        existing = await usersColl.where({ email: emailKey }).limit(1).get();
        user = existing.data[0] as CloudBaseUser | undefined;
      }

      const now = new Date().toISOString();

      if (!user) {
        // 创建新用户
        const email = `wechat_${openid}@local.wechat`;
        const userData: CloudBaseUser & { wechatOpenId: string; wechatUnionId?: string | null } =
          {
            email,
            password: null,
            name: nickname || "微信用户",
            avatar: avatar || null,
            createdAt: now,
            lastLoginAt: now,
            pro: false,
            region: "CN",
            subscriptionTier: "free",
            plan: "free",
            plan_exp: null,
            paymentMethod: null,
            wechatOpenId: openid,
            wechatUnionId: unionid || null,
          };

        const result = await usersColl.add(userData);
        user = { ...userData, _id: result.id };
      } else if (user._id) {
        // 更新已有用户的头像/昵称/登录时间
        const updateData = {
          name: nickname || user.name,
          avatar: avatar || user.avatar,
          lastLoginAt: now,
          wechatOpenId: openid,
          wechatUnionId: unionid || null,
        };
        await usersColl.doc(user._id).update(updateData);
        // 刷新 user 对象以反映更新
        user = { ...user, ...updateData };
      }

      if (!user || !user._id) {
        return { user: null, error: new Error("Failed to load/create user") };
      }

      user = await this.applyPendingDowngradeIfNeeded(user._id, user);

      const authUser = this.mapUser(user._id, user);
      const session = await this.createSession(user._id);

      return { user: authUser, session };
    } catch (error) {
      console.error("[cloudbase] signInWithWechat error", error);
      return { user: null, error: error as Error };
    }
  }

  private generateToken(): string {
    return Buffer.from(`${Date.now()}-${Math.random().toString(36).slice(2)}`).toString("base64");
  }

  private async createSession(userId: string): Promise<CloudBaseSession> {
    const token = this.generateToken();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    await this.db.collection("sessions").add({
      userId,
      token,
      createdAt: new Date().toISOString(),
      expiresAt,
    });

      const users = await this.db.collection("users").doc(userId).get();
      const user = users.data[0] as CloudBaseUser;
      const authUser = this.mapUser(userId, user);

    return {
      access_token: token,
      expires_at: expiresAt,
      user: authUser,
    };
  }

  /**
   * 处理已过期的降级请求：
   * - 等到当前套餐到期后，自动切换到用户预先购买的低阶套餐
   * - 激活 pending 订阅记录，并重置对应套餐的钱包额度
   */
  private async applyPendingDowngradeIfNeeded(
    userId: string,
    userDoc: CloudBaseUser
  ): Promise<CloudBaseUser> {
    const pending = userDoc?.pendingDowngrade;
    if (!pending?.targetPlan) return userDoc;

    const effectiveAt = pending.effectiveAt
      ? new Date(pending.effectiveAt)
      : userDoc.plan_exp
        ? new Date(userDoc.plan_exp)
        : null;
    if (!effectiveAt || effectiveAt.getTime() > Date.now()) {
      return userDoc;
    }

    const now = new Date();
    const subsColl = this.db.collection("subscriptions");

    try {
      const pendingRes = await subsColl
        .where({ userId, plan: pending.targetPlan, status: "pending" })
        .get();

      const pendingSub =
        pendingRes?.data?.find(
          (s: any) => !s.startedAt || new Date(s.startedAt) <= now
        ) || pendingRes?.data?.[0] || null;

      const nextExpire = pendingSub?.expiresAt
        ? new Date(pendingSub.expiresAt)
        : null;

      const updatePayload: Record<string, any> = {
        plan: pending.targetPlan,
        subscriptionTier: pending.targetPlan,
        plan_exp: nextExpire ? nextExpire.toISOString() : null,
        pro: (pending.targetPlan || "").toLowerCase() !== "basic",
        pendingDowngrade: null,
        updatedAt: now.toISOString(),
      };

      await this.db.collection("users").doc(userId).update(updatePayload);

      if (pendingSub?._id) {
        await subsColl.doc(pendingSub._id).update({
          status: "active",
          startedAt: pendingSub.startedAt || effectiveAt.toISOString(),
          updatedAt: now.toISOString(),
        });
      }

      await seedWalletForPlan(userId, (pending.targetPlan as string).toLowerCase(), {
        forceReset: true,
      });

      const refreshed = await this.db.collection("users").doc(userId).get();
      const refreshedDoc = refreshed?.data?.[0] as CloudBaseUser | undefined;
      return refreshedDoc || ({ ...userDoc, ...updatePayload } as CloudBaseUser);
    } catch (error) {
      console.error("[cloudbase] applyPendingDowngrade error", error);
      return userDoc;
    }
  }

  private mapUser(id: string, user: CloudBaseUser): CloudBaseAuthUser {
    const plan =
      (user.plan as string | undefined) ||
      (user.subscriptionTier as string | undefined) ||
      (user.pro ? "pro" : "free");
    const planLower = typeof plan === "string" ? plan.toLowerCase() : "free";
    // Basic 不视为 pro（国际版逻辑一致），其余使用 user.pro 标记
    const isProEffective = !!user.pro && planLower !== "basic";
    const planExp = (user.plan_exp as string | null | undefined) ?? user.planExp ?? null;

    return {
      id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      createdAt: new Date(user.createdAt),
      metadata: {
        pro: isProEffective,
        region: "CN",
        plan,
        plan_exp: planExp,
        hide_ads: user.hide_ads ?? false, // 返回 hide_ads 设置
      },
    };
  }
}
