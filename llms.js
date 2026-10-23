// Auto-generated /llms.txt: a plain-text guide to the site for AI assistants and AI search crawlers.
// Lists the site, its key pages and the latest articles (same URLs as the sitemap). Cached for 5 minutes.
const SUPABASE_URL = "https://ofnscvxzikkjjpuiegfs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbnNjdnh6aWtrampwdWllZ2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMjczNzEsImV4cCI6MjEwNDYwMzM3MX0.Vl-lPLtYKDSwmPkGP3A0wZ9S6FKYD7hFS4prOSsU4Xo";
const SITE_URL = "https://www.mytrendly.store";

function slugify(x) {
    return String(x == null ? "" : x).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
}
const oneLine = (s, n) => String(s == null ? "" : s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

module.exports = async (req, res) => {
    let rows = [];
    try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 6000);
        const r = await fetch(`${SUPABASE_URL}/rest/v1/trending_posts?select=*`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, Accept: "application/json" },
            signal: ctl.signal,
        }).finally(() => clearTimeout(timer));
        if (r.ok) rows = await r.json();
    } catch (e) {}
    rows = (Array.isArray(rows) ? rows : []).filter((t) => t && t.id != null && t.title)
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))).slice(0, 100);

    const articles = rows.map((t) => {
        const sl = slugify(t.title);
        const d = oneLine(t.excerpt, 160);
        return `- [${oneLine(t.title, 120)}](${SITE_URL}/article/${Number(t.id)}${sl ? "-" + sl : ""})${d ? ": " + d : ""}`;
    });
    const txt = [
        "# MyTrendly",
        "",
        "> MyTrendly is an Indian shopping site with buying guides, deals, coupons and trending products from Amazon, Flipkart, Myntra, Meesho, Croma and 150+ partner brands. Articles compare products by price, features and use case, and are compiled from manufacturer specifications and published reviews. Some links are affiliate links.",
        "",
        "## Buying guides and articles",
        ...(articles.length ? articles : ["- See the sitemap for the latest articles."]),
        "",
        "## About the site",
        `- [About us](${SITE_URL}/about-us)`,
        `- [Affiliate disclosure](${SITE_URL}/affiliate-disclosure)`,
        `- [Contact us](${SITE_URL}/contact-us)`,
        `- [How we review](${SITE_URL}/how-we-review)`,
        `- [Site map](${SITE_URL}/site-map)`,
        `- [Returns, refunds and shipping](${SITE_URL}/returns-refunds-shipping)`,
        `- [Privacy policy](${SITE_URL}/privacy-policy)`,
        "",
        "## Sitemap",
        `- [Sitemap](${SITE_URL}/sitemap.xml)`,
        "",
    ].join("\n");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
    res.status(200).send(txt);
};
