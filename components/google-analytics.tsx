"use client";

import Script from "next/script";
import { useSyncExternalStore } from "react";

export const COOKIE_NOTICE_STORAGE_KEY = "findelio_cookie_notice_v2";
export const ANALYTICS_CONSENT_STORAGE_KEY = "findelio_analytics_consent_v1";
export const CONSENT_EVENT = "findelio-consent-change";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CONSENT_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CONSENT_EVENT, onStoreChange);
  };
}

function getSnapshot() {
  try {
    return window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) === "granted";
  } catch {
    return false;
  }
}

function getServerSnapshot() {
  return false;
}

export function setAnalyticsConsent(value: "granted" | "denied") {
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, value);
  } catch {
    // Consent remains effective for the current page view through the event.
  }

  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export default function GoogleAnalytics() {
  const hasConsent = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if (!hasConsent) return null;

  return (
    <>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-S9DSK103GX"
        strategy="afterInteractive"
      />
      <Script id="findelio-google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-S9DSK103GX', {
            anonymize_ip: true,
            allow_google_signals: false,
            allow_ad_personalization_signals: false
          });
        `}
      </Script>
    </>
  );
}
