"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SubscriptionTermsContentProps {
  isDomestic: boolean;
}

// 国内版订阅规则完整内容
const SUBSCRIPTION_TERMS_CN = `# 订阅规则（国内版）

**适用版本**：MornGPT 国内版

**生效日期**：2025年12月23日

**更新日期**：2025年12月23日

---

## 一、订阅套餐

| 套餐 | 月付价格 | 年付价格(月均) | 每日外部模型调用 | 月图片额度 | 月视频/音频额度 |
|:---:|:-------:|:------------:|:-------------:|:--------:|:-------------:|
| Free | 免费 | - | 10次 | 30次 | 5次 |
| Basic(基础版) | ￥29.90 | ￥20.90 | 50次 | 100次 | 20次 |
| Pro(专业版) | ￥99.90 | ￥69.90 | 200次 | 500次 | 100次 |
| Enterprise(企业版) | ￥199.90 | ￥139.90 | 2000次 | 1500次 | 200次 |

> **说明**：General Model（通用模型，国内版使用 qwen-turbo）对所有用户无限制使用，不消耗每日调用次数。

---

## 二、订阅计算规则

### 2.1 同级续费（续订相同套餐）

当您续订相同套餐时，系统会自动顺延有效期：

- **月付续费**：在当前到期日基础上延长 1 个自然月
- **年付续费**：在当前到期日基础上延长 12 个自然月
- **月末粘性规则**：如果您的账单日是 31 号，系统会智能处理大小月问题
  - 例如：1月31日续费月付 → 到期日为2月28日（或29日）
  - 3月续费时 → 到期日会自动回调至3月31日
  - 我们承诺不会因大小月差异导致您的账单日永久提前

### 2.2 升级订阅（从低级升至高级）

当您从较低套餐升级到较高套餐时：

1. **计算剩余价值**：系统会计算您当前套餐的剩余天数，并按日折算剩余价值
   - 剩余价值 = 剩余天数 × (当前套餐月费 ÷ 30)
2. **价值折算**：剩余价值会自动折算为新套餐的使用天数
   - 折算天数 = 剩余价值 ÷ (新套餐月费 ÷ 30)
3. **新到期日计算**：新套餐到期日 = 今天 + 折算天数 + 新购买周期天数
4. **生效时间**：升级立即生效
5. **额度处理**：
   - 升级后立即获得新套餐的月度额度上限
   - 加油包额度不受影响，继续保留

### 2.3 降级订阅（从高级降至低级）

当您从较高套餐降级到较低套餐时：

1. **延迟生效**：降级不会立即生效，而是在当前套餐到期后次日生效
2. **继续享受**：在当前套餐到期前，您仍可继续享受高级套餐的全部权益
3. **额度重置**：降级生效时，月度额度将重置为新套餐的额度上限
4. **待降级状态**：系统会记录您的降级意向，到期后自动执行

---

## 三、额度刷新机制

### 3.1 每日外部模型调用

- **刷新时间**：每日北京时间 00:00 自动刷新
- **刷新规则**：每日已用次数重置为 0
- **适用范围**：所有外部模型调用（不包括通用模型 qwen-turbo）

### 3.2 月度多模态配额（图片/视频/音频）

- **刷新时间**：按您的专属账单日刷新（即首次订阅的日期）
- **月末粘性**：如果您的账单日是 31 号，系统会智能处理
  - 2月账单日自动调整为 28/29 日
  - 3月账单日会自动回调至 31 日
- **刷新规则**：月度配额重置为当前套餐的额度上限

---

## 四、加油包（额外额度）

| 档位 | 价格 | 图片额度 | 视频/音频额度 | 有效期 |
|:---:|:---:|:------:|:-----------:|:-----:|
| Starter | ￥9.9 | 30次 | 5次 | 永久 |
| Standard | ￥29.9 | 100次 | 20次 | 永久 |
| Premium | ￥69.9 | 300次 | 60次 | 永久 |

**扣费策略**：FEFO（先过期先扣）

为了最大化保障您的权益，系统严格遵循「优先消耗限时额度」的原则：

1. **第一优先级：月度订阅额度** 🟢
   - 系统会优先扣除您套餐内包含的月度额度
   - 月度额度当期有效，不可结转至下月
   - 账单日刷新时，未用完的月度额度将重置

2. **第二优先级：加油包额度** 🔵
   - 仅当月度额度全部耗尽（或您当前未订阅任何套餐）时，才会扣除加油包额度
   - 加油包额度永久有效，直到用完为止，不会随时间过期

**加油包特殊规则**：
- **永久有效期**：购买后若未使用，额度将永久保留在您的账户中
- **独立使用**：即使月度订阅已过期或取消，仍可单独使用加油包额度
- **叠加规则**：多次购买加油包，额度将直接累加
- **不可退款**：加油包属于数字化虚拟商品，一经售出不支持退款

---

## 五、变更与续费

### 5.1 升级套餐 (Upgrade)

- 升级立即生效
- 账单日重置：升级当天将成为您新的账单日
- 额度处理：您将立即获得新套餐的完整月度额度，旧套餐未用完的月度额度将被覆盖（加油包额度不受影响，继续保留）

### 5.2 续费 (Renewal)

- 续费成功后，您的账单日保持不变
- 月度额度将在账单日自动重置为满额

### 5.3 过期/取消 (Expiration)

- 订阅过期后，未用完的月度额度将失效并清零
- 账户内的加油包额度依然保留，可继续使用

---

## 六、异常与限制

### 6.1 扣款失败
若自动续费失败，系统将暂停您的订阅权益（月度额度归零），直到重新支付成功。期间您仍可消耗加油包额度。

### 6.2 合规检测
系统会对访问 IP 进行合规检测，若检测到异常区域（如部分受限地区），可能会限制服务的连接。

---

## 七、退款政策

### 7.1 订阅退款
- 订阅服务一经开通，不支持退款
- 删除账户时，剩余订阅时长将被作废，不予退款

### 7.2 加油包退款
- 加油包属于数字化虚拟商品，一经售出不支持退款
- 删除账户时，剩余加油包额度将被清空，不予退款

---

## 八、联系我们

如果您对订阅规则有任何疑问，请通过以下方式联系我们：

- **邮箱**：mornscience@gmail.com
- **服务时间**：周一至周五 9:00-18:00

---

**Copyright © 2025 Yuxuan Zhou. [粤ICP备2024281756号-3]**
`;

// 国际版订阅规则完整内容
const SUBSCRIPTION_TERMS_EN = `# Subscription Terms (Global Edition)

**Applicable Edition**: MornGPT Global Edition

**Effective Date**: December 23, 2025

**Last Updated**: December 23, 2025

---

## 1. Subscription Plans

| Plan | Monthly Price | Annual Price (per month) | Daily External Model Calls | Monthly Image Quota | Monthly Video/Audio Quota |
|:---:|:-------------:|:------------------------:|:--------------------------:|:-------------------:|:-------------------------:|
| Free | Free | - | 10 | 30 | 5 |
| Basic | $9.98 | $6.99 | 50 | 100 | 20 |
| Pro | $39.98 | $27.99 | 200 | 500 | 100 |
| Enterprise | $99.98 | $69.99 | 2000 | 1500 | 200 |

> **Note**: The General Model (international edition uses \`mistral-small-latest\`) is unlimited for all users and does not consume daily call quota.

---

## 2. Subscription Calculation Rules

### 2.1 Same-tier Renewal (Extending the same plan)

When you renew the same subscription plan, the system automatically extends your expiration date:

- **Monthly Renewal**: Extends by 1 calendar month from current expiration date
- **Annual Renewal**: Extends by 12 calendar months from current expiration date
- **Month-end Stickiness Rule**: If your billing date is the 31st, the system handles month differences intelligently
  - Example: Jan 31 monthly renewal → expires Feb 28 (or 29)
  - March renewal → expiration auto-adjusts back to Mar 31
  - We guarantee your billing date won't permanently shift earlier due to month-length differences

### 2.2 Upgrading Subscription (Lower to Higher tier)

When upgrading from a lower-tier to a higher-tier plan:

1. **Calculate Remaining Value**: The system calculates remaining days of your current plan and prorates the value
   - Remaining Value = Remaining Days × (Current Plan Monthly Price ÷ 30)
2. **Value Conversion**: Remaining value is converted to days on the new plan
   - Converted Days = Remaining Value ÷ (New Plan Monthly Price ÷ 30)
3. **New Expiration Calculation**: New plan expires = Today + Converted Days + Purchased Period Days
4. **Effective Time**: Upgrade takes effect immediately
5. **Quota Handling**:
   - You immediately receive the new plan's monthly quota limits
   - Addon pack credits remain unaffected

### 2.3 Downgrading Subscription (Higher to Lower tier)

When downgrading from a higher-tier to a lower-tier plan:

1. **Delayed Effect**: Downgrade does NOT take effect immediately; it activates the day after your current plan expires
2. **Continue Enjoying**: You continue enjoying all higher-tier benefits until current plan expiration
3. **Quota Reset**: When downgrade activates, monthly quota resets to the new plan's limits
4. **Pending Status**: The system records your downgrade intent and auto-executes upon expiration

---

## 3. Quota Refresh Mechanism

### 3.1 Daily External Model Calls

- **Refresh Time**: Automatically refreshes daily at 00:00 Beijing Time (UTC+8)
- **Refresh Rule**: Daily used count resets to 0
- **Applies To**: All external model calls (excludes the unlimited General Model)

### 3.2 Monthly Multimodal Quota (Image/Video/Audio)

- **Refresh Time**: Refreshes on your personal billing anchor day (the date of your first subscription)
- **Month-end Stickiness**: If your billing date is the 31st, the system handles it intelligently
  - February billing date auto-adjusts to 28/29
  - March billing date auto-adjusts back to 31
- **Refresh Rule**: Monthly quota resets to your current plan's quota limits

---

## 4. Quota Gas Packs (Additional Credits)

| Tier | Price | Image Credits | Video/Audio Credits | Validity |
|:---:|:-----:|:-------------:|:-------------------:|:--------:|
| Starter | $3.98 | 30 | 5 | Permanent |
| Standard | $9.98 | 100 | 20 | Permanent |
| Premium | $29.98 | 300 | 60 | Permanent |

**Deduction Policy**: FEFO (First Expiring, First Out)

To maximize your benefits, the system strictly follows the "consume expiring credits first" principle:

1. **First Priority: Monthly Subscription Quota** 🟢
   - System prioritizes deducting from your plan's monthly quota
   - Monthly quota is valid only for the current period and cannot carry over
   - Unused monthly quota resets on your billing date

2. **Second Priority: Addon Pack Credits** 🔵
   - Only when monthly quota is exhausted (or you have no active subscription) will addon credits be used
   - Addon pack credits are permanent and never expire

**Addon Pack Special Rules**:
- **Permanent Validity**: Unused credits remain in your account indefinitely
- **Independent Usage**: Even if your subscription expires or is cancelled, you can still use addon credits
- **Stacking Rule**: Multiple addon pack purchases accumulate directly
- **Non-refundable**: Addon packs are digital products and cannot be refunded once purchased

---

## 5. Changes & Renewal

### 5.1 Upgrade

- Upgrade takes effect immediately
- Billing date reset: The upgrade day becomes your new billing date
- Quota handling: You immediately receive the new plan's full monthly quota; unused quota from the old plan is overwritten (addon pack credits remain unaffected)

### 5.2 Renewal

- After successful renewal, your billing date remains unchanged
- Monthly quota automatically resets to full on your billing date

### 5.3 Expiration/Cancellation

- After subscription expires, unused monthly quota becomes invalid and resets to zero
- Addon pack credits in your account remain available for continued use

---

## 6. Exceptions & Limitations

### 6.1 Payment Failure
If automatic renewal fails, the system will suspend your subscription benefits (monthly quota resets to zero) until payment succeeds. You can still use addon pack credits during this period.

### 6.2 Compliance Checks
The system performs IP-based compliance checks. Access may be restricted if anomalous regions are detected (e.g., certain restricted areas).

---

## 7. Refund Policy

### 7.1 Subscription Refunds
- Subscription services are non-refundable once activated
- When deleting your account, remaining subscription time will be forfeited with no refund

### 7.2 Addon Pack Refunds
- Addon packs are digital products and are non-refundable once purchased
- When deleting your account, remaining addon pack credits will be cleared with no refund

---

## 8. Contact Us

If you have any questions about these Subscription Terms, please contact us:

- **Email**: mornscience@gmail.com
- **Business Hours**: Monday to Friday, 9:00 AM - 6:00 PM (UTC+8)

---

**Copyright © 2025 Yuxuan Zhou. All Rights Reserved.**
`;

export function SubscriptionTermsContent({ isDomestic }: SubscriptionTermsContentProps) {
  const content = isDomestic ? SUBSCRIPTION_TERMS_CN : SUBSCRIPTION_TERMS_EN;

  return (
    <div className="subscription-terms-content prose prose-sm dark:prose-invert max-w-none px-1 sm:px-2 lg:px-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 lg:mb-5 pb-2 border-b-2 border-gradient-to-r from-emerald-500 to-teal-500">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm sm:text-base lg:text-lg font-bold text-gray-800 dark:text-gray-100 mt-4 sm:mt-5 lg:mt-6 mb-2 sm:mb-3 flex items-center">
              <span className="w-0.5 sm:w-1 h-4 sm:h-5 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full mr-1.5 sm:mr-2" />
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs sm:text-sm lg:text-base font-semibold text-gray-800 dark:text-gray-200 mt-3 sm:mt-4 mb-1.5 sm:mb-2">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mt-2 sm:mt-3 mb-1">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm lg:text-base leading-relaxed mb-2 sm:mb-3">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-none space-y-1.5 sm:space-y-2 ml-0 my-2 sm:my-3">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1.5 sm:space-y-2 ml-0 my-2 sm:my-3 text-gray-600 dark:text-gray-300 text-xs sm:text-sm lg:text-base">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm lg:text-base flex items-start">
              <span className="w-1 sm:w-1.5 h-1 sm:h-1.5 bg-emerald-500 rounded-full mr-1.5 sm:mr-2 mt-1.5 flex-shrink-0" />
              <span className="flex-1">{children}</span>
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 sm:border-l-4 border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 pl-2 sm:pl-4 py-1.5 sm:py-2 my-3 sm:my-4 rounded-r-lg">
              <div className="text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm">
                {children}
              </div>
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 sm:my-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm -mx-2 sm:-mx-1 lg:mx-0">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-[10px] sm:text-xs lg:text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-1.5 sm:px-2 lg:px-3 py-1 sm:py-1.5 lg:py-2 text-left text-[9px] sm:text-[10px] lg:text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-1.5 sm:px-2 lg:px-3 py-1 sm:py-1.5 lg:py-2 text-[10px] sm:text-xs lg:text-sm text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700">
              {children}
            </td>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900 dark:text-white">
              {children}
            </strong>
          ),
          hr: () => (
            <hr className="my-4 sm:my-6 border-0 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs sm:text-sm break-all"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="bg-gray-100 dark:bg-gray-800 px-1 sm:px-1.5 py-0.5 rounded text-xs sm:text-sm font-mono text-gray-800 dark:text-gray-200">
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default SubscriptionTermsContent;
