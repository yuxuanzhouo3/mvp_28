/**
 * 服务器端视频转换工具
 * 使用 fluent-ffmpeg 将 webm 转换为 mp4
 */
import ffmpeg from "fluent-ffmpeg";
import { writeFile, unlink, readFile, access } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { randomUUID } from "crypto";
import { constants } from "fs";

// 获取 ffmpeg 路径
async function getFFmpegPath(): Promise<string> {
  const platform = process.platform === "win32" ? "win32-x64" :
                   process.platform === "darwin" ? "darwin-x64" : "linux-x64";
  const ffmpegExe = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

  const possiblePaths = [
    resolve(process.cwd(), `node_modules/.pnpm/@ffmpeg-installer+ffmpeg@1.1.0/node_modules/@ffmpeg-installer/${platform}/${ffmpegExe}`),
    resolve(process.cwd(), `node_modules/@ffmpeg-installer/${platform}/${ffmpegExe}`),
    resolve(process.cwd(), `node_modules/ffmpeg-static/${ffmpegExe}`),
  ];

  for (const ffmpegPath of possiblePaths) {
    try {
      await access(ffmpegPath, constants.X_OK);
      return ffmpegPath;
    } catch {
      // 继续尝试下一个路径
    }
  }

  // 尝试使用 require 获取路径
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
    if (ffmpegInstaller?.path) {
      try {
        await access(ffmpegInstaller.path, constants.X_OK);
        return ffmpegInstaller.path;
      } catch {
        // 路径存在但不可执行
      }
    }
  } catch {
    // @ffmpeg-installer/ffmpeg 不可用
  }

  return "ffmpeg";
}

// 缓存 ffmpeg 路径
let cachedFFmpegPath: string | null = null;

/**
 * 将 webm Buffer 转换为 mp4 Buffer
 */
export async function convertWebmToMp4(inputBuffer: Buffer): Promise<Buffer> {
  // 获取 ffmpeg 路径（带缓存）
  if (!cachedFFmpegPath) {
    cachedFFmpegPath = await getFFmpegPath();
    ffmpeg.setFfmpegPath(cachedFFmpegPath);
    console.log("[video/converter] Using ffmpeg at:", cachedFFmpegPath);
  }

  const tempDir = tmpdir();
  const inputPath = join(tempDir, `input-${randomUUID()}.webm`);
  const outputPath = join(tempDir, `output-${randomUUID()}.mp4`);

  try {
    // 写入临时输入文件
    await writeFile(inputPath, inputBuffer);

    // 使用 fluent-ffmpeg 进行转换 - 使用最简单的参数
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          "-c:v libx264",       // H.264 视频编码
          "-pix_fmt yuv420p",   // 标准像素格式
          "-c:a aac",           // AAC 音频编码
        ])
        .on("start", (cmd) => {
          console.log("[video/converter] FFmpeg command:", cmd);
        })
        .on("progress", (progress) => {
          if (progress.percent) {
            console.log("[video/converter] Progress:", Math.round(progress.percent) + "%");
          }
        })
        .on("error", (err, stdout, stderr) => {
          console.error("[video/converter] FFmpeg error:", err.message);
          console.error("[video/converter] FFmpeg stderr:", stderr);
          reject(new Error(`FFmpeg error: ${err.message}`));
        })
        .on("end", () => {
          console.log("[video/converter] Conversion completed");
          resolve();
        })
        .save(outputPath);
    });

    // 读取输出文件
    const outputBuffer = await readFile(outputPath);
    return outputBuffer;
  } finally {
    // 清理临时文件
    try {
      await unlink(inputPath);
    } catch {}
    try {
      await unlink(outputPath);
    } catch {}
  }
}

/**
 * 检查文件是否需要转换
 */
export function needsConversion(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return ext === "webm";
}

/**
 * 获取转换后的文件名
 */
export function getConvertedFilename(filename: string): string {
  return filename.replace(/\.webm$/i, ".mp4");
}
