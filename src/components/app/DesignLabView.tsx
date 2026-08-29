"use client";

/* ═══ آزمایشگاه طرح خانه — صفحهٔ موقت مقایسهٔ نمونه‌ها (نسخهٔ ۲) ═══════════════
   بازخورد کاربر: نمونه‌های قبلی بیش‌ازحد به طرح فعلی نزدیک بودند؛ این نسخه
   هشت مفهوم مستقل است — آیتم‌های تازه اضافه شده (حلقهٔ مرور، مسیر یادگیری،
   دستیار، کاشی‌های بنتو، شمارش معکوس و نمودار نتایج، ریل ادامه‌دادن، نوار
   فرمان و برنامهٔ امشب) و در چند نمونه برخی المان‌ها حذف یا به‌شدت ساده
   شده‌اند. هر نمونه هم‌زمان در هر سه تم رندر می‌شود. */

import * as React from "react";
import {
  Palette, Sparkles, Target, Route, Bot, LayoutGrid, Hourglass, Moon, Command,
} from "lucide-react";
import { ThemeScope, ThemeBadge, THEMES } from "./design-lab/shared";
import { VariantCurrent, VariantFocus, VariantPath } from "./design-lab/variants-a";
import { VariantAssistant, VariantBento, VariantExamFirst } from "./design-lab/variants-b";
import { VariantCinema, VariantCommand } from "./design-lab/variants-c";

const VARIANTS: { id: string; name: string; tagline: string; icon: React.ComponentType<{ className?: string }>; Comp: React.ComponentType }[] = [
  { id: "current", name: "۱ · طرح فعلی", tagline: "مرجع مقایسه — زمردی همیشگی + کارت‌های سفید مات", icon: Sparkles, Comp: VariantCurrent },
  { id: "focus", name: "۲ · تمرکز", tagline: "بلوک سبز حذف شد؛ حلقهٔ مرور شبانه، درس جاری و آمار درشت — ساکت و متمرکز", icon: Target, Comp: VariantFocus },
  { id: "path", name: "۳ · مسیر یادگیری", tagline: "درس‌ها روی یک مسیر: تکمیل‌شده، جاری، قفل‌شده + ایستگاه آزمون و هفتهٔ استریک", icon: Route, Comp: VariantPath },
  { id: "assistant", name: "۴ · دستیار همیار", tagline: "بریفینگ شخصی با برنامهٔ پیشنهادی امشب (مرور + تست + فلش‌کارت)", icon: Bot, Comp: VariantAssistant },
  { id: "bento", name: "۵ · بنتو", tagline: "کاشی‌کاری نامتقارن: هر عدد یک کاشی — جلسه، استریک، دفترچه‌ها، نوارهای درس‌ها", icon: LayoutGrid, Comp: VariantBento },
  { id: "exam", name: "۶ · آزمون‌محور", tagline: "شمارش معکوس آزمون جامع + نمودار نتایج آخرین آزمون‌ها — آزمون جلوتر از همه", icon: Hourglass, Comp: VariantExamFirst },
  { id: "cinema", name: "۷ · شبانهٔ سینمایی", tagline: "هیرو تمام‌صفحه مثل پوستر فیلم + ریل «امشب ادامه بده» با نوار پیشرفت هر درس", icon: Moon, Comp: VariantCinema },
  { id: "command", name: "۸ · مرکز فرمان", tagline: "نوار فرمان، چیپ‌های پیشنهاد، ردیف KPI و برنامهٔ ساعت‌بندی‌شدهٔ امشب", icon: Command, Comp: VariantCommand },
];

export function DesignLabView() {
  const [vid, setVid] = React.useState("focus");
  const v = VARIANTS.find((x) => x.id === vid) ?? VARIANTS[0];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-2 sm:px-6">
      {/* سربرگ آزمایشگاه */}
      <div className="rounded-2xl border border-dashed border-bronze/50 bg-card/70 p-4 shadow-card backdrop-blur-sm sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-card">
            <Palette className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="flex flex-wrap items-center gap-2 text-base font-extrabold text-foreground">
              آزمایشگاه طرح خانه · نسخهٔ ۲
              <span className="rounded-full bg-amber-400/95 px-2 py-0.5 text-[9.5px] font-extrabold text-amber-950">موقت</span>
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              هشت مفهوم مستقل برای بخش بزرگ خانه — این‌بار به‌جای شبیه‌سازی طرح فعلی، آیتم‌های تازه
              (حلقهٔ مرور، مسیر یادگیری، دستیار، بنتو، نمودار آزمون، ریل ادامه‌دادن، مرکز فرمان) اضافه
              و در چند طرح المان‌ها حذف یا ساده شده‌اند. هر نمونه هم‌زمان در هر سه تم رندر می‌شود.
            </p>
          </div>
        </div>

        {/* انتخاب نمونه */}
        <div className="mt-4 flex flex-wrap gap-2">
          {VARIANTS.map((x) => (
            <button
              key={x.id}
              onClick={() => setVid(x.id)}
              aria-pressed={x.id === vid}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11.5px] font-bold shadow-card ring-1 transition-all ${
                x.id === vid
                  ? "bg-primary text-primary-foreground ring-bronze/60"
                  : "bg-card text-muted-foreground ring-border hover:text-foreground"
              }`}
            >
              <x.icon className={`h-3.5 w-3.5 ${x.id === vid ? "text-bronze" : "text-bronze/70"}`} />
              {x.name}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] font-bold text-bronze">{v.tagline}</p>
      </div>

      {/* نمونهٔ انتخابی — در هر سه تم */}
      <div className="mt-6 space-y-8">
        {THEMES.map((t) => (
          <section key={t.id} className="space-y-2.5" aria-label={`نمونه در ${t.label}`}>
            <ThemeBadge theme={t.id} />
            <ThemeScope theme={t.id}>
              <v.Comp />
            </ThemeScope>
          </section>
        ))}
      </div>

      <p className="mt-7 text-center text-[11px] leading-relaxed text-muted-foreground">
        شمارهٔ طرحی که پسندیدی را بگو (مثلاً «طرح ۳») تا با همان هویت در صفحهٔ خانه پیاده شود؛
        ترکیب بخش‌هایی از چند طرح هم ممکن است.
      </p>
    </div>
  );
}
