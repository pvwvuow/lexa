#!/usr/bin/env python3
# تولید src/lib/schema-sql.ts از scripts/schema-generated.sql
# (DDL با IF NOT EXISTS برای خودترمیمی سرور)
import re

sql = open("scripts/schema-generated.sql").read()
sql = re.sub(r"CREATE TABLE (?!IF NOT EXISTS)", "CREATE TABLE IF NOT EXISTS ", sql)
sql = re.sub(r"CREATE UNIQUE INDEX (?!IF NOT EXISTS)", "CREATE UNIQUE INDEX IF NOT EXISTS ", sql)
sql = re.sub(r"CREATE INDEX (?!IF NOT EXISTS)", "CREATE INDEX IF NOT EXISTS ", sql)

body = sql.replace("`", "\\`").strip()
tables = re.findall(r'CREATE TABLE IF NOT EXISTS "(\w+)"', sql)
tables_js = ",\n".join(f'  "{m}"' for m in tables)

header = (
    "// --- اسکیمای دیتابیس — تولیدشده از prisma/schema.prisma -----------------\n"
    "// این DDL برای «خودترمیمی» سرورهای نصب‌شده است: اگر فایل دیتابیس کاربر خالی\n"
    "// یا بدون جدول باشد (سناریوهای آپدیت قدیمی/کپی ناموفق قالب)، سرور خودش جدول‌ها\n"
    "// را می‌سازد تا ثبت‌نام/ورود/سینک از همان اجرا کار کند.\n"
    "// ⚠️ بعد از هر تغییر schema.prisma دوباره تولیدش کنید:\n"
    "//   bunx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script\n"
    "//   (سپس CREATEها را IF NOT EXISTS دار کنید)\n\n"
)

ts = (
    header
    + "export const SCHEMA_SQL = `\n"
    + body
    + "`;\n\n"
    + "/** جدول‌های انتظارشده — برای تشخیص سریع دیتابیس بی‌جدول */\n"
    + "export const SCHEMA_TABLES = [\n"
    + tables_js
    + ",\n];\n"
)

open("src/lib/schema-sql.ts", "w").write(ts)
print("written:", len(ts), "chars,", len(tables), "tables")
