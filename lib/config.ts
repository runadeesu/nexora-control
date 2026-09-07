export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function publicAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export const DISCORD_API = "https://discord.com/api/v10";

// No Administrator permission. Includes only the permissions NEXORA Control needs
// to manage channels/server settings/roles and create the non-admin staff roles.
export const BOT_PERMISSION_BITS = "1099783334967";
