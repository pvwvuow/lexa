/** پاک‌سازی حساب تستی qa_audit28 + دورهٔ تستی ممیزی — به‌ترتیب وابستگی‌ها */
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const u = await p.user.findUnique({ where: { username: "qa_audit28" } });
  if (!u) {
    console.log("qa_audit28 not found — nothing to clean");
    return;
  }
  const uid = u.id;
  const courses = await p.teacherCourse.findMany({ where: { teacherId: uid }, select: { id: true } });
  for (const c of courses) {
    await p.libraryEntry.deleteMany({ where: { courseId: c.id } });
    await p.rating.deleteMany({ where: { targetType: "tcourse", targetId: c.id } });
    await p.teacherCourse.delete({ where: { id: c.id } });
  }
  const posts = await p.post.findMany({ where: { authorId: uid }, select: { id: true } });
  for (const po of posts) {
    await p.comment.deleteMany({ where: { postId: po.id } });
    await p.rating.deleteMany({ where: { targetType: "post", targetId: po.id } });
    await p.post.delete({ where: { id: po.id } });
  }
  await p.comment.deleteMany({ where: { userId: uid } });
  await p.follow.deleteMany({ where: { OR: [{ studentId: uid }, { teacherId: uid }] } });
  await p.rating.deleteMany({ where: { userId: uid } });
  await p.libraryEntry.deleteMany({ where: { userId: uid } });
  await p.lessonFeedback.deleteMany({ where: { userId: uid } }).catch(() => {});
  await p.lessonState.deleteMany({ where: { userId: uid } }).catch(() => {});
  await p.builtinHidden.deleteMany({ where: { userId: uid } });
  await p.quizAttempt.deleteMany({ where: { userId: uid } });
  await p.activityDay.deleteMany({ where: { userId: uid } });
  await p.note.deleteMany({ where: { userId: uid } });
  await p.userBlob.deleteMany({ where: { userId: uid } });
  await p.session.deleteMany({ where: { userId: uid } }).catch(() => {});
  await p.user.delete({ where: { id: uid } });
  console.log("cleaned: qa_audit28 + deps, courses:", courses.map((c) => c.id).join(",") || "none");

  // verify
  const gone = await p.user.findUnique({ where: { username: "qa_audit28" } });
  console.log("verify user gone:", gone === null);
  const real = await p.user.findMany({ where: { role: "teacher" }, select: { username: true } });
  console.log("remaining teachers:", real.map((r) => r.username).join(","));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
