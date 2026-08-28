"use client";

// ثبت سرویس‌ورکر + پرچم آفلاین سراسری — بدون رندر بصری
import * as React from "react";
import { useServiceWorkerRegistration } from "@/lib/offline";

export function SwRegister() {
  useServiceWorkerRegistration();
  return null;
}
