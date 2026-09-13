// Metadata del participante en LiveKit: cuando la cámara está apagada,
// se puede mostrar una imagen personalizada en vez del placeholder por
// defecto. Compartido entre StageTile (la muestra) y StudioControlBar
// (la sube/quita).

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const DEFAULT_CAMERA_OFF_IMAGE = "/icons/icon-512.png";

export interface CameraOffMetadata {
  cameraOffImageUrl?: string;
}

export function parseCameraOffImage(metadata: string | undefined): string | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as CameraOffMetadata;
    return parsed.cameraOffImageUrl ?? null;
  } catch {
    return null;
  }
}
