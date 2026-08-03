import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";

const imageSize = { width: 1200, height: 630 };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    return new Response("Not found", { status: 404 });
  }

  const t = await getTranslations({ locale, namespace: "Metadata" });

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#f4f8fc",
          color: "#001734",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          padding: "70px",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "white",
            border: "2px solid #dce6f0",
            borderRadius: "44px",
            boxShadow: "0 28px 80px rgba(0, 23, 52, 0.10)",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            justifyContent: "center",
            padding: "72px 90px",
            textAlign: "center",
            width: "100%",
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              fontSize: 82,
              fontWeight: 800,
              letterSpacing: "-3px",
            }}
          >
            <span>Findel</span>
            <span style={{ color: "#0277ee" }}>io</span>
          </div>
          <div
            style={{
              background: "#0277ee",
              borderRadius: "999px",
              height: "8px",
              marginTop: "24px",
              width: "96px",
            }}
          />
          <div
            style={{
              color: "#52657b",
              display: "flex",
              fontSize: 38,
              fontWeight: 600,
              lineHeight: 1.25,
              marginTop: "32px",
              maxWidth: "820px",
            }}
          >
            {t("title")}
          </div>
        </div>
      </div>
    ),
    imageSize,
  );
}
