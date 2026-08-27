import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { validateUsername, validatePassword } from "@/lib/auth-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ایجاد حساب استاد — فقط مدیر */
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });
  if (me.role !== "admin")
    return NextResponse.json({ error: "دسترسی ویژهٔ مدیر است." }, { status: 403 });

  let body: { username?: string; password?: string; displayName?: string; bio?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  const errU = validateUsername(username);
  if (errU) return NextResponse.json({ error: errU }, { status: 400 });
  const errP = validatePassword(password);
  if (errP) return NextResponse.json({ error: errP }, { status: 400 });

  const exists = await db.user.findUnique({ where: { username } });
  if (exists) return NextResponse.json({ error: "این نام کاربری قبلاً ثبت شده است." }, { status: 409 });

  const t = await db.user.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      role: "teacher",
      displayName: (body.displayName ?? "").trim().slice(0, 60) || null,
      bio: (body.bio ?? "").trim().slice(0, 400) || null,
    },
  });

  return NextResponse.json({
    ok: true,
    teacher: {
      id: t.id,
      username: t.username,
      displayName: t.displayName,
      bio: t.bio,
      createdAt: t.createdAt.toISOString(),
    },
  });
}

/** فهرست اساتید با آمار — فقط مدیر */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });
  if (me.role !== "admin")
    return NextResponse.json({ error: "دسترسی ویژهٔ مدیر است." }, { status: 403 });

  const teachers = await db.user.findMany({
    where: { role: "teacher" },
    select: {
      id: true, username: true, displayName: true, bio: true,
      createdAt: true, lastSeenAt: true,
      _count: { select: { posts: true, teacherCourses: true, followers: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    teachers: teachers.map((t) => ({
      id: t.id,
      username: t.username,
      displayName: t.displayName,
      bio: t.bio,
      createdAt: t.createdAt.toISOString(),
      lastSeenAt: t.lastSeenAt?.toISOString() ?? null,
      posts: t._count.posts,
      courses: t._count.teacherCourses,
      followers: t._count.followers,
    })),
  });
}
