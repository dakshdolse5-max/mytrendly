// Auto-generated sitemap.xml - Vercel Serverless Function.
// Lists: home, the 12 footer pages, and one clean URL for every article, product and coupon.
// Cached for 5 minutes at the edge, so a newly published article appears in the sitemap within minutes.
const SUPABASE_URL = "https://ofnscvxzikkjjpuiegfs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbnNjdnh6aWtrampwdWllZ2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMjczNzEsImV4cCI6MjEwNDYwMzM3MX0.Vl-mcEmHntX1SBpbfhplhxKPUP1DL0Qsxjz1ab08N2U";

// Your Main Domain
const SITE_URL = "https://mytrendly.store";

// Footer pages (must match the slugs in index.html and vercel.json)
const PAGE_SLUGS = [
    "privacy-policy", "terms-and-conditions", "terms-of-use", "affiliate-disclosure",
    "cookie-policy", "dpdp-act-compliance", "about-us", "contact-us",
    "report-ip-infringement", "data-and-compliance", "data-security", "your-rights",
];

// select=* on purpose: asking for a column that does not exist (e.g. updated_at)
// makes Supabase answer 400, which used to leave the sitemap with only the home page.
async function fetchTable(table) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        });
        if (!res.ok) return [];
        const rows = await res.json();
        return Array.isArray(rows) ? rows : [];
    } catch (e) {
        return [];
    }
}

function xmlEscape(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Returns an ISO date, or "" when the value is missing/invalid (an invalid date used to crash the whole sitemap).
function isoDate(v) {
    const d = v ? new Date(v) : null;
    return d && !isNaN(d) ? d.toISOString() : "";
}

function urlEntry(loc, lastmod, changefreq, priority) {
    const mod = isoDate(lastmod);
    return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n` +
        (mod ? `    <lastmod>${mod}</lastmod>\n` : "") +
        `    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

// Same slug rule as the website (index.html) so every sitemap URL equals the page's canonical URL.
function slugify(x) {
    return String(x == null ? "" : x).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
}

const rowDate = (r) => r.updated_at || r.created_at;
// One clean URL per row: /article/12-title, /product/7-name, /coupon/3-brand
const idUrls = (rows, kind, label, changefreq, priority) =>
    rows.filter((r) => r && r.id != null && Number.isFinite(Number(r.id)))
        .map((r) => {
            const sl = slugify(r[label]);
            return urlEntry(`${SITE_URL}/${kind}/${Number(r.id)}${sl ? "-" + sl : ""}`, rowDate(r), changefreq, priority);
        });

module.exports = async (req, res) => {
    const [trending, products, coupons] = await Promise.all([
        fetchTable("trending_posts"),
        fetchTable("products"),
        fetchTable("coupons"),
    ]);

    const urls = [
        urlEntry(`${SITE_URL}/`, new Date(), "hourly", "1.0"),
        ...idUrls(trending, "article", "title", "hourly", "0.8"),
        ...idUrls(products, "product", "name", "daily", "0.7"),
        ...idUrls(coupons.filter((c) => c.status == null || c.status === "active"), "coupon", "company", "daily", "0.6"),
        ...PAGE_SLUGS.map((slug) => urlEntry(`${SITE_URL}/${slug}`, null, "monthly", "0.4")),
    ];

    const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.join("\n") +
        `\n</urlset>\n`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
    res.status(200).send(xml);
};
