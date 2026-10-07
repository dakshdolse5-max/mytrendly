// Auto-generated sitemap.xml - Vercel Serverless Function.
// Lives at /api/sitemap.xml.js, which Vercel automatically serves at the URL /api/sitemap.xml.
// It queries Supabase live, on every request, so it always reflects however many products,
// coupons and trending articles currently exist - nothing to regenerate or upload by hand.

const SUPABASE_URL = "https://ofnscvxzikkjjpuiegfs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbnNjdnh6aWtrampwdWllZ2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMjczNzEsImV4cCI6MjEwNDYwMzM3MX0.Vl-mcEmHntX1SBpbfhplhxKPUP1DL0Qsxjz1ab08N2U";

// Change this if the site ever moves to a different domain.
const SITE_URL = "https://mytrendly.vercel.app";

async function fetchTable(table, select) {
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/${table}?select=${select}`,
            { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
        );
        if (!res.ok) return [];
        return await res.json();
    } catch (e) {
        return [];
    }
}

function xmlEscape(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function urlEntry(loc, lastmod, changefreq, priority) {
    return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n` +
        (lastmod ? `    <lastmod>${new Date(lastmod).toISOString()}</lastmod>\n` : "") +
        `    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

module.exports = async (req, res) => {
    // Trending articles are the only content type with its own URL today (?trending=id, added
    // via history.pushState in index.html). Products and coupons live inside the single home
    // page and don't have separate URLs yet, so only the home page represents them here.
    const trending = await fetchTable("trending_posts", "id,updated_at,created_at");

    const urls = [
        urlEntry(`${SITE_URL}/`, new Date(), "hourly", "1.0"),
        ...trending.map((t) =>
            urlEntry(`${SITE_URL}/?trending=${encodeURIComponent(t.id)}`, t.updated_at || t.created_at, "weekly", "0.7")
        ),
    ];

    const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.join("\n") +
        `\n</urlset>\n`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(xml);
};
