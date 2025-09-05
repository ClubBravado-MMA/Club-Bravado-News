import { NextResponse } from "next/server";
import Parser from "rss-parser";

// One parser instance we reuse
const parser = new Parser({
  timeout: 15000, // 15s safety
  headers: { "User-Agent": "CombatSportsFeed/1.0 (+https://localhost)" },
});

// === FEED SOURCES ===  (edit these anytime)
const SOURCES = {
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
    // ONE / Muay Thai / Kickboxing
    "https://www.onefc.com/news/feed/",
  ],
  mma: [
    "https://mmajunkie.usatoday.com/feed",
    "https://www.mmafighting.com/rss/index.xml",
    "https://www.bloodyelbow.com/rss/index.xml",
    "https://www.sherdog.com/rss/news.xml",
    "https://www.themaclife.com/feed/",
    "https://www.onefc.com/news/feed/",
  ],
  ufc: [
    "https://mmajunkie.usatoday.com/tag/ufc/feed",
    "https://www.mmafighting.com/ufc/rss/index.xml",
    "https://www.themaclife.com/tag/ufc/feed/",
  ],
  boxing: [
    "https://www.boxingscene.com/rss.php",
    "https://www.badlefthook.com/rss/index.xml",
  ],
  muay: [
    "https://www.onefc.com/news/feed/",
    // add more Muay Thai-specific feeds if you have them
  ],
} as const;

type TabKey = keyof typeof SOURCES;

type Item = {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  image_url?: string;
  source?: string;
};

function isCombat(item: Item): boolean {
  const t = `${item.title ?? ""} ${item.description ?? ""}`.toLowerCase();
  if (/powerball|lottery/.test(t)) return false;
  return /mma|ufc|bellator|pfl|one|boxing|boxer|bout|fight|fighter|muay|kickboxing|ko|tko|weigh/.test(
    t
  );
}

// Try to grab a thumbnail from common locations
function pickImageFrom(item: any): string | undefined {
  // rss-parser puts possible media fields onto item.enclosure, or custom fields on item
  if (item.enclosure?.url) return item.enclosure.url as string;
  if ((item as any)["media:content"]?.url) return (item as any)["media:content"].url;
  if ((item as any)["media:thumbnail"]?.url) return (item as any)["media:thumbnail"].url;

  // crude fallback: scan content for <img src="">
  const html: string =
    (item["content:encoded"] as string) || (item.content as string) || (item.summary as string) || "";
  const m = html?.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1];
}

async function getFeedItems(url: string): Promise<Item[]> {
  try {
    const feed = await parser.parseURL(url);
    const items: Item[] = (feed.items || []).map((it) => ({
      title: it.title || "",
      link: it.link || "",
      pubDate: it.isoDate || it.pubDate || "",
      description: it.contentSnippet || it.content || it.summary || "",
      image_url: pickImageFrom(it),
      source: feed.title || url,
    }));
    return items;
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tab = (url.searchParams.get("tab") || "all").toLowerCase() as TabKey;
  const page = parseInt(url.searchParams.get("page") || "0", 10); // 0,1,2...
  const pageSize = 20;

  const feeds = SOURCES[tab] ?? SOURCES.all;

  // Fetch feeds concurrently
  const lists = await Promise.all(feeds.map((f) => getFeedItems(f)));

  // Merge + dedupe by link
  const merged: Item[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const a of list) {
      const key = a.link || a.title;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(a);
    }
  }

  // Filter to combat and sort newest first
  const filtered = merged.filter(isCombat).sort((a, b) => {
    const da = new Date(a.pubDate ?? 0).getTime();
    const db = new Date(b.pubDate ?? 0).getTime();
    return db - da;
  });

  // Paginate
  const start = page * pageSize;
  const end = start + pageSize;
  const slice = filtered.slice(start, end);
  const nextPage = end < filtered.length ? String(page + 1) : null;

  return NextResponse.json({
    status: "ok",
    count: slice.length,
    nextPage,
    results: slice,
  });
}
