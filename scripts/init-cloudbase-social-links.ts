/**
 * 初始化 CloudBase 社交链接数据
 *
 * 运行方式：npx ts-node --esm scripts/init-cloudbase-social-links.ts
 * 或者在 package.json 中添加脚本后运行：npm run init:cloudbase-social-links
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function initCloudBaseSocialLinks() {
  const envId = process.env.WECHAT_CLOUDBASE_ID;
  const secretId = process.env.CLOUDBASE_SECRET_ID;
  const secretKey = process.env.CLOUDBASE_SECRET_KEY;

  if (!envId || !secretId || !secretKey) {
    console.error("❌ 缺少 CloudBase 环境变量：");
    console.error("   - WECHAT_CLOUDBASE_ID:", envId ? "✓" : "✗");
    console.error("   - CLOUDBASE_SECRET_ID:", secretId ? "✓" : "✗");
    console.error("   - CLOUDBASE_SECRET_KEY:", secretKey ? "✓" : "✗");
    process.exit(1);
  }

  console.log("🚀 正在初始化 CloudBase 社交链接...");
  console.log("   环境 ID:", envId);

  try {
    // 动态加载 CloudBase SDK
    const cloudbase = require("@cloudbase/node-sdk");

    const app = cloudbase.init({
      env: envId,
      secretId,
      secretKey,
    });

    const db = app.database();
    const collection = db.collection("social_links");

    // 检查集合是否已有数据
    const { data: existingData } = await collection.limit(1).get();

    if (existingData && existingData.length > 0) {
      console.log("ℹ️  CloudBase 社交链接集合已有数据，跳过初始化");
      console.log("   现有数据数量可通过 count() 查询");

      // 获取所有数据
      const { data: allLinks } = await collection.get();
      console.log("\n📋 现有社交链接：");
      allLinks.forEach((link: any, index: number) => {
        console.log(`   ${index + 1}. ${link.title} - ${link.target_url}`);
      });

      return;
    }

    // 示例社交链接数据
    const sampleLinks = [
      {
        _id: crypto.randomUUID(),
        title: "GitHub",
        description: "查看开源项目",
        icon_url: "https://github.githubassets.com/favicons/favicon.svg",
        target_url: "https://github.com",
        is_active: true,
        sort_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        _id: crypto.randomUUID(),
        title: "Twitter / X",
        description: "关注我们的最新动态",
        icon_url: "https://abs.twimg.com/favicons/twitter.2.ico",
        target_url: "https://x.com",
        is_active: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        _id: crypto.randomUUID(),
        title: "Discord",
        description: "加入社区讨论",
        icon_url: "https://discord.com/assets/favicon.ico",
        target_url: "https://discord.com",
        is_active: true,
        sort_order: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    console.log("📝 正在添加示例数据...");

    for (const link of sampleLinks) {
      await collection.add(link);
      console.log(`   ✓ 已添加: ${link.title}`);
    }

    console.log("\n✅ CloudBase 社交链接初始化完成！");
    console.log("   已添加 " + sampleLinks.length + " 条示例数据");
    console.log("\n💡 提示：");
    console.log("   - 可以通过管理后台 /admin/social-links 管理这些链接");
    console.log("   - 上传新链接时选择 '双端同步' 或 '仅 CloudBase'");
    console.log("   - 图标 URL 可以使用 CloudBase 存储的 cloud:// 链接");

  } catch (error) {
    console.error("❌ 初始化失败:", error);
    process.exit(1);
  }
}

initCloudBaseSocialLinks();
