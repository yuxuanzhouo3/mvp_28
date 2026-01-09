import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;
let loadPromise: Promise<void> | null = null;
let ffmpegAvailable: boolean | null = null;

/**
 * 检查 FFmpeg.wasm 是否可用（需要 SharedArrayBuffer）
 */
function checkFFmpegSupport(): boolean {
  if (ffmpegAvailable !== null) return ffmpegAvailable;

  try {
    // FFmpeg.wasm 需要 SharedArrayBuffer，检查是否可用
    ffmpegAvailable = typeof SharedArrayBuffer !== "undefined";
  } catch {
    ffmpegAvailable = false;
  }

  if (!ffmpegAvailable) {
    console.warn("[videoConverter] SharedArrayBuffer 不可用，视频转换功能将被禁用");
  }

  return ffmpegAvailable;
}

/**
 * 初始化 FFmpeg（单例模式，只加载一次）
 */
async function getFFmpeg(): Promise<FFmpeg> {
  if (!checkFFmpegSupport()) {
    throw new Error("FFmpeg 不可用：浏览器不支持 SharedArrayBuffer");
  }

  if (ffmpeg && ffmpeg.loaded) {
    return ffmpeg;
  }

  if (loadPromise) {
    await loadPromise;
    return ffmpeg!;
  }

  ffmpeg = new FFmpeg();

  loadPromise = (async () => {
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    await ffmpeg!.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
  })();

  await loadPromise;
  return ffmpeg;
}

export interface ConvertResult {
  blob: Blob;
  url: string;
  name: string;
}

/**
 * 将 webm 视频转换为 mp4 格式
 * @param inputBlob 输入的 webm Blob
 * @param originalName 原始文件名
 * @param onProgress 进度回调 (0-100)
 */
export async function convertWebmToMp4(
  inputBlob: Blob,
  originalName: string,
  onProgress?: (progress: number) => void
): Promise<ConvertResult> {
  const ff = await getFFmpeg();

  // 设置进度回调
  if (onProgress) {
    ff.on("progress", ({ progress }) => {
      onProgress(Math.round(progress * 100));
    });
  }

  const inputName = "input.webm";
  const outputName = "output.mp4";

  // 直接将 Blob 转换为 Uint8Array，避免 fetchFile 的问题
  const arrayBuffer = await inputBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // 写入输入文件
  await ff.writeFile(inputName, uint8Array);

  // 执行转换（使用兼容性好的编码参数）
  await ff.exec([
    "-i", inputName,
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    outputName,
  ]);

  // 读取输出文件
  const data = await ff.readFile(outputName);
  const outputBlob = new Blob([data], { type: "video/mp4" });
  const url = URL.createObjectURL(outputBlob);

  // 生成新文件名
  const baseName = originalName.replace(/\.[^.]+$/, "");
  const newName = `${baseName}.mp4`;

  // 清理临时文件
  await ff.deleteFile(inputName);
  await ff.deleteFile(outputName);

  return { blob: outputBlob, url, name: newName };
}

/**
 * 检查是否需要转换（webm 格式需要转换）
 */
export function needsConversion(mimeType: string): boolean {
  return mimeType.includes("webm");
}

/**
 * 检查是否可以进行视频转换
 */
export function canConvert(): boolean {
  return checkFFmpegSupport();
}
