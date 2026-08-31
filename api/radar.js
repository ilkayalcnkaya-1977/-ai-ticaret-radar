export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://trends.google.com/trending/rss?geo=TR",
      {
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    if (!response.ok) {
      throw new Error("Google Trends verisi alınamadı");
    }

    const xml = await response.text();

    const items = [
      ...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)
    ];

    const trends = items.slice(0, 20).map((match, index) => {
      const item = match[1];

      const getTag = (tag) => {
        const regex = new RegExp(
          `<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,
          "i"
        );

        return (
          item
            .match(regex)?.[1]
            ?.replace(/<!\[CDATA\[|\]\]>/g, "")
            ?.replace(/&amp;/g, "&")
            ?.replace(/&quot;/g, '"')
            ?.replace(/&#39;/g, "'")
            ?.trim() || ""
        );
      };

      const trend = getTag("title");
      const traffic = getTag("ht:approx_traffic");

      return {
        rank: index + 1,
        trend,
        traffic
      };
    });

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
      "spor ayakkabı",
      "çanta",
      "takı",
      "saat"
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
      "milli takım"
    ];

    function getTrafficNumber(value) {
      const text = String(value).toLowerCase();

      const number = parseFloat(
        text.replace(/[^\d.,]/g, "").replace(",", ".")
      );

      if (text.includes("milyon")) {
        return number * 1000000;
      }

      if (text.includes("bin")) {
        return number * 1000;
      }

      return number || 0;
    }

    function calculateScore(trend, traffic) {
      const text = trend.toLowerCase();

      const commercialHits = commercialWords.filter(word =>
        text.includes(word)
      ).length;

      const noiseHits = noiseWords.filter(word =>
        text.includes(word)
      ).length;

      const trafficNumber = getTrafficNumber(traffic);

      let trafficScore = 40;

      if (trafficNumber >= 1000000) {
        trafficScore = 100;
      } else if (trafficNumber >= 500000) {
        trafficScore = 90;
      } else if (trafficNumber >= 200000) {
        trafficScore = 82;
      } else if (trafficNumber >= 100000) {
        trafficScore = 75;
      } else if (trafficNumber >= 50000) {
        trafficScore = 68;
      } else {
        trafficScore = 55;
      }

      let score = trafficScore;

      score += commercialHits * 12;
      score -= noiseHits * 35;

      if (commercialHits === 0) {
        score -= 10;
      }

      return Math.max(0, Math.min(100, Math.round(score)));
    }

    function getCategory(trend) {
      const text = trend.toLowerCase();

      if (
        text.includes("gömlek") ||
        text.includes("pantolon") ||
        text.includes("şort") ||
        text.includes("elbise") ||
        text.includes("etek") ||
        text.includes("mont") ||
        text.includes("ceket")
      ) {
        return "Moda";
      }

      if (
        text.includes("iphone") ||
        text.includes("telefon") ||
        text.includes("samsung") ||
        text.includes("laptop") ||
        text.includes("tablet") ||
        text.includes("kulaklık")
      ) {
        return "Elektronik";
      }

      if (
        text.includes("kahve") ||
        text.includes("market") ||
        text.includes("mutfak")
      ) {
        return "Gıda / Mutfak";
      }

      if (
        text.includes("ev") ||
        text.includes("mobilya") ||
        text.includes("dekorasyon")
      ) {
        return "Ev Yaşam";
      }

      if (
        text.includes("ayakkabı") ||
        text.includes("çanta") ||
        text.includes("takı") ||
        text.includes("saat")
      ) {
        return "Aksesuar";
      }

      if (
        text.includes("parfüm") ||
        text.includes("kozmetik")
      ) {
        return "Kozmetik";
      }

      if (
        text.includes("bebek") ||
        text.includes("oyuncak")
      ) {
        return "Çocuk / Bebek";
      }

      return "İncelenecek";
    }

    function getProductIdea(trend) {
      const text = trend.toLowerCase();

      if (
        text.includes("gömlek") ||
        text.includes("pantolon") ||
        text.includes("şort") ||
        text.includes("elbise")
      ) {
        return "Moda ürünü / tekstil";
      }

      if (
        text.includes("iphone") ||
        text.includes("telefon") ||
        text.includes("samsung")
      ) {
        return "Telefon aksesuarı";
      }

      if (
        text.includes("ayakkabı")
      ) {
        return "Ayakkabı / aksesuar";
      }

      if (
        text.includes("çanta")
      ) {
        return "Çanta / moda aksesuarı";
      }

      if (
        text.includes("kahve")
      ) {
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

    const scoredTrends = trends
      .filter(item => item.trend)
      .map(item => {
        const score = calculateScore(
          item.trend,
          item.traffic
        );

        return {
          ...item,
          score,
          category: getCategory(item.trend),
          productIdea: getProductIdea(item.trend)
        };
      })
      .sort((a, b) => b.score - a.score);

    const topTrends = scoredTrends.slice(0, 10);

    const bestScore = topTrends.length
      ? topTrends[0].score
      : 0;

    res.status(200).json({
      success: true,
      country: "TR",
      updatedAt: new Date().toISOString(),
      count: topTrends.length,
      radarScore: bestScore,
      trends: topTrends
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: "Radar verisi alınamadı",
      message: error.message
    });
  }
}
