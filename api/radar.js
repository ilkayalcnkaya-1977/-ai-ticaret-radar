export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://trends.google.com/trending/rss?geo=TR"
    );

    if (!response.ok) {
      throw new Error("Trend verisi alınamadı");
    }

    const xml = await response.text();

    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

    const trends = items.slice(0, 10).map((match, index) => {
      const item = match[1];

      const title =
        item.match(/<title>([\s\S]*?)<\/title>/)?.[1]
          ?.replace(/<!\[CDATA\[|\]\]>/g, "")
          .trim() || "Bilinmeyen Trend";

      const traffic =
        item.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/)?.[1]
          ?.replace(/<!\[CDATA\[|\]\]>/g, "")
          .trim() || "—";

      const score = Math.min(
        100,
        Math.max(
          50,
          60 + Math.floor(Math.random() * 36)
        )
      );

      return {
        rank: index + 1,
        trend: title,
        traffic,
        score
      };
    });

    res.status(200).json({
      success: true,
      country: "TR",
      updatedAt: new Date().toISOString(),
      count: trends.length,
      trends
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Radar verisi alınamadı",
      message: error.message
    });
  }
}
