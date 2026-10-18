"use client";
/* Who can see a post / course: public, Lexa users, a centre's students, draft.
 * Used by the studio editor (see docs/ORG_P2_SETUP.md). */
import * as React from "react";
import { Building2, Eye, Globe2, Lock, Users } from "lucide-react";
import { VISIBILITIES, previewLabel, type Visibility } from "@/lib/cloud-api/visibility";

const ICONS: Record<Visibility, React.ReactNode> = {
  public: <Globe2 className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
  org: <Building2 className="h-4 w-4" />,
  draft: <Lock className="h-4 w-4" />,
};

export function VisibilityPicker({
  kind, value, onChange, orgId, onOrgChange, orgs, allowPreview = false, onAllowPreview,
}: {
  kind: "post" | "course";
  value: Visibility;
  onChange: (v: Visibility) => void;
  orgId: string | null;
  onOrgChange: (id: string | null) => void;
  /** centres the author may publish under (usePublishOrgs) */
  orgs: { id: string; name: string }[];
  allowPreview?: boolean;
  onAllowPreview?: (v: boolean) => void;
}) {
  const orgName = orgs.find((o) => o.id === orgId)?.name ?? "";
  return (
    <fieldset className="space-y-2" dir="rtl">
      <legend className="mb-1 text-xs font-bold text-muted-foreground">چه کسانی ببینند؟</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {VISIBILITIES.map((v) => {
          const disabled = v.key === "org" && orgs.length === 0;
          return (
            <label key={v.key}
              className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${value === v.key ? "border-bronze bg-bronze/[0.06]" : "border-border"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
              <input type="radio" className="mt-1" name={`vis-${kind}`} checked={value === v.key} disabled={disabled}
                onChange={() => { onChange(v.key); if (v.key === "org" && !orgId && orgs[0]) onOrgChange(orgs[0].id); }} />
              <span>
                <span className="flex items-center gap-1 font-bold">{ICONS[v.key]} {v.label}</span>
                <span className="block text-[11px] text-muted-foreground">{disabled ? "شما مدرس فعال هیچ مرکزی نیستید." : v.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
      {(value === "org" || value === "draft") && orgs.length > 0 && (
        <label className="block space-y-1 text-xs">
          <span className="font-bold text-muted-foreground">مرکز آموزشی</span>
          <select value={orgId ?? ""} onChange={(e) => onOrgChange(e.target.value || null)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
            {value === "draft" && <option value="">بدون مرکز</option>}
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
      )}
      {kind === "course" && value === "org" && onAllowPreview && (
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input type="checkbox" className="mt-0.5" checked={allowPreview} onChange={(e) => onAllowPreview(e.target.checked)} />
          <span>
            <span className="flex items-center gap-1 font-bold text-foreground"><Eye className="h-3.5 w-3.5" /> پیش‌نمایش برای همه</span>
            کارت دوره (عنوان، توضیح و تصویر) برای همه با برچسب «{previewLabel(orgName || "مرکز")}» دیده شود؛ جلسه‌ها فقط برای دانشجویان مرکز.
          </span>
        </label>
      )}
    </fieldset>
  );
}

/** small label for cards and headers */
export function VisibilityBadge({ value, orgName }: { value: string | null | undefined; orgName?: string }) {
  if (!value || value === "public") return null;
  const text = value === "org" ? previewLabel(orgName || "مرکز") : value === "users" ? "کاربران Lexa" : "پیش‌نویس";
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-bronze/40 bg-bronze/[0.08] px-2 py-0.5 text-[10px] font-bold text-bronze">
      {value === "org" ? <Building2 className="h-3 w-3" /> : value === "users" ? <Users className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
      {text}
    </span>
  );
}
