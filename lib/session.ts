import crypto from "node:crypto";
import { cookies } from "next/headers";
import { env } from "./config";

export type SessionData = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};

const COOKIE_NAME = "nexora_discord_session";

function key() {
  return crypto.createHash("sha256").update(env("SESSION_SECRET")).digest();
}

export function sealSession(data: SessionData): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function unsealSession(value: string): SessionData | null {
  try {
    const raw = Buffer.from(value, "base64url");
    if (raw.length < 29) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8")) as SessionData;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionData | null> {
  const jar = await cookies();
  const value = jar.get(COOKIE_NAME)?.value;
  if (!value) return null;
  const session = unsealSession(value);
  if (!session || session.expiresAt <= Date.now()) return null;
  return session;
}

export async function setSession(data: SessionData) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, sealSession(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(60, Math.floor((data.expiresAt - Date.now()) / 1000)),
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}
