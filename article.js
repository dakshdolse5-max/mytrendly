// Serves /article/<id>-<slug> with real, per-article SEO in the HTML itself (title, description, canonical,
// Open Graph, Article + BreadcrumbList + FAQPage JSON-LD and the article text), so search engines AND
// AI crawlers that do not run JavaScript can read every article. The normal page (index.html) is unchanged:
// the site's own script still opens the article for visitors. If anything fails, the plain index.html is served.
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = "https://ofnscvxzikkjjpuiegfs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbnNjdnh6aWtrampwdWllZ2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMjczNzEsImV4cCI6MjEwNDYwMzM3MX0.Vl-lPLtYKDSwmPkGP3A0wZ9S6FKYD7hFS4prOSsU4Xo";
const SITE_URL = "https://www.mytrendly.store";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const text = (h) => String(h || "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const clean = (h) => String(h || "").replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, "").replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "").replace(/javascript:/gi, "");
const jsonLd = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

// Same slug rule as index.html and the sitemap
function slugify(x) {
    return String(x == null ? "" : x).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
}

function faqFrom(html) {
    const out = [];
    const m = /<h2[^>]*>[^<]*frequently asked questions[^<]*<\/h2>([\s\S]*?)(?=<h2\b|$)/i.exec(String(html || ""));
    if (!m) return out;
    const re = /<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
    let r;
    while ((r = re.exec(m[1]))) {
        const q = text(r[1]), a = text(r[2]);
        if (q && a) out.push({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } });
    }
    return out;
}

function setMeta(html, attr, name, content) {
    const re = new RegExp(`(<meta\\s+${attr}="${name.replace(/[:.]/g, "\\$&")}"\\s+content=")[^"]*(")`, "i");
    return re.test(html) ? html.replace(re, (_, a, b) => a + esc(content) + b) : html;
}

async function readIndex(req) {
    try {
        return fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");
    } catch (e) {
        const host = req.headers["x-forwarded-host"] || req.headers.host;
        const r = await fetch(`https://${host}/index.html`);
        return await r.text();
    }
}

module.exports = async (req, res) => {
    let html = "";
    const send = (h, code) => {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
        res.status(code || 200).send(h);
    };
    try {
        html = await readIndex(req);
    } catch (e) {
        return res.status(500).send("Temporarily unavailable");
    }
    try {
        const m = /^(\d+)/.exec(String((req.query && req.query.slug) || ""));
        if (!m) return send(html);
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 6000);
        const r = await fetch(`${SUPABASE_URL}/rest/v1/trending_posts?select=*&id=eq.${m[1]}`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, Accept: "application/json" },
            signal: ctl.signal,
        }).finally(() => clearTimeout(timer));
        const rows = r.ok ? await r.json() : [];
        const t = Array.isArray(rows) ? rows[0] : null;
        if (!t || !t.title) return send(html);

        const url = `${SITE_URL}/article/${Number(t.id)}${slugify(t.title) ? "-" + slugify(t.title) : ""}`;
        const title = `${t.title} | MyTrendly`;
        const body = String(t.content || "");
        const desc = (text(t.excerpt) || text(body)).slice(0, 158);
        const imgs = (Array.isArray(t.images) ? t.images : []).map((i) => (typeof i === "string" ? i : i && (i.url || i.src))).filter((u) => /^https?:\/\//i.test(u || ""));
        const org = { "@type": "Organization", name: "MyTrendly", url: `${SITE_URL}/`, logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` } };
        const article = {
            "@type": "Article", headline: String(t.title).slice(0, 110), description: desc, inLanguage: "en-IN",
            mainEntityOfPage: { "@type": "WebPage", "@id": url },
            author: { "@type": "Organization", name: "MyTrendly Editorial Team", url: `${SITE_URL}/` },
            publisher: org,
            ...(imgs[0] ? { image: imgs } : {}),
            ...(t.created_at ? { datePublished: t.created_at } : {}),
            dateModified: t.updated_at || t.created_at || undefined,
        };
        const crumbs = { "@type": "BreadcrumbList", itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name: String(t.title), item: url } ] };
        const graph = [article, crumbs];
        const faq = faqFrom(body);
        if (faq.length >= 2) graph.push({ "@type": "FAQPage", mainEntity: faq });

        html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
        html = setMeta(html, "name", "description", desc);
        html = html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/i, (_, a, b) => a + esc(url) + b);
        html = setMeta(html, "property", "og:type", "article");
        html = setMeta(html, "property", "og:title", title);
        html = setMeta(html, "property", "og:description", desc);
        html = setMeta(html, "property", "og:url", url);
        html = setMeta(html, "name", "twitter:title", title);
        html = setMeta(html, "name", "twitter:description", desc);
        if (imgs[0]) {
            html = setMeta(html, "property", "og:image", imgs[0]);
            html = setMeta(html, "name", "twitter:image", imgs[0]);
            html = setMeta(html, "property", "og:image:alt", t.title);
        }
        html = html.replace(/<\/head>/i, `<script type="application/ld+json" id="mt-article-ld">${jsonLd({ "@context": "https://schema.org", "@graph": graph })}</script>\n</head>`);
        // Plain-HTML copy of the article for crawlers that do not run JavaScript (visitors with JS never see it)
        const ns = `<noscript><article><h1>${esc(t.title)}</h1>${t.excerpt ? `<p>${esc(t.excerpt)}</p>` : ""}${clean(body)}</article></noscript>`;
        html = html.replace(/<body[^>]*>/i, (b) => b + ns);
        return send(html);
    } catch (e) {
        return send(html);
    }
};
