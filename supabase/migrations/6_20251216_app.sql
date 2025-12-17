-- =============================================================================
-- 1. 为 advertisements 表添加 file_size 字段
-- =============================================================================
ALTER TABLE public.advertisements
ADD COLUMN IF NOT EXISTS file_size bigint;

COMMENT ON COLUMN public.advertisements.file_size IS '文件大小（字节）';


-- =============================================================================
-- 2. 创建发布版本表 (app_releases)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.app_releases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 版本信息
  version text NOT NULL,              -- 版本号 (如 "1.0.0", "2.1.3")
  platform text NOT NULL,             -- 平台 ("ios", "android", "windows", "macos", "linux")
  variant text,                       -- 变体/架构 ("x64", "x86", "arm64", "intel", "m", "deb", "rpm" 等)

  -- 文件信息
  file_url text NOT NULL,             -- 安装包下载地址
  file_size bigint,                   -- 文件大小（字节）

  -- 版本说明
  release_notes text,                 -- 更新日志/版本说明

  -- 控制开关
  is_active boolean DEFAULT true,     -- 是否启用
  is_mandatory boolean DEFAULT false, -- 是否强制更新

  -- 审计时间
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 添加字段注释
COMMENT ON TABLE public.app_releases IS '应用发布版本表';
COMMENT ON COLUMN public.app_releases.version IS '版本号';
COMMENT ON COLUMN public.app_releases.platform IS '平台标识 (ios/android/windows/macos/linux)';
COMMENT ON COLUMN public.app_releases.variant IS '变体/架构标识 (x64/x86/arm64/intel/m/deb/rpm/appimage/snap/flatpak/aur)';
COMMENT ON COLUMN public.app_releases.file_url IS '安装包下载地址';
COMMENT ON COLUMN public.app_releases.file_size IS '文件大小（字节）';
COMMENT ON COLUMN public.app_releases.release_notes IS '更新日志/版本说明';
COMMENT ON COLUMN public.app_releases.is_active IS '是否启用';
COMMENT ON COLUMN public.app_releases.is_mandatory IS '是否强制更新';


-- =============================================================================
-- 3. 创建索引 (加速查询)
-- =============================================================================
-- 按平台和版本查询
CREATE INDEX IF NOT EXISTS idx_releases_platform_version
ON public.app_releases(platform, version DESC);

-- 按平台和激活状态查询
CREATE INDEX IF NOT EXISTS idx_releases_platform_active
ON public.app_releases(platform, is_active, created_at DESC);


-- =============================================================================
-- 4. 启用 RLS (行级安全策略)
-- =============================================================================
ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

-- 策略 A: 允许所有人 (Public) "读取" 激活的发布版本
CREATE POLICY "Public can view active releases"
ON public.app_releases FOR SELECT
USING ( is_active = true );

-- 策略 B: Service Role 自动拥有所有权限，无需额外配置


-- =============================================================================
-- 5. 创建 releases Storage 存储桶
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('releases', 'releases', true)
ON CONFLICT (id) DO NOTHING;

-- 允许所有人读取 'releases' 桶里的文件 (用于下载)
CREATE POLICY "Public Access for Releases"
ON storage.objects FOR SELECT
USING ( bucket_id = 'releases' );

-- 允许已登录用户上传文件
CREATE POLICY "Authenticated users can upload releases"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'releases' );


-- =============================================================================
-- 6. 创建更新时间触发器
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_app_releases_updated_at
  BEFORE UPDATE ON public.app_releases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
