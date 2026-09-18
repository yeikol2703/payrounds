/**
 * Service brand icons via Simple Icons (CC0) CDN, with favicon fallback
 * for a few brands missing from the pack (e.g. Disney+).
 * @see https://simpleicons.org
 * @see https://cdn.simpleicons.org
 */

export const DEFAULT_ICON_KEY = "default";

/** Colored Simple Icons CDN (brand fill / white for glass tiles). */
const SIMPLE_ICONS_CDN = "https://cdn.simpleicons.org";

/** Brands not in Simple Icons — use open favicon endpoint instead. */
const FAVICON_DOMAINS: Readonly<Record<string, string>> = {
  disneyplus: "disneyplus.com",
  peacock: "peacocktv.com",
};

/**
 * Curated catalog shown in the picker (slug → display label).
 * Slugs should match Simple Icons, or {@link FAVICON_DOMAINS}.
 */
export const SERVICE_ICON_CATALOG: ReadonlyArray<{
  slug: string;
  label: string;
}> = [
  { slug: "netflix", label: "Netflix" },
  { slug: "spotify", label: "Spotify" },
  { slug: "disneyplus", label: "Disney+" },
  { slug: "youtube", label: "YouTube" },
  { slug: "youtubemusic", label: "YouTube Music" },
  { slug: "appletv", label: "Apple TV" },
  { slug: "applemusic", label: "Apple Music" },
  { slug: "primevideo", label: "Prime Video" },
  { slug: "hulu", label: "Hulu" },
  { slug: "max", label: "Max" },
  { slug: "paramountplus", label: "Paramount+" },
  { slug: "peacock", label: "Peacock" },
  { slug: "crunchyroll", label: "Crunchyroll" },
  { slug: "twitch", label: "Twitch" },
  { slug: "discord", label: "Discord" },
  { slug: "steam", label: "Steam" },
  { slug: "xbox", label: "Xbox" },
  { slug: "playstation", label: "PlayStation" },
  { slug: "nintendo", label: "Nintendo" },
  { slug: "epicgames", label: "Epic Games" },
  { slug: "adobe", label: "Adobe" },
  { slug: "canva", label: "Canva" },
  { slug: "figma", label: "Figma" },
  { slug: "notion", label: "Notion" },
  { slug: "slack", label: "Slack" },
  { slug: "zoom", label: "Zoom" },
  { slug: "github", label: "GitHub" },
  { slug: "openai", label: "OpenAI / ChatGPT" },
  { slug: "google", label: "Google" },
  { slug: "icloud", label: "iCloud" },
  { slug: "dropbox", label: "Dropbox" },
  { slug: "microsoft", label: "Microsoft" },
  { slug: "duolingo", label: "Duolingo" },
  { slug: "nordvpn", label: "NordVPN" },
  { slug: "expressvpn", label: "ExpressVPN" },
  { slug: "linkedin", label: "LinkedIn" },
  { slug: "instagram", label: "Instagram" },
  { slug: "whatsapp", label: "WhatsApp" },
  { slug: "telegram", label: "Telegram" },
  { slug: "x", label: "X / Twitter" },
];

/** Name fragments → icon slug (checked longest-first). */
const ALIASES: ReadonlyArray<[RegExp, string]> = [
  [/disney\s*\+|disney\s*plus|disneyplus|\bdisney\b/i, "disneyplus"],
  [/paramount\s*\+|paramount\s*plus/i, "paramountplus"],
  [/prime\s*video|amazon\s*prime|primevideo/i, "primevideo"],
  [/apple\s*tv\+?|appletv/i, "appletv"],
  [/apple\s*music|applemusic/i, "applemusic"],
  [/youtube\s*music|youtubemusic/i, "youtubemusic"],
  [/youtube\s*premium|youtube/i, "youtube"],
  [/hbo\s*max|\bmax\b|hbo/i, "max"],
  [/microsoft\s*365|office\s*365|o365|office365|microsoft/i, "microsoft"],
  [/chat\s*gpt|chatgpt|openai/i, "openai"],
  [/google\s*one|google\s*drive|\bgoogle\b/i, "google"],
  [/play\s*station|playstation|ps\s*[45]/i, "playstation"],
  [/epic\s*games|fortnite/i, "epicgames"],
  [/crunchy\s*roll|crunchyroll/i, "crunchyroll"],
  [/express\s*vpn|expressvpn/i, "expressvpn"],
  [/nord\s*vpn|nordvpn/i, "nordvpn"],
  [/netflix/i, "netflix"],
  [/spotify/i, "spotify"],
  [/hulu/i, "hulu"],
  [/peacock/i, "peacock"],
  [/twitch/i, "twitch"],
  [/discord/i, "discord"],
  [/steam/i, "steam"],
  [/xbox/i, "xbox"],
  [/nintendo|switch/i, "nintendo"],
  [/adobe|creative\s*cloud|photoshop/i, "adobe"],
  [/canva/i, "canva"],
  [/figma/i, "figma"],
  [/notion/i, "notion"],
  [/slack/i, "slack"],
  [/zoom/i, "zoom"],
  [/github/i, "github"],
  [/icloud|apple\s*one/i, "icloud"],
  [/dropbox/i, "dropbox"],
  [/duolingo/i, "duolingo"],
  [/linkedin/i, "linkedin"],
  [/instagram|ig\b/i, "instagram"],
  [/whatsapp/i, "whatsapp"],
  [/telegram/i, "telegram"],
  [/\btwitter\b/i, "x"],
];

const CATALOG_SLUGS = new Set(SERVICE_ICON_CATALOG.map((c) => c.slug));

export function normalizeServiceToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+]+/g, "")
    .replace(/\+/g, "plus");
}

/**
 * Infer an icon slug from a free-text service name.
 * Returns {@link DEFAULT_ICON_KEY} when nothing matches.
 */
export function detectServiceIconKey(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return DEFAULT_ICON_KEY;
  }

  for (const [pattern, slug] of ALIASES) {
    if (pattern.test(trimmed)) {
      return slug;
    }
  }

  const token = normalizeServiceToken(trimmed);
  if (CATALOG_SLUGS.has(token)) {
    return token;
  }

  const first = normalizeServiceToken(trimmed.split(/\s+/)[0] ?? "");
  if (first && CATALOG_SLUGS.has(first)) {
    return first;
  }

  return DEFAULT_ICON_KEY;
}

/**
 * Resolve stored iconKey + name → slug used for rendering.
 * Empty / "default" / "auto" → detect from name (or default).
 */
export function resolveServiceIconKey(
  iconKey: string | null | undefined,
  name: string,
): string {
  if (!iconKey || iconKey === "auto") {
    return detectServiceIconKey(name);
  }
  if (iconKey === DEFAULT_ICON_KEY) {
    return DEFAULT_ICON_KEY;
  }
  return iconKey;
}

/** Absolute URL for a brand slug (Simple Icons or favicon fallback). */
export function simpleIconsCdnUrl(
  slug: string,
  color = "ffffff",
): string {
  const domain = FAVICON_DOMAINS[slug];
  if (domain) {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  }
  return `${SIMPLE_ICONS_CDN}/${slug}/${color}`;
}

export function isDefaultIconKey(key: string): boolean {
  return key === DEFAULT_ICON_KEY;
}
