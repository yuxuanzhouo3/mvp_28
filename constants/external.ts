import type { ExternalModel } from "../types";

export interface ExternalApi {
  id: string;
  name: string;
  description: string;
  icon: string;
  models: number;
}

// DashScope 兼容模式下，国内版统一视为 Qwen 通道，通过传递不同的模型名称完成切换
export const externalAPIs: ExternalApi[] = [
  {
    id: "qwen",
    name: "Qwen",
    description: "阿里通义系列大模型（含 DeepSeek/Kimi/GLM 接入）",
    icon: "??",
    models: 12,
  },
  {
    id: "mistral",
    name: "Mistral",
    description: "Mistral / Codestral 系列",
    icon: "???",
    models: 4,
  },
];

export const externalModels: ExternalModel[] = [
  // Domestic (zh) models — DashScope 统一调用
  { id: "qwen3-max", name: "Qwen3-Max", provider: "Qwen", description: "通义千问旗舰模型", category: "domestic", type: "paid", price: "N/A" },
  { id: "qwen-plus", name: "Qwen-Plus", provider: "Qwen", description: "高性价比通用模型", category: "domestic", type: "paid", price: "N/A" },
  { id: "qwen-turbo", name: "Qwen-Turbo", provider: "Qwen", description: "快速响应版本", category: "domestic", type: "paid", price: "N/A" },
  { id: "qwen-flash", name: "Qwen-Flash", provider: "Qwen", description: "轻量极速模型", category: "domestic", type: "paid", price: "N/A" },
  { id: "qwen3-coder-plus", name: "Qwen3-Coder-Plus", provider: "Qwen", description: "代码增强版本", category: "domestic", type: "paid", price: "N/A" },
  { id: "qwen3-coder-flash", name: "Qwen3-Coder-Flash", provider: "Qwen", description: "极速代码模型", category: "domestic", type: "paid", price: "N/A" },
  { id: "deepseek-r1", name: "DeepSeek-R1", provider: "DeepSeek", description: "深度推理模型 R1", category: "domestic", type: "paid", price: "N/A" },
  { id: "deepseek-v3", name: "DeepSeek-V3", provider: "DeepSeek", description: "第三代通用模型", category: "domestic", type: "paid", price: "N/A" },
  { id: "deepseek-v3.1", name: "DeepSeek-V3.1", provider: "DeepSeek", description: "V3.1 增强版", category: "domestic", type: "paid", price: "N/A" },
  { id: "deepseek-v3.2-exp", name: "DeepSeek-V3.2-Exp", provider: "DeepSeek", description: "V3.2 实验版", category: "domestic", type: "paid", price: "N/A" },
  { id: "Moonshot-Kimi-K2-Instruct", name: "Moonshot-Kimi-K2-Instruct", provider: "Kimi", description: "Kimi 文本增强模型", category: "domestic", type: "paid", price: "N/A" },
  { id: "glm-4.6", name: "GLM-4.6", provider: "GLM", description: "智谱 GLM 4.6", category: "domestic", type: "paid", price: "N/A" },

  // International (en) models
  { id: "codestral-latest", name: "Codestral-latest", provider: "Mistral", description: "Latest Codestral coding model", category: "international", type: "paid", price: "N/A" },
  { id: "codestral-2412", name: "Codestral-2412", provider: "Mistral", description: "Codestral 2412 release", category: "international", type: "paid", price: "N/A" },
  { id: "mistral-small-latest", name: "Mistral-small-latest", provider: "Mistral", description: "Small latest Mistral model", category: "international", type: "paid", price: "N/A" },
  { id: "mistral-medium-latest", name: "Mistral-medium-latest", provider: "Mistral", description: "Medium latest Mistral model", category: "international", type: "paid", price: "N/A" },
];
