import { NextResponse } from "next/server";
import Parser from "rss-parser";

/**
 * Performance-focused version:
 * - In-memory caching for whole responses (per tab+kind+page)
 * - In-memory caching for YouTube channel verification
 * - Lighter OpenGraph thumbnail scraping (first 3 per page)
 * - Timeouts and safer fallbacks
 */

const parser = new Parser({
  timeout: 12000,
  headers: { "User-Agent": "ClubBravadoFeed/1.0 (+http://localhost)" },
});

/* -----------------------------
   Article (News) Sources
   ----------------------------- */
const ARTICLE_SOURCES = {
  all: [
    // MMA
    "https://mmajunkie.usatoday.com/feed",
    "https://www.mmafighting.com/rss/index.xml",
    "https://www.themaclife.com/feed/",
    "https://www.bloodyelbow.com/rss/index.xml",
    "https://www.sherdog.com/rss/news.xml",
    // Boxing
    "https://www.boxingscene.com/rss.php",
    "https://www.badlefthook.com/rss/index.xml",
    "https://www.ringtv.com/feed/",
    "https://www.worldboxingnews.net/feed/",
    "https://fightnews.com/feed/",
    "https://www.boxingnewsonline.net/feed/",
    // Muay Thai / ONE / Kickboxing
    "https://www.onefc.com/news/feed/",
    "https://www.muaythaicitizen.com/feed/",
    "https://www.wbcmuaythai.com/feed/",
    // BJJ / Grappling
    "https://www.bjjheroes.com/feed",
    "https://www.jiujitsutimes.com/feed",
    "https://graciemag.com/en/feed/",
    "https://adccnews.com/feed/",
    // Amateur Wrestling
    "https://news.theopenmat.com/feed/",
    "https://www.win-magazine.com/feed/",
    "https://theguillotine.com/feed/",
    "https://intermatwrestle.com/feed",
  ],
  mma: [
    "https://mmajunkie.usatoday.com/feed",
    "https://www.mmafighting.com/rss/index.xml",
    "https://www.bloodyelbow.com/rss/index.xml",
    "https://www.sherdog.com/rss/news.xml",
    "https://www.themaclife.com/feed/",
    "https://www.onefc.com/news/feed/",
  ],
  boxing: [
    "https://www.boxingscene.com/rss.php",
    "https://www.badlefthook.com/rss/index.xml",
    "https://www.ringtv.com/feed/",
    "https://www.worldboxingnews.net/feed/",
    "https://fightnews.com/feed/",
    "https://www.boxingnewsonline.net/feed/",
  ],
  muay: [
    "https://www.onefc.com/news/feed/",
    "https://www.muaythaicitizen.com/feed/",
    "https://www.wbcmuaythai.com/feed/",
  ],
  bjj: [
    "https://www.bjjheroes.com/feed",
    "https://www.jiujitsutimes.com/feed",
    "https://graciemag.com/en/feed/",
    "https://adccnews.com/feed/",
  ],
  wrestling: [
    "https://news.theopenmat.com/feed/",
    "https://www.win-magazine.com/feed/",
    "https://theguillotine.com/feed/",
    "https://intermatwrestle.com/feed",
  ],
} as const;

type TabKey = keyof typeof ARTICLE_SOURCES;

type Item = {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  image_url?: string;
  source?: string;
};

type Kind = "all" | "news" | "videos";

/* -----------------------------
   Official channel verification
   ----------------------------- */
const OFFICIAL_CHANNEL_NAME_KEYWORDS = [
  "UFC",
  "Professional Fighters League",
  "PFL",
  "DAZN Boxing",
  "Matchroom",
  "Top Rank",
  "ONE Championship",
  "Riyadh Season",
  "Thai Fight",
  "Bellator",
  "GLORY",
  "BKFC",
  "ADCC",
  "IBJJF",
  "FloGrappling",
  "United World Wrestling",
  "UWW",
];

/* -----------------------------
   Simple in-memory caches
   ----------------------------- */

// Whole-response cache (tab+kind+page) – 2 minutes default TTL
const RESPONSE_TTL_MS = 2 * 60 * 1000;
const responseCache = new Map<string, { expires: number; payload: any }>();

// YouTube channel verification cache – 1 day TTL
const YT_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const ytVerifyCache = new Map<string, { expires: number; ok: boolean }>();

function getCached<T>(map: Map<string, { expires: number; [k: string]: any }>, key: string): T | null {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    map.delete(key);
    return null;
  }
  return hit as unknown as T;
}

function setCached(map: Map<string, any>, key: string, data: any, ttl: number) {
  map.set(key, { ...data, expires: Date.now() + ttl });
}

/* -----------------------------
   Utilities
   ----------------------------- */

function removeNoise(item: Item): boolean {
  const t = `${item.title ?? ""} ${item.description ?? ""}`.toLowerCase();
  if (/powerball|lottery/.test(t)) return false;
  return true;
}

// Allow full fights AND official KO/finish compilations
function looksLikeAllowedVideo(a: Item): boolean {
  const t = `${a.title ?? ""} ${a.description ?? ""}`.toLowerCase();

  const fullFight = /(full\s*(fight|match|bout)|free\s*fight|full\s*event)/i.test(t);
  const koCompilation =
    /(ko|knockout|knockouts|finishes|finish)\s*(compilation|highlights|reel|collection|montage)?/i.test(t);

  const avoidFanEdit = /(fan\s*made|unofficial)/i.test(t);

  return (fullFight || koCompilation) && !avoidFanEdit;
}

// Find first YouTube link in HTML (iframe or anchor)
function extractFirstYouTubeUrl(html?: string): string | undefined {
  if (!html) return;
  const m =
    html.match(/<iframe[^>]+src=["']([^"']+youtube[^"']+)["']/i) ||
    html.match(/<a[^>]+href=["']([^"']+youtube[^"']+)["']/i) ||
    html.match(/<iframe[^>]+src=["']([^"']+youtu\.be[^"']+)["']/i) ||
    html.match(/<a[^>]+href=["']([^"']+youtu\.be[^"']+)["']/i);
  return m?.[1];
}

function isYouTube(u: string): boolean {
  try {
    const { hostname } = new URL(u);
    return /(^|\.)youtube\.com$/i.test(hostname) || /(^|\.)youtu\.be$/i.test(hostname);
  } catch {
    return false;
  }
}

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid","si","pp"].forEach(p =>
      url.searchParams.delete(p)
    );
    url.hash = "";
    return url.toString();
  } catch {
    return u;
  }
}

function pickImageFrom(item: any): string | undefined {
  if (item.enclosure?.url) return item.enclosure.url as string;
  if ((item as any)["media:content"]?.url) return (item as any)["media:content"].url;
  if ((item as any)["media:thumbnail"]?.url) return (item as any)["media:thumbnail"].url;

  const html: string =
    (item["content:encoded"] as string) || (item.content as string) || (item.summary as string) || "";
  const m = html?.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1];
}

async function fetchWithTimeout(url: string, ms = 10000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function getArticleFeedItems(url: string): Promise<Item[]> {
  try {
    const feed = await parser.parseURL(url);
    return (feed.items || []).map((it) => ({
      title: it.title || "",
      link: it.link || "",
      pubDate: (it as any).isoDate || it.pubDate || "",
      description: it.contentSnippet || it.content || it.summary || "",
      image_url: pickImageFrom(it),
      source: feed.title || url,
    }));
  } catch {
    return [];
  }
}

// Verify a YouTube URL's channel is official (cached)
async function isOfficialYouTubeChannel(videoUrl: string): Promise<boolean> {
  const key = normalizeUrl(videoUrl);
  const cached = getCached<{ ok: boolean }>(ytVerifyCache, key);
  if (cached) return cached.ok;

  try {
    const res = await fetchWithTimeout(videoUrl, 9000);
    const html = await res.text();

    const m1 = html.match(/"ownerChannelName"\s*:\s*"([^"]+)"/i);
    let name =
      m1?.[1] ||
      html.match(/<link[^>]+itemprop=["']name["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/"channelMetadataRenderer"\s*:\s*{[^}]*"title"\s*:\s*"([^"]+)"/i)?.[1] ||
      "";

    name = (name || "").toLowerCase();
    const ok = OFFICIAL_CHANNEL_NAME_KEYWORDS.some((kw) => name.includes(kw.toLowerCase()));

    setCached(ytVerifyCache, key, { ok }, YT_VERIFY_TTL_MS);
    return ok;
  } catch {
    setCached(ytVerifyCache, key, { ok: false }, 5 * 60 * 1000); // cache failures for 5 min
    return false;
  }
}

// Fill missing thumbnails from og:image/twitter:image (first FEW per page to reduce cost)
async function fillOpenGraphImages(items: Item[], firstN = 3): Promise<Item[]> {
  const work = items.slice(0, firstN).map(async (a) => {
    if (a.image_url || !a.link) return a;
    try {
      const res = await fetchWithTimeout(a.link, 6000);
      const html = await res.text();
      const og =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
      const url = og?.[1];
      if (url) a.image_url = url;
    } catch {}
    return a;
  });

  await Promise.all(work);
  return items;
}

/* -----------------------------
   Main handler with response cache
   ----------------------------- */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tab = (url.searchParams.get("tab") || "all").toLowerCase() as TabKey;
  const page = parseInt(url.searchParams.get("page") || "0", 10);
  const kind = (url.searchParams.get("kind") || "all").toLowerCase() as Kind;
  const pageSize = 20;

  const cacheKey = `resp:${tab}:${kind}:${page}`;
  const cached = getCached<{ payload: any }>(responseCache, cacheKey);
  if (cached) {
    return NextResponse.json(cached.payload);
  }

  const articleFeeds = ARTICLE_SOURCES[tab] ?? ARTICLE_SOURCES.all;

  let items: Item[] = [];

  if (kind === "videos") {
    // 1) From articles: extract embedded YouTube links and verify
    const articleLists = await Promise.all(articleFeeds.map((f) => getArticleFeedItems(f)));
    const merged: Item[] = [];
    const seenArticle = new Set<string>();

    for (const list of articleLists) {
      for (const raw of list) {
        const key = normalizeUrl(raw.link || raw.title);
        if (!key || seenArticle.has(key)) continue;
        seenArticle.add(key);

        // Must look like allowed video (full fight OR KO compilation)
        if (!looksLikeAllowedVideo(raw)) continue;

        // Try to find embedded YouTube link quickly
        let yt = "";
        try {
          const res = await fetchWithTimeout(raw.link, 7000);
          const html = await res.text();
          yt = extractFirstYouTubeUrl(html) || "";
        } catch {}

        if (!yt || !isYouTube(yt)) continue;

        // Verify official channel (cached)
        const official = await isOfficialYouTubeChannel(yt);
        if (!official) continue;

        merged.push({
          ...raw,
          link: yt,
          source: raw.source || "YouTube",
        });
      }
    }

    // Dedupe by normalized link and sort newest
    const byKey: Record<string, Item> = {};
    for (const m of merged) byKey[normalizeUrl(m.link)] = m;
    items = Object.values(byKey).sort((a, b) => {
      const da = new Date(a.pubDate ?? 0).getTime();
      const db = new Date(b.pubDate ?? 0).getTime();
      return db - da;
    });
  } else {
    // News / All
    const lists = await Promise.all(articleFeeds.map((f) => getArticleFeedItems(f)));

    const merged: Item[] = [];
    const seen = new Set<string>();
    for (const list of lists) {
      for (const a of list) {
        const key = normalizeUrl(a.link || a.title);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push({ ...a, link: key });
      }
    }

    items = merged.filter(removeNoise).sort((a, b) => {
      const da = new Date(a.pubDate ?? 0).getTime();
      const db = new Date(b.pubDate ?? 0).getTime();
      return db - da;
    });
  }

  // Paginate
  const start = page * pageSize;
  const end = start + pageSize;
  let slice = items.slice(start, end);

  // Thumbnails (smaller budget: first 3 only)
  slice = await fillOpenGraphImages(slice, 3);

  const nextPage = end < items.length ? String(page + 1) : null;

  const payload = {
    status: "ok",
    count: slice.length,
    nextPage,
    results: slice,
  };

  // Cache the response for 2 minutes
  setCached(responseCache, cacheKey, { payload }, RESPONSE_TTL_MS);

  return NextResponse.json(payload);
}
