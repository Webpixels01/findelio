"use client";

import { useLayoutEffect } from "react";
import { restoreTheme } from "@/lib/theme";

export default function ThemeSync({ locale }: { locale: string }) {
  // Locale navigation can replace the html attributes without rerunning the
  // initial head script. Restore the preference before the browser paints.
  useLayoutEffect(() => { restoreTheme(); }, [locale]);
  return null;
}
