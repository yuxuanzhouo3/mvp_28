import { externalModels } from "@/constants";
import type { ExternalModel } from "@/types";

export type MediaKind = "image" | "video" | "audio";
export type ModelCategoryScope = "domestic" | "international";

function normalizeModelId(modelId?: string | null) {
  return (modelId || "").trim().toLowerCase();
}

export function getExternalModelById(modelId?: string | null): ExternalModel | null {
  const normalized = normalizeModelId(modelId);
  if (!normalized) return null;
  return (
    externalModels.find((model) => model.id.toLowerCase() === normalized) || null
  );
}

function fallbackSupportsAllForLegacyMultimodal(model: ExternalModel, kind: MediaKind) {
  const hasExplicit =
    typeof model.supportsImage === "boolean" ||
    typeof model.supportsVideo === "boolean" ||
    typeof model.supportsAudio === "boolean";
  if (hasExplicit) return false;
  return model.modality === "multimodal" && (kind === "image" || kind === "video" || kind === "audio");
}

export function supportsMediaKind(modelId: string, kind: MediaKind): boolean {
  const model = getExternalModelById(modelId);
  if (!model) return false;

  if (kind === "image") {
    return model.supportsImage === true || fallbackSupportsAllForLegacyMultimodal(model, kind);
  }
  if (kind === "video") {
    return model.supportsVideo === true || fallbackSupportsAllForLegacyMultimodal(model, kind);
  }
  return model.supportsAudio === true || fallbackSupportsAllForLegacyMultimodal(model, kind);
}

export function getRecommendedModelForMedia(
  scope: ModelCategoryScope,
  kind: MediaKind,
): ExternalModel | null {
  const candidates = externalModels.filter((model) => model.category === scope);
  const match = candidates.find((model) => supportsMediaKind(model.id, kind));
  return match || null;
}

export function getUnsupportedMediaKinds(modelId: string, requested: MediaKind[]): MediaKind[] {
  const uniqueKinds = Array.from(new Set(requested));
  return uniqueKinds.filter((kind) => !supportsMediaKind(modelId, kind));
}
