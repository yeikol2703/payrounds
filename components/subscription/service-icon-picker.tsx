"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useI18n } from "@/lib/i18n";
import {
  DEFAULT_ICON_KEY,
  SERVICE_ICON_CATALOG,
  detectServiceIconKey,
  resolveServiceIconKey,
  simpleIconsCdnUrl,
} from "@/lib/service-icons";
import { ServiceIcon } from "@/components/subscription/service-icon";

type ServiceIconPickerProps = {
  name: string;
  /** Stored value: slug, "default", or null/"auto" for auto-detect. */
  value: string | null;
  onChange: (next: string | null) => void;
  /** Controlled open state (e.g. title icon on detail page). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the preview row and only render the panel (when trigger is elsewhere). */
  panelOnly?: boolean;
  size?: "sm" | "md" | "lg";
  /** External trigger (e.g. title icon) — clicks here do not count as outside. */
  anchorRef?: RefObject<HTMLElement | null>;
};

export function ServiceIconPicker({
  name,
  value,
  onChange,
  open: openProp,
  onOpenChange,
  panelOnly = false,
  size = "lg",
  anchorRef,
}: ServiceIconPickerProps) {
  const { t } = useI18n();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (openProp === undefined) {
      setUncontrolledOpen(next);
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    function close() {
      onOpenChange?.(false);
      if (openProp === undefined) {
        setUncontrolledOpen(false);
      }
      setQuery("");
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (rootRef.current?.contains(target)) {
        return;
      }
      if (anchorRef?.current?.contains(target)) {
        return;
      }
      close();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, anchorRef, onOpenChange, openProp]);

  const effective = resolveServiceIconKey(value, name);
  const isAuto = value == null || value === "auto";
  const detected = detectServiceIconKey(name);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return SERVICE_ICON_CATALOG;
    }
    return SERVICE_ICON_CATALOG.filter(
      (c) =>
        c.label.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
    );
  }, [query]);

  function select(next: string | null) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  const panel = open ? (
    <div
      className="pr-card-muted space-y-3 p-3"
      data-testid="service-icon-panel"
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="service-icon-auto"
          onClick={() => select(null)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            isAuto
              ? "bg-accent text-accent-foreground"
              : "bg-elevated/70 text-muted hover:text-foreground"
          }`}
        >
          {t("icon.auto")}
          {name.trim()
            ? ` · ${detected === DEFAULT_ICON_KEY ? t("icon.default") : detected}`
            : ""}
        </button>
        <button
          type="button"
          data-testid="service-icon-default"
          onClick={() => select(DEFAULT_ICON_KEY)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            value === DEFAULT_ICON_KEY
              ? "bg-accent text-accent-foreground"
              : "bg-elevated/70 text-muted hover:text-foreground"
          }`}
        >
          {t("icon.default")}
        </button>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("icon.search")}
        className="pr-input"
        data-testid="service-icon-search"
      />

      <div className="grid max-h-52 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
        {filtered.map((c) => {
          const selected = value === c.slug;
          return (
            <button
              key={c.slug}
              type="button"
              title={c.label}
              data-testid={`service-icon-option-${c.slug}`}
              onClick={() => select(c.slug)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 transition ${
                selected
                  ? "border-accent bg-accent-muted ring-1 ring-accent/40"
                  : "border-border/60 bg-elevated/40 hover:border-border-strong"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={simpleIconsCdnUrl(c.slug)}
                alt=""
                width={22}
                height={22}
                className="h-5 w-5 object-contain opacity-90"
                loading="lazy"
              />
              <span className="line-clamp-1 w-full text-center text-[10px] font-medium text-muted">
                {c.label}
              </span>
            </button>
          );
        })}
      </div>
      {filtered.length === 0 ? (
        <p className="text-center text-xs text-muted">{t("icon.noResults")}</p>
      ) : null}
    </div>
  ) : null;

  if (panelOnly) {
    return open ? (
      <div
        ref={rootRef}
        className="space-y-3"
        data-testid="service-icon-picker"
      >
        {panel}
      </div>
    ) : null;
  }

  return (
    <div
      ref={rootRef}
      className="space-y-3"
      data-testid="service-icon-picker"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          data-testid="service-icon-change"
          aria-expanded={open}
          aria-label={t("icon.change")}
          title={t("icon.clickToChange")}
          onClick={() => setOpen(!open)}
          className={`shrink-0 rounded-2xl transition ring-offset-2 ring-offset-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            open ? "ring-2 ring-accent/50" : "hover:brightness-110 active:scale-95"
          }`}
        >
          <ServiceIcon name={name || "?"} iconKey={value} size={size} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground">
            {t("icon.title")}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {open
              ? t("icon.pickHint")
              : isAuto
                ? t("icon.autoHint", {
                    detected:
                      effective === DEFAULT_ICON_KEY
                        ? t("icon.default")
                        : effective,
                  })
                : value === DEFAULT_ICON_KEY
                  ? t("icon.usingDefault")
                  : t("icon.usingCustom", { slug: value ?? "" })}
          </p>
          <p className="mt-1 text-[11px] font-medium text-accent">
            {t("icon.clickToChange")}
          </p>
        </div>
      </div>

      {panel}
    </div>
  );
}
