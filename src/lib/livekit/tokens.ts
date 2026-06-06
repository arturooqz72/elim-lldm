import { AccessToken, type VideoGrant } from "livekit-server-sdk";

export type ParticipantRole = "viewer" | "speaker" | "host";

interface GenerateTokenOptions {
  roomName: string;
  participantIdentity: string;
  participantName: string;
  role: ParticipantRole;
}

export async function generateLiveKitToken({
  roomName,
  participantIdentity,
  participantName,
  role,
}: GenerateTokenOptions): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;

  const grants: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: role === "speaker" || role === "host",
    canSubscribe: true,
    canPublishData: role === "host",
    roomAdmin: role === "host",
  };

  const token = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    name: participantName,
    ttl: "4h",
  });

  token.addGrant(grants);
  return await token.toJwt();
}

export async function generateRelayBotToken(roomName: string): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;

  const token = new AccessToken(apiKey, apiSecret, {
    identity: "radio-relay-bot",
    name: "Radio Bot",
    ttl: "12h",
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: false,
    canSubscribe: true,
  });

  return await token.toJwt();
}
