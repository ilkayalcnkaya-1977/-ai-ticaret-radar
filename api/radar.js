export default async function handler(req, res) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      "https://trends.google.com/trending/rss?geo=TR",
      {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
          Accept:
            "application/rss+xml, application/xml, text/xml, */*"
        }
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(
        `Google Trends HTTP ${response.status}`
      );
    }

    const xml = await response.text();

    if (!xml || !xml.includes("<item")) {
      throw new Error("Google Trends verisi boş geldi");
    }

    function decodeHtml(value) {
      return String(value)
        .replace(/<!\[CDATA\[/gi, "")
        .replace(/\]\]>/gi, "")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&apos;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&#(\d+);/g, (_, code) =>
          String.fromCharCode(Number(code))
        )
        .trim();
    }

    function getTag(item, tag) {
      const regex = new RegExp(
        `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
        "i"
      );

      const match = item.match(regex);

      return match ? decodeHtml(match[1]) : "";
    }

    const items = [
      ...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)
    ];

    const rawTrends = items
      .slice(0, 30)
      .map((match, index) => {
        const item = match[1];

        return {
          rank: index + 1,
          trend: getTag(item, "title"),
          traffic: getTag(item, "ht:approx_traffic")
        };
      })
      .filter(item => item.trend);

    const commercialWords = [
      "ürün",
      "fiyat",
      "indirim",
      "kampanya",
      "satın",
      "satış",
      "mağaza",
      "market",
      "telefon",
      "iphone",
      "samsung",
      "xiaomi",
      "ayakkabı",
      "çanta",
      "elbise",
      "gömlek",
      "pantolon",
      "şort",
      "etek",
      "mont",
      "ceket",
      "parfüm",
      "kozmetik",
      "kahve",
      "makine",
      "aksesuar",
      "mobilya",
      "ev",
      "araba",
      "otomobil",
      "elektronik",
      "laptop",
      "tablet",
      "kulaklık",
      "oyuncak",
      "bebek",
      "mutfak",
      "dekorasyon",
      "takı",
      "saat",
      "spor ayakkabı",
      "çocuk",
      "oyun",
      "bilgisayar"
    ];

    const noiseWords = [
      "maç",
      "puan",
      "futbol",
      "spor",
      "son dakika",
      "kimdir",
      "kaç yaşında",
      "transfer",
      "seçim",
      "siyaset",
      "başbakan",
      "bakan",
      "yangın",
      "deprem",
      "hava durumu",
      "ölüm",
      "vefat",
      "dizi",
      "film",
      "oyuncu",
      "şarkıcı",
      "ünlü",
      "milli takım",
      "sınav",
      "kpss"
    ];

    function getTrafficNumber(value) {
      const text = String(value)
        .toLowerCase()
        .replace(/\s/g, "")
        .replace(",", ".");

      const match = text.match(/([\d.]+)/);

      if (!match) return 0;

      const number = parseFloat(match[1]);

      if (text.includes("milyon") || text.includes("m")) {
        return number * 1000000;
      }

      if (
        text.includes("bin") ||
        text.includes("k")
      ) {
        return number * 1000;
      }

      return number;
    }

    function getCommercialHits(text) {
      const lower = text.toLowerCase();

      return commercialWords.filter(word =>
        lower.includes(word)
      ).length;
    }

    function getNoiseHits(text) {
      const lower = text.toLowerCase();

      return noiseWords.filter(word =>
        lower.includes(word)
      ).length;
    }

    function calculateScore(trend, traffic) {
      const commercialHits =
        getCommercialHits(trend);

      const noiseHits =
        getNoiseHits(trend);

      const trafficNumber =
        getTrafficNumber(traffic);

      let trafficScore = 40;

      if (trafficNumber >= 1000000) {
        trafficScore = 100;
      } else if (trafficNumber >= 500000) {
        trafficScore = 92;
      } else if (trafficNumber >= 200000) {
        trafficScore = 84;
      } else if (trafficNumber >= 100000) {
        trafficScore = 76;
      } else if (trafficNumber >= 50000) {
        trafficScore = 68;
      } else if (trafficNumber >= 10000) {
        trafficScore = 60;
      } else {
        trafficScore = 50;
      }

      let score = trafficScore;

      score += commercialHits * 12;
      score -= noiseHits * 35;

      if (commercialHits === 0) {
        score -= 12;
      }

      return Math.max(
        0,
        Math.min(100, Math.round(score))
      );
    }

    function getCategory(trend) {
      const text = trend.toLowerCase();

      if (
        [
          "gömlek",
          "pantolon",
          "şort",
          "elbise",
          "etek",
          "mont",
          "ceket",
          "oversize",
          "moda"
        ].some(word => text.includes(word))
      ) {
        return "Moda";
      }

      if (
        [
          "iphone",
          "telefon",
          "samsung",
          "xiaomi",
          "laptop",
          "tablet",
          "kulaklık",
          "bilgisayar"
        ].some(word => text.includes(word))
      ) {
        return "Elektronik";
      }

      if (
        [
          "kahve",
          "market",
          "mutfak",
          "gıda"
        ].some(word => text.includes(word))
      ) {
        return "Gıda / Mutfak";
      }

      if (
        [
          "ev",
          "mobilya",
          "dekorasyon"
        ].some(word => text.includes(word))
      ) {
        return "Ev Yaşam";
      }

      if (
        [
          "ayakkabı",
          "çanta",
          "takı",
          "saat"
        ].some(word => text.includes(word))
      ) {
        return "Aksesuar";
      }

      if (
        [
          "parfüm",
          "kozmetik"
        ].some(word => text.includes(word))
      ) {
        return "Kozmetik";
      }

      if (
        [
          "bebek",
          "oyuncak",
          "çocuk"
        ].some(word => text.includes(word))
      ) {
        return "Çocuk / Bebek";
      }

      return "İncelenecek";
    }

    function getProductIdea(trend) {
      const text = trend.toLowerCase();

      if (
        [
          "gömlek",
          "pantolon",
          "şort",
          "elbise",
          "etek",
          "mont",
          "ceket"
        ].some(word => text.includes(word))
      ) {
        return "Moda ürünü / tekstil";
      }

      if (
        [
          "iphone",
          "telefon",
          "samsung",
          "xiaomi"
        ].some(word => text.includes(word))
      ) {
        return "Telefon aksesuarı";
      }

      if (text.includes("ayakkabı")) {
        return "Ayakkabı / aksesuar";
      }

      if (text.includes("çanta")) {
        return "Çanta / moda aksesuarı";
      }

      if (text.includes("kahve")) {
        return "Kahve / kahve ekipmanı";
      }

      if (
        text.includes("parfüm") ||
        text.includes("kozmetik")
      ) {
        return "Kozmetik / bakım ürünü";
      }

      if (
        text.includes("ev") ||
        text.includes("mobilya") ||
        text.includes("dekorasyon")
      ) {
        return "Ev yaşam ürünü";
      }

      if (
        text.includes("bebek") ||
        text.includes("oyuncak")
      ) {
        return "Bebek / çocuk ürünü";
      }

      return "Ticari kategori araştırılmalı";
    }

    const scoredTrends = rawTrends
      .map(item => {
        const score = calculateScore(
          item.trend,
          item.traffic
        );

        return {
          rank: item.rank,
          trend: item.trend,
          traffic: item.traffic || "—",
          score,
          category: getCategory(item.trend),
          productIdea: getProductIdea(item.trend),
          commercial:
            getCommercialHits(item.trend) > 0
        };
      })
      .sort((a, b) => b.score - a.score);

    const topTrends =
      scoredTrends.slice(0, 10);

    const bestScore =
      topTrends.length > 0
        ? topTrends[0].score
        : 0;

    const opportunityCount =
      topTrends.filter(item =>
        item.commercial && item.score >= 65
      ).length;

    res.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=600"
    );

    return res.status(200).json({
      success: true,
      country: "TR",
      source: "Google Trends",
      updatedAt: new Date().toISOString(),
      count: topTrends.length,
      radarScore: bestScore,
      opportunityCount,
      trends: topTrends
    });

  } catch (error) {
    console.error("RADAR ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Radar verisi alınamadı",
      message:
        error?.name === "AbortError"
          ? "Google Trends zaman aşımına uğradı"
          : error?.message || "Bilinmeyen hata",
      updatedAt: new Date().toISOString(),
      trends: []
    });
  }
}
