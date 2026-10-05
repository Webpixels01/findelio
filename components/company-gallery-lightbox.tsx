"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type GalleryImage = {
  id: string;
  url: string;
  alt: string;
  openLabel: string;
};

type CompanyGalleryLightboxProps = {
  images: GalleryImage[];
  labels: {
    dialog: string;
    close: string;
    previous: string;
    next: string;
  };
};

export default function CompanyGalleryLightbox({
  images,
  labels,
}: CompanyGalleryLightboxProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const hasMultipleImages = images.length > 1;

  const close = useCallback(() => {
    setActiveIndex((currentIndex) => {
      if (currentIndex !== null) {
        window.requestAnimationFrame(() => {
          triggerRefs.current[currentIndex]?.focus();
        });
      }

      return null;
    });
  }, []);

  const showPrevious = useCallback(() => {
    setActiveIndex((currentIndex) =>
      currentIndex === null
        ? null
        : (currentIndex - 1 + images.length) % images.length,
    );
  }, [images.length]);

  const showNext = useCallback(() => {
    setActiveIndex((currentIndex) =>
      currentIndex === null ? null : (currentIndex + 1) % images.length,
    );
  }, [images.length]);

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      } else if (event.key === "ArrowLeft" && hasMultipleImages) {
        showPrevious();
      } else if (event.key === "ArrowRight" && hasMultipleImages) {
        showNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    activeIndex,
    close,
    hasMultipleImages,
    showNext,
    showPrevious,
  ]);

  const activeImage =
    activeIndex === null ? null : images[activeIndex] ?? null;

  return (
    <>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {images.map((image, index) => (
          <button
            key={image.id}
            ref={(element) => {
              triggerRefs.current[index] = element;
            }}
            type="button"
            aria-label={image.openLabel}
            onClick={() => setActiveIndex(index)}
            className="group relative aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent)]/30"
          >
            <Image
              src={image.url}
              alt={image.alt}
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-cover transition duration-300 group-hover:scale-[1.03]"
            />
            <span
              aria-hidden="true"
              className="absolute right-3 bottom-3 grid size-10 place-items-center rounded-full bg-slate-950/75 text-white opacity-0 shadow-lg backdrop-blur-sm transition group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5M11 8v6M8 11h6" />
              </svg>
            </span>
          </button>
        ))}
      </div>

      {activeImage &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={labels.dialog}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 p-4 sm:p-8"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                close();
              }
            }}
          >
            <div className="relative flex h-full w-full max-w-7xl items-center justify-center">
              <div className="relative h-[calc(100%-5rem)] w-full">
                <Image
                  key={activeImage.id}
                  src={activeImage.url}
                  alt={activeImage.alt}
                  fill
                  priority
                  sizes="100vw"
                  className="object-contain"
                />
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                aria-label={labels.close}
                onClick={close}
                className="absolute top-0 right-0 grid size-12 cursor-pointer place-items-center rounded-full bg-white/95 text-slate-950 shadow-xl transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>

              {hasMultipleImages && (
                <>
                  <button
                    type="button"
                    aria-label={labels.previous}
                    onClick={showPrevious}
                    className="absolute left-0 grid size-12 cursor-pointer place-items-center rounded-full bg-white/95 text-slate-950 shadow-xl transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400 sm:left-2"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="size-7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    aria-label={labels.next}
                    onClick={showNext}
                    className="absolute right-0 grid size-12 cursor-pointer place-items-center rounded-full bg-white/95 text-slate-950 shadow-xl transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400 sm:right-2"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="size-7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                </>
              )}

              <p
                aria-live="polite"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-4 py-2 text-sm font-bold text-white backdrop-blur-sm"
              >
                {(activeIndex ?? 0) + 1} / {images.length}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
