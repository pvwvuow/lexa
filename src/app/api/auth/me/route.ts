import { NextResponse } from "next/server";
import { ensureAdmin, getSessionUser, toPublic } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureAdmin();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: toPublic(user) });
}
