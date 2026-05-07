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
    const { url } = JSON.parse(event.body);
    if (!url || !url.startsWith("http")) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid URL" }) };
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NewsletterBuilder/1.0)",
      },
    });

    if (!response.ok) {
      return { statusCode: 200, headers, body: JSON.stringify({ ogImage: null, ogTitle: null, ogDescription: null }) };
    }

    const html = await response.text();

    const get = (property) => {
      // Match og:property or name=property meta tags
      const patterns = [
        new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
        new RegExp(`<meta[^>]+name=["']${property.replace("og:", "")}["'][^>]+content=["']([^"']+)["']`, "i"),
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return match[1].trim();
      }
      return null;
    };

    // Fallback title from <title> tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const fallbackTitle = titleMatch ? titleMatch[1].trim() : null;

    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        ogImage: get("og:image"),
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
