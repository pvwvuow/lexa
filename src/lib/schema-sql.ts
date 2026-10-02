// --- اسکیمای دیتابیس — تولیدشده از prisma/schema.prisma -----------------
// این DDL برای «خودترمیمی» سرورهای نصب‌شده است: اگر فایل دیتابیس کاربر خالی
// یا بدون جدول باشد (سناریوهای آپدیت قدیمی/کپی ناموفق قالب)، سرور خودش جدول‌ها
// را می‌سازد تا ثبت‌نام/ورود/سینک از همان اجرا کار کند.
// ⚠️ بعد از هر تغییر schema.prisma دوباره تولیدش کنید:
//   bunx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
//   (سپس CREATEها را IF NOT EXISTS دار کنید)

export const SCHEMA_SQL = `
-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "displayName" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LessonFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "chapterTitle" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "lessonTitle" TEXT NOT NULL,
    "conversation" JSONB NOT NULL,
    "matchPercent" INTEGER NOT NULL DEFAULT 0,
    "needsChange" BOOLEAN NOT NULL DEFAULT false,
    "severity" TEXT NOT NULL DEFAULT 'minor',
    "analysis" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LessonFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LessonState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sectionsSeen" INTEGER NOT NULL DEFAULT 1,
    "quizBest" INTEGER,
    "markedReview" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LessonState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "QuizAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ActivityDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    CONSTRAINT "ActivityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "quote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserBlob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "customCoursesJson" TEXT NOT NULL DEFAULT '[]',
    "lastLocationJson" TEXT NOT NULL DEFAULT '{}',
    "streakJson" TEXT NOT NULL DEFAULT '{}',
    "marksJson" TEXT NOT NULL DEFAULT '{}',
    "builtinSeeded" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserBlob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "categories" TEXT NOT NULL DEFAULT '[]',
    "thumbnail" TEXT NOT NULL DEFAULT '',
    "quizJson" TEXT NOT NULL DEFAULT '[]',
    "blocks" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "replyToId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Follow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Follow_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Follow_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TeacherCourse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT '',
    "accent" TEXT NOT NULL DEFAULT 'bronze',
    "category" TEXT NOT NULL DEFAULT 'other',
    "categories" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'published',
    "thumbnail" TEXT NOT NULL DEFAULT '',
    "chaptersJson" TEXT NOT NULL DEFAULT '[]',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeacherCourse_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LibraryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LibraryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LibraryEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TeacherCourse" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BuiltinHidden" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BuiltinHidden_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Rating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LessonFeedback_userId_idx" ON "LessonFeedback"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LessonFeedback_status_idx" ON "LessonFeedback"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LessonFeedback_lessonId_idx" ON "LessonFeedback"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LessonState_lessonId_idx" ON "LessonState"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LessonState_userId_lessonId_key" ON "LessonState"("userId", "lessonId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuizAttempt_userId_createdAt_idx" ON "QuizAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuizAttempt_lessonId_idx" ON "QuizAttempt"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ActivityDay_userId_day_key" ON "ActivityDay"("userId", "day");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Note_userId_lessonId_idx" ON "Note"("userId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Note_userId_id_key" ON "Note"("userId", "id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserBlob_userId_key" ON "UserBlob"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Post_authorId_idx" ON "Post"("authorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Comment_postId_idx" ON "Comment"("postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Follow_teacherId_idx" ON "Follow"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Follow_studentId_teacherId_key" ON "Follow"("studentId", "teacherId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeacherCourse_teacherId_idx" ON "TeacherCourse"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LibraryEntry_userId_courseId_key" ON "LibraryEntry"("userId", "courseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BuiltinHidden_userId_idx" ON "BuiltinHidden"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BuiltinHidden_userId_courseId_key" ON "BuiltinHidden"("userId", "courseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Rating_targetType_targetId_idx" ON "Rating"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Rating_userId_targetType_targetId_key" ON "Rating"("userId", "targetType", "targetId");`;

/** جدول‌های انتظارشده — برای تشخیص سریع دیتابیس بی‌جدول */
export const SCHEMA_TABLES = [
  "User",
  "LessonFeedback",
  "Session",
  "LessonState",
  "QuizAttempt",
  "ActivityDay",
  "Note",
  "UserBlob",
  "Post",
  "Comment",
  "Follow",
  "TeacherCourse",
  "LibraryEntry",
  "BuiltinHidden",
  "Rating",
];
