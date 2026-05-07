exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    let { url } = JSON.parse(event.body);
    if (!url || !url.startsWith("http")) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid URL" }) };
    }

    // ── Dubb: normalize embed URLs to direct page URL ────────────────────────
    // embed: dubb.com/v/hutmE6/embed?... → dubb.com/v/hutmE6
    const dubbEmbedMatch = url.match(/dubb\.com\/v\/([a-zA-Z0-9_-]+)\/embed/);
    if (dubbEmbedMatch) {
      url = `https://dubb.com/v/${dubbEmbedMatch[1]}`;
    }

    // ── YouTube shortcut — no scraping needed ────────────────────────────────
    const ytMatch = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    if (ytMatch) {
      const videoId = ytMatch[1];
      const ogImage = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      let ogTitle = null;
      try {
        const r = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsletterBuilder/1.0)" },
        });
        const html = await r.text();
        const titleMatch = html.match(/"title":\{"runs":\[\{"text":"([^"]+)"/);
        if (titleMatch) ogTitle = titleMatch[1];
        if (!ogTitle) {
          const ogMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
          if (ogMatch) ogTitle = ogMatch[1];
        }
      } catch (_) {}
      return {
        statusCode: 200,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ ogImage, ogTitle, ogDescription: null }),
      };
    }

    // ── General OG scraper ───────────────────────────────────────────────────
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsletterBuilder/1.0)" },
    });

    if (!response.ok) {
      return { statusCode: 200, headers, body: JSON.stringify({ ogImage: null, ogTitle: null, ogDescription: null }) };
    }

    const html = await response.text();

    const get = (...properties) => {
      for (const property of properties) {
        const patterns = [
          new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
          new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
          new RegExp(`<meta[^>]+name=["']${property.replace("og:", "")}["'][^>]+content=["']([^"']+)["']`, "i"),
        ];
        for (const pattern of patterns) {
          const match = html.match(pattern);
          if (match) return match[1].trim();
        }
      }
      return null;
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const fallbackTitle = titleMatch ? titleMatch[1].trim() : null;

    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        // Try og:image:url first (Dubb), then standard og:image
        ogImage: get("og:image:url", "og:image"),
        ogTitle: get("og:title") || fallbackTitle,
        ogDescription: get("og:description"),
      }),
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ogImage: null, ogTitle: null, ogDescription: null }),
    };
  }
};
