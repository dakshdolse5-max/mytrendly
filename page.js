// Serves /product/<id>-<slug> and /coupon/<id>-<slug> with their OWN title, description, canonical and image
// in the HTML itself, so a link shared on WhatsApp, Telegram, Facebook, X, Google etc. shows that product's or
// coupon's details instead of the home page's generic tagline. The normal page (index.html) is unchanged: the
// site's own script still opens the product/coupon for visitors. If anything fails, plain index.html is served.
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = "https://ofnscvxzikkjjpuiegfs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbnNjdnh6aWtrampwdWllZ2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMjczNzEsImV4cCI6MjEwNDYwMzM3MX0.Vl-lPLtYKDSwmPkGP3A0wZ9S6FKYD7hFS4prOSsU4Xo";
const SITE_URL = "https://www.mytrendly.store";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Same slug rule as index.html, the sitemap and article.js
function slugify(x) {
    return String(x == null ? "" : x).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
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

async function getRow(table, id) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&id=eq.${id}`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, Accept: "application/json" },
        signal: ctl.signal,
    }).finally(() => clearTimeout(timer));
    const rows = r.ok ? await r.json() : [];
    return Array.isArray(rows) ? rows[0] : null;
}

const imgList = (v) => (Array.isArray(v) ? v : []).map((i) => (typeof i === "string" ? i : i && (i.url || i.src))).filter((u) => /^https?:\/\//i.test(u || ""));

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
        const kind = String((req.query && req.query.kind) || "");
        const m = /^(\d+)/.exec(String((req.query && req.query.slug) || ""));
        if (!m || (kind !== "product" && kind !== "coupon")) return send(html);

        let title, desc, url, img;
        if (kind === "product") {
            const p = await getRow("products", m[1]);
            if (!p || !p.name) return send(html);
            const price = p.price_range ? String(p.price_range) : "";
            url = `${SITE_URL}/product/${Number(p.id)}${slugify(p.name) ? "-" + slugify(p.name) : ""}`;
            title = `${p.name}${price ? " - " + price : ""} | MyTrendly`;
            desc = `${p.name}${price ? " for " + price : ""}. Check the latest price, unlock available offers and buy with confidence on MyTrendly.`.slice(0, 158);
            img = imgList(p.images)[0] || "";
        } else {
            const c = await getRow("coupons", m[1]);
            if (!c || !c.company || (c.status != null && c.status !== "active")) return send(html);
            url = `${SITE_URL}/coupon/${Number(c.id)}${slugify(c.company) ? "-" + slugify(c.company) : ""}`;
            title = `${c.company} Coupon Code${c.offer ? " - " + c.offer : ""} | MyTrendly`;
            desc = `${c.company} coupon code${c.offer ? ": " + c.offer : ""}. Copy the code and apply it at checkout to save.`.slice(0, 158);
            img = /^https?:\/\//i.test(c.logo || "") ? c.logo : "";
        }

        html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
        html = setMeta(html, "name", "description", desc);
        html = html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/i, (_, a, b) => a + esc(url) + b);
        html = setMeta(html, "property", "og:title", title);
        html = setMeta(html, "property", "og:description", desc);
        html = setMeta(html, "property", "og:url", url);
        html = setMeta(html, "name", "twitter:title", title);
        html = setMeta(html, "name", "twitter:description", desc);
        if (img) {
            html = setMeta(html, "property", "og:image", img);
            html = setMeta(html, "name", "twitter:image", img);
            html = setMeta(html, "property", "og:image:alt", kind === "product" ? "Product picture" : "Store logo");
            // the home page's 1200x630 size no longer matches this picture
            html = html.replace(/\s*<meta\s+property="og:image:(width|height)"[^>]*>/gi, "");
        }
        return send(html);
    } catch (e) {
        return send(html);
    }
};
