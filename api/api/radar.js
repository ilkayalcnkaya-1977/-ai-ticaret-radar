export default async function handler(req, res) {
  try {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 15000);

    const response = await fetch(
      "https://trends.google.com/trending/rss?geo=TR",
      {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
          "Accept":
            "application/rss+xml, application/xml, text/xml, */*"
        }
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(
        "Google Trends HTTP " + response.status
      );
    }

    const xml = await response.text();

    if (!xml || xml.length < 100) {
      throw new Error("Google Trends boş veri döndürdü.");
    }

    function decodeHtml(value) {
      return String(value || "")
        .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .trim();
    }

    function getTag(block, tag) {
      const regex = new RegExp(
        "<" + tag + "[^>]*>([\\s\\S]*?)<\\/" + tag + ">",
        "i"
      );

      const match = block.match(regex);

      return match
        ? decodeHtml(match[1])
        : "";
    }

    function getNamespacedTag(block, tag) {
      const regex = new RegExp(
        "<(?:[a-zA-Z0-9_-]+:)?" +
          tag +
          "[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?" +
          tag +
          ">",
        "i"
      );

      const match = block.match(regex);

      return match
        ? decodeHtml(match[1])
        : "";
    }

    function trafficNumber(value) {
      const text = String(value || "")
        .replace(/\./g, "")
        .replace(/,/g, "")
        .toLowerCase();

      const match = text.match(/\d+/);

      if (!match) return 0;

      return Number(match[0]);
    }

    function calculateScore(traffic) {
      const number = trafficNumber(traffic);

      if (number >= 100000) return 95;
      if (number >= 50000) return 90;
      if (number >= 20000) return 85;
      if (number >= 10000) return 80;
      if (number >= 5000) return 72;
      if (number >= 2000) return 65;
      if (number >= 1000) return 58;
      if (number >= 500) return 50;
      if (number >= 200) return 42;
      if (number >= 100) return 35;

      return 30;
    }

    function detectCategory(trend) {
      const text = trend.toLocaleLowerCase("tr-TR");

      if (
        /keten|gömlek|pantolon|şort|elbise|etek|moda|ayakkabı|çanta|mont|ceket/.test(text)
      ) {
        return "Moda / Tekstil";
      }

      if (
        /telefon|iphone|samsung|xiaomi|tablet|bilgisayar|airpods|kulaklık|teknoloji/.test(text)
      ) {
        return "Teknoloji";
      }

      if (
        /araba|otomobil|otomotiv|benzin|mazot|yakıt|lastik|motor/.test(text)
      ) {
        return "Otomotiv / Yakıt";
      }

      if (
        /ev|mobilya|koltuk|masa|sandalye|dekorasyon|mutfak/.test(text)
      ) {
        return "Ev / Yaşam";
      }

      if (
        /market|gıda|kahve|çikolata|restoran|yemek/.test(text)
      ) {
        return "Gıda";
      }

      if (
        /spor|fitness|forma|futbol|basketbol/.test(text)
      ) {
        return "Spor";
      }

      return "Genel Trend";
    }

    function isCommercial(category, score) {
      const commercialCategories = [
        "Moda / Tekstil",
        "Teknoloji",
        "Otomotiv / Yakıt",
        "Ev / Yaşam",
        "Gıda",
        "Spor"
      ];

      return (
        commercialCategories.includes(category) &&
        score >= 60
      );
    }

    const itemBlocks =
      xml.match(/<item[\s\S]*?<\/item>/gi) || [];

    const trends = itemBlocks
      .map((block) => {
        const trend =
          getTag(block, "title");

        const traffic =
          getNamespacedTag(
            block,
            "approx_traffic"
          );

        if (!trend) {
          return null;
        }

        const score =
          calculateScore(traffic);

        const category =
          detectCategory(trend);

        return {
          trend,
          traffic: traffic || "—",
          score,
          category,
          commercial:
            isCommercial(category, score),
          productIdea:
            category === "Moda / Tekstil"
              ? "Ürün / tekstil"
              : category === "Teknoloji"
              ? "Teknoloji ürünü"
              : category === "Otomotiv / Yakıt"
              ? "Otomotiv ürünü"
              : "Ticari ürün"
        };
      })
      .filter(Boolean)
      .slice(0, 30);

    if (!trends.length) {
      throw new Error(
        "Google Trends verisinden trend çıkarılamadı."
      );
    }

    trends.sort(
      (a, b) => b.score - a.score
    );

    const opportunityCount =
      trends.filter(
        (item) => item.commercial
      ).length;

    return res.status(200).json({
      success: true,
      source: "Google Trends",
      country: "TR",
      updatedAt: new Date().toISOString(),
      count: trends.length,
      opportunityCount,
      trends
    });

  } catch (error) {
    console.error("RADAR ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Radar verisi alınamadı.",
      error:
        error?.message ||
        "Bilinmeyen hata"
    });
  }
}
