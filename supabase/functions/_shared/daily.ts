const DEFAULT_DAILY_API_BASE = "https://api.daily.co/v1";
const DEFAULT_ROOM_TTL_SECONDS = 6 * 60 * 60;
const DEFAULT_TOKEN_TTL_SECONDS = 15 * 60;

interface DailyRoomResponse {
  config?: {
    exp?: number;
  };
  name: string;
  url: string;
}

interface CreateDailyRoomParams {
  roomName?: string;
}

interface CreateMeetingTokenParams {
  callType: "audio" | "video";
  roomName: string;
  userId: string;
  userName: string;
}

const encoder = new TextEncoder();

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function requireDailyApiKey(): string {
  const apiKey = Deno.env.get("DAILY_API_KEY") ?? Deno.env.get("DAILY_CO_API_KEY");
  if (!apiKey) {
    throw new Error("DAILY_API_KEY or DAILY_CO_API_KEY is not configured");
  }

  return apiKey;
}

function getDailyApiBase(): string {
  return (Deno.env.get("DAILY_API_BASE") ?? DEFAULT_DAILY_API_BASE).replace(/\/+$/, "");
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeBase64Secret(secret: string): Uint8Array {
  const binary = atob(secret);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacSha256(secretBytes: Uint8Array, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return new Uint8Array(signature);
}

function normalizeHeaderSignature(signature: string): string[] {
  const trimmed = signature.trim();
  const withoutPrefix = trimmed.replace(/^sha256=/i, "");

  return [trimmed, withoutPrefix].filter(Boolean);
}

export function generateDailyRoomName(): string {
  return `coparrent-call-${crypto.randomUUID().replace(/-/g, "")}`;
}

async function dailyRequest<T>(path: string, init: RequestInit): Promise<T> {
  const apiKey = requireDailyApiKey();
  const response = await fetch(`${getDailyApiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const responseText = await response.text();
  const responseBody = responseText ? JSON.parse(responseText) : null;

  if (!response.ok) {
    throw new Error(`Daily API request failed (${response.status}): ${responseText}`);
  }

  return responseBody as T;
}

export async function createDailyRoom(
  params: CreateDailyRoomParams = {},
): Promise<{ exp: number; name: string; url: string }> {
  const roomName = params.roomName ?? generateDailyRoomName();
  const exp = Math.floor(Date.now() / 1000) + DEFAULT_ROOM_TTL_SECONDS;

  const room = await dailyRequest<DailyRoomResponse>("/rooms", {
    method: "POST",
    body: JSON.stringify({
      name: roomName,
      privacy: "private",
      properties: {
        exp,
        max_participants: 2,
      },
    }),
  });

  return {
    exp: room.config?.exp ?? exp,
    name: room.name,
    url: room.url,
  };
}

export async function createDailyMeetingToken(
  params: CreateMeetingTokenParams,
): Promise<{ token: string; tokenExp: number }> {
  const tokenExp = Math.floor(Date.now() / 1000) + DEFAULT_TOKEN_TTL_SECONDS;

  const response = await dailyRequest<{ token: string }>("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        room_name: params.roomName,
        exp: tokenExp,
        user_id: params.userId,
        user_name: params.userName,
        enable_screenshare: false,
        start_audio_off: false,
        start_video_off: params.callType === "audio",
      },
    }),
  });

  return {
    token: response.token,
    tokenExp,
  };
}

export async function deleteDailyRoom(roomName: string): Promise<void> {
  await dailyRequest(`/rooms/${encodeURIComponent(roomName)}`, {
    method: "DELETE",
  });
}

export function getDailyDomain(): string {
  return requireEnv("DAILY_DOMAIN").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

export async function verifyDailyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
): Promise<boolean> {
  const secret = Deno.env.get("DAILY_WEBHOOK_SECRET");

  if (!secret) {
    return false;
  }

  if (!signatureHeader) {
    return false;
  }

  const signatureCandidates = normalizeHeaderSignature(signatureHeader);
  const secretBytes = decodeBase64Secret(secret);

  const payloadCandidates = [rawBody];
  if (timestampHeader) {
    payloadCandidates.push(`${timestampHeader}.${rawBody}`);
  }

  for (const payload of payloadCandidates) {
    const digest = await hmacSha256(secretBytes, payload);
    const hex = bytesToHex(digest);
    const base64 = bytesToBase64(digest);

    const validCandidates = new Set([
      hex,
      base64,
      `sha256=${hex}`,
      `sha256=${base64}`,
    ]);

    if (signatureCandidates.some((candidate) => validCandidates.has(candidate))) {
      return true;
    }
  }

  return false;
}
