"use client";

import { useState } from "react";
import { AppPage } from "@/components/app-page";
import { useI18n } from "@/lib/i18n";

type FaqItem = { q: string; a: string };

export default function HelpPage() {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(0);

  const faqs: FaqItem[] = [
    { q: t("help.faq1q"), a: t("help.faq1a") },
    { q: t("help.faq2q"), a: t("help.faq2a") },
    { q: t("help.faq3q"), a: t("help.faq3a") },
    { q: t("help.faq4q"), a: t("help.faq4a") },
    { q: t("help.faq5q"), a: t("help.faq5a") },
    { q: t("help.faq6q"), a: t("help.faq6a") },
  ];

  return (
    <AppPage
      width="full"
      title={t("help.title")}
      lead={t("help.lead")}
      data-testid="help-page"
    >
      <div className="grid w-full gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border border-border bg-elevated/80 p-5 text-left shadow-card backdrop-blur-xl sm:p-6">
          <h2 className="text-sm font-semibold text-foreground">
            {t("help.quickTitle")}
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            <li className="rounded-xl border border-border/80 bg-elevated-muted/50 px-3.5 py-3">
              {t("help.tip1")}
            </li>
            <li className="rounded-xl border border-border/80 bg-elevated-muted/50 px-3.5 py-3">
              {t("help.tip2")}
            </li>
            <li className="rounded-xl border border-border/80 bg-elevated-muted/50 px-3.5 py-3">
              {t("help.tip3")}
            </li>
          </ul>
        </div>

        <div
          className="overflow-hidden rounded-2xl border border-border bg-elevated/80 shadow-card backdrop-blur-xl"
          data-testid="help-faq"
        >
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <h2 className="text-left text-sm font-semibold text-foreground">
              {t("help.faqTitle")}
            </h2>
          </div>
          <ul>
            {faqs.map((item, i) => {
              const isOpen = open === i;
              return (
                <li key={item.q} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left transition hover:bg-elevated-muted/40 sm:px-6"
                  >
                    <span className="text-sm font-semibold text-foreground">
                      {item.q}
                    </span>
                    <span
                      className={`mt-0.5 shrink-0 text-lg leading-none text-muted transition ${
                        isOpen ? "rotate-45" : ""
                      }`}
                      aria-hidden
                    >
                      +
                    </span>
                  </button>
                  {isOpen ? (
                    <p className="px-5 pb-4 text-left text-sm leading-relaxed text-muted sm:px-6">
                      {item.a}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </AppPage>
  );
}
