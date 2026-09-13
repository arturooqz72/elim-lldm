import type { RoomServiceClient } from "livekit-server-sdk";
import type { StageLayout } from "@/types";

export interface LowerThirdState {
  visible: boolean;
  title: string;
  subtitle: string;
}

export interface RoomMetadata {
  layout?: StageLayout;
  lowerThird?: LowerThirdState;
}

export function parseRoomMetadata(raw: string | undefined): RoomMetadata {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as RoomMetadata;
  } catch {
    return {};
  }
}

// Los metadatos de la sala de LiveKit son un único blob de texto — el
// selector de layout y el banner de marca escriben cada uno su propia
// parte, así que hay que leer el valor actual antes de sobreescribir
// para no borrar lo que el otro puso.
export async function patchRoomMetadata(
  roomService: RoomServiceClient,
  roomName: string,
  patch: Partial<RoomMetadata>
): Promise<void> {
  const [room] = await roomService.listRooms([roomName]);
  const current = parseRoomMetadata(room?.metadata);
  await roomService.updateRoomMetadata(roomName, JSON.stringify({ ...current, ...patch }));
}
