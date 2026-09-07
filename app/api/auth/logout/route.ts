import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";
import { publicAppUrl } from "@/lib/config";

export async function GET() {
  await clearSession();
  return NextResponse.redirect(`${publicAppUrl()}/`);
}
