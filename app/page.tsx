"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Ad from "../components/Ad";

type Article = {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  image_url?: string;
  source?: string;
};

const AD_CLIENT = "YOUR-CLIENT-ID";
const SLOT_TOP = "1111111111";
const SLOT_INFEED = "2222222222";
const SLOT_SIDEBAR = "3333333333";
const SLOT_BOTTOM = "4444444444";

// Order: All, MMA, Boxing, Muay Thai, BJJ, Amateur Wrestling
const TABS = [
  { label: "All", key: "all" },
  { label: "MMA", key: "mma" },
  { label: "Boxing", key: "boxing" },
  { label: "Muay Thai", key: "muay" },
  { label: "BJJ", key: "bjj" },
  { label: "Wrestling", key: "wrestling" }, // Amateur
] as const;

type Kind = "all" | "news" | "videos";

function timeAgo(d?: string) {
  if (!d) return "";
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.max(1, Math.floor(ms / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Home() {
  const [items, setItems] = useState<Article[]>([]);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [activeTab, setActiveTab] = useState(0);
  const [kind, setKind] = useState<Kind>("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [q, setQ] = useState(""); // debounced search
  const [qInput, setQInput] = useState(""); // immediate input

  const tabKey = TABS[activeTab].key;

  const fetchNews = useCallback(
    async (opts?: { page?: string; append?: boolean }) => {
      const u = new URL("/api/rss", location.origin);
      u.searchParams.set("tab", tabKey);
      u.searchParams.set("kind", kind); // tell API exactly what we want
      if (opts?.page) u.searchParams.set("page", opts.page);

      const r = await fetch(u.toString(), { cache: "no-store" });
      const j = await r.json();

      const list: Article[] = j?.results ?? [];

      if (opts?.append) setItems((prev) => [...prev, ...list]);
      else setItems(list);

      setNextPage(j?.nextPage ?? null);
    },
    [tabKey, kind]
  );

  // Initial + on tab/kind change + on reload
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setItems([]);
    setNextPage(null);
    (async () => {
      try {
        await fetchNews();
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [fetchNews, activeTab, kind, refreshKey]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 250);
    return () => clearTimeout(t);
  }, [qInput]);

  // In-memory search filter
  const visibleItems = useMemo(() => {
    if (!q.trim()) return items;
    const s = q.trim().toLowerCase();
    return items.filter((a) =>
      `${a.title ?? ""} ${a.description ?? ""} ${a.source ?? ""}`.toLowerCase().includes(s)
    );
  }, [items, q]);

  // Insert ads in the feed
  const feedWithAds = useMemo(() => {
    const out: (Article | { __ad__: true; key: string })[] = [];
    let inserted = 0;
    visibleItems.forEach((a, i) => {
      out.push(a);
      const shouldInsert = (i + 1) % 4 === 0 && inserted < 2;
      if (shouldInsert) {
        out.push({ __ad__: true, key: `infeed-${inserted + 1}` });
        inserted++;
      }
    });
    return out;
  }, [visibleItems]);

  // Infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMore = useCallback(async () => {
    if (!nextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchNews({ page: nextPage, append: true });
    } finally {
      setLoadingMore(false);
    }
  }, [nextPage, loadingMore, fetchNews]);

  useEffect(() => {
    if (!nextPage) return;
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { rootMargin: "300px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [nextPage, onLoadMore]);

  const onReload = () => setRefreshKey((k) => k + 1);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        {/* Logo + Title */}
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/club-bravado-logo.png"
            alt="Club Bravado Logo"
            className="h-10 w-auto"
            style={{ maxWidth: 180 }}
          />
          <h1 className="text-3xl font-bold">Club Bravado MMA Live News Feed</h1>
        </div>
        {/* Search + Reload */}
        <div className="flex items-center gap-2">
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder={
              kind === "videos"
                ? "Search videos (e.g., 'Full Fight', 'KO Compilation')"
                : "Search (e.g., Canelo, Gordon Ryan, U20 Worlds)"
            }
            className="px-3 py-2 rounded-lg border text-sm"
          />
          <button
            onClick={onReload}
            className="px-3 py-2 rounded-lg border hover:shadow text-sm"
            title="Fetch latest"
          >
            Reload
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-3">
        {TABS.map((t, i) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(i)}
            className={`px-3 py-1.5 rounded-full border text-sm ${
              i === activeTab ? "bg-gray-900 text-white" : "hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Kind toggle */}
      <div className="inline-flex rounded-lg overflow-hidden border mb-4">
        {(["all", "news", "videos"] as Kind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`px-3 py-1.5 text-sm ${
              k === kind ? "bg-gray-900 text-white" : "hover:bg-gray-100"
            }`}
          >
            {k === "all" ? "All" : k === "news" ? "News" : "Videos"}
          </button>
        ))}
      </div>

      {/* Top ad */}
      <div className="mb-6">
        <Ad
          client={AD_CLIENT}
          slot={SLOT_TOP}
          format="auto"
          fullWidthResponsive
          style={{ display: "block", margin: "12px 0" }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Articles */}
        <div>
          {loading ? (
            <p>Loading…</p>
          ) : feedWithAds.length === 0 ? (
            <p>
              {kind === "videos"
                ? "No official full fights or KO compilations found right now. Try another tab, Reload, or check later."
                : "No headlines right now. Try Reload or change tabs."}
            </p>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                {feedWithAds.map((item, idx) => {
                  if ((item as any).__ad__) {
                    return (
                      <div key={(item as any).key} className="md:col-span-2">
                        <Ad
                          client={AD_CLIENT}
                          slot={SLOT_INFEED}
                          format="auto"
                          fullWidthResponsive
                          style={{ display: "block", margin: "8px 0" }}
                        />
                      </div>
                    );
                  }
                  const a = item as Article;
                  const date = timeAgo(a.pubDate);
                  const img = a.image_url || "/placeholder.jpg";

                  return (
                    <a
                      key={idx}
                      href={a.link}
                      target="_blank"
                      className="block rounded-2xl border p-4 hover:shadow"
                    >
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-full h-40 md:h-48 object-cover rounded-xl mb-3"
                        />
                      ) : null}
                      <div className="flex items-center gap-2 text-xs opacity-80 mb-1">
                        {a.source ? (
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 border">
                            {a.source}
                          </span>
                        ) : null}
                        <span>{date}</span>
                      </div>
                      <h2 className="text-lg font-semibold line-clamp-2">{a.title}</h2>
                      <p className="text-sm mt-2 line-clamp-3">{a.description}</p>
                    </a>
                  );
                })}
              </div>

              {/* Infinite scroll sentinel */}
              {nextPage ? <div ref={sentinelRef} className="h-10" /> : null}

              {/* Fallback button */}
              {nextPage ? (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={onLoadMore}
                    disabled={loadingMore}
                    className="px-4 py-2 rounded-lg border hover:shadow"
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                </div>
              ) : null}
            </>
          )}

          {/* Bottom ad */}
          <div className="mt-6">
            <Ad
              client={AD_CLIENT}
              slot={SLOT_BOTTOM}
              format="auto"
              fullWidthResponsive
              style={{ display: "block", margin: "12px 0" }}
            />
          </div>
        </div>

        {/* Sidebar ad */}
        <aside className="hidden lg:block">
          <div className="sticky top-6">
            <Ad
              client={AD_CLIENT}
              slot={SLOT_SIDEBAR}
              format="auto"
              fullWidthResponsive
              style={{ display: "block", width: "100%", minHeight: 300, margin: "0 auto" }}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
