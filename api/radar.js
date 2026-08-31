export default async function handler(req, res) {
  try {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 15000);

    const response = await fetch(
      "https://trends.google.com/trending/rss?geo=TR",
      {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
          "Accept":
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
      throw new Error(
        "Google Trends verisi alınamadı"
      );
    }

    function clean(value) {
      return String(value || "")
        .replace(/<!\[CDATA\[/gi, "")
        .replace(/\]\]>/gi, "")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&apos;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&#(\d+);/g, (_, n) =>
          String.fromCharCode(Number(n))
        )
        .trim();
    }

    function getTag(item, tag) {
      const regex = new RegExp(
        `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
        "i"
      );

      const match = item.match(regex);

      return match ? clean(match[1]) : "";
    }

    const items = [
      ...xml.matchAll(
        /<item>([\s\S]*?)<\/item>/gi
      )
    ];

    const rawTrends = items
      .slice(0, 50)
      .map((match, index) => {
        const item = match[1];

        return {
          rank: index + 1,
          trend: getTag(item, "title"),
          traffic: getTag(
            item,
            "ht:approx_traffic"
          )
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
      "oppo",
      "huawei",

      "ayakkabı",
      "çanta",
      "elbise",
      "gömlek",
      "pantolon",
      "şort",
      "etek",
      "mont",
      "ceket",
      "kazak",
      "tişört",
      "tshirt",
      "oversize",
      "moda",

      "parfüm",
      "kozmetik",
      "makyaj",
      "cilt",
      "bakım",

      "kahve",
      "çay",
      "gıda",

      "mobilya",
      "koltuk",
      "masa",
      "sandalye",
      "ev",
      "dekorasyon",

      "laptop",
      "bilgisayar",
      "tablet",
      "kulaklık",
      "televizyon",
      "elektronik",

      "bebek",
      "çocuk",
      "oyuncak",

      "takı",
      "saat",
      "aksesuar",

      "araba",
      "otomobil",
      "motor",
      "motosiklet"
    ];

    const noiseWords = [
      "maç",
      "maçları",
      "futbol",
      "spor",
      "transfer",
      "puan",
      "skor",

      "son dakika",
      "kimdir",
      "kaç yaşında",
      "nereli",

      "seçim",
      "siyaset",
      "başbakan",
      "bakan",
      "cumhurbaşkanı",

      "yangın",
      "deprem",
      "sel",

      "ölüm",
      "vefat",

      "dizi",
      "film",
      "sinema",
      "oyuncu",
      "şarkıcı",
      "ünlü",
      "magazin",

      "sınav",
      "kpss",
      "yks",
      "tyt",
      "ayt",
      "üniversite",

      "trabzonspor",
      "beşiktaş",
      "galatasaray",
      "fenerbahçe",
      "beinsports",
      "bein sports",
      "carlos alcaraz"
    ];

    function trafficNumber(value) {
      const text = String(value || "")
        .toLowerCase()
        .replace(/\s/g, "")
        .replace(",", ".");

      const match = text.match(/[\d.]+/);

      if (!match) {
        return 0;
      }

      const number = Number(
        parseFloat(match[0])
      );

      if (
        text.includes("milyon") ||
        /\d+m/.test(text)
      ) {
        return number * 1000000;
      }

      if (
        text.includes("bin") ||
        /\d+k/.test(text)
      ) {
        return number * 1000;
      }

      return number;
    }

    function commercialHits(text) {
      const lower = String(text || "")
        .toLowerCase();

      return commercialWords.filter(
        word => lower.includes(word)
      ).length;
    }

    function noiseHits(text) {
      const lower = String(text || "")
        .toLowerCase();

      return noiseWords.filter(
        word => lower.includes(word)
      ).length;
    }

    function trafficScore(traffic) {
      const number = trafficNumber(
        traffic
      );

      if (number >= 1000000) return 100;
      if (number >= 500000) return 94;
      if (number >= 200000) return 88;
      if (number >= 100000) return 82;
      if (number >= 50000) return 75;
      if (number >= 10000) return 68;
      if (number >= 5000) return 60;

      return 50;
    }

    function calculateScore(
      trend,
      traffic
    ) {
      const commercial =
        commercialHits(trend);

      const noise =
        noiseHits(trend);

      let score =
        trafficScore(traffic);

      score += commercial * 10;

      score -= noise * 45;

      if (commercial === 0) {
        score -= 18;
      }

      if (noise >= 2) {
        score -= 30;
      }

      return Math.max(
        0,
        Math.min(
          100,
          Math.round(score)
        )
      );
    }

    function getCategory(trend) {
      const text =
        String(trend || "")
          .toLowerCase();

      if (
        [
          "gömlek",
          "pantolon",
          "şort",
          "elbise",
          "etek",
          "mont",
          "ceket",
          "kazak",
          "tişört",
          "tshirt",
          "oversize",
          "moda"
        ].some(x =>
          text.includes(x)
        )
      ) {
        return "Moda";
      }

      if (
        [
          "iphone",
          "telefon",
          "samsung",
          "xiaomi",
          "oppo",
          "huawei",
          "laptop",
          "bilgisayar",
          "tablet",
          "kulaklık",
          "televizyon"
        ].some(x =>
          text.includes(x)
        )
      ) {
        return "Elektronik";
      }

      if (
        [
          "ayakkabı",
          "çanta",
          "takı",
          "saat",
          "aksesuar"
        ].some(x =>
          text.includes(x)
        )
      ) {
        return "Aksesuar";
      }

      if (
        [
          "parfüm",
          "kozmetik",
          "makyaj",
          "cilt",
          "bakım"
        ].some(x =>
          text.includes(x)
        )
      ) {
        return "Kozmetik";
      }

      if (
        [
          "kahve",
          "çay",
          "gıda",
          "market"
        ].some(x =>
          text.includes(x)
        )
      ) {
        return "Gıda";
      }

      if (
        [
          "mobilya",
          "koltuk",
          "masa",
          "sandalye",
          "ev",
          "dekorasyon"
        ].some(x =>
          text.includes(x)
        )
      ) {
        return "Ev Yaşam";
      }

      if (
        [
          "bebek",
          "çocuk",
          "oyuncak"
        ].some(x =>
          text.includes(x)
        )
      ) {
        return "Çocuk / Bebek";
      }

      if (
        [
          "araba",
          "otomobil",
          "motor",
          "motosiklet"
        ].some(x =>
          text.includes(x)
        )
      ) {
        return "Otomotiv";
      }

      return "İncelenecek";
    }

    function getProductIdea(trend) {
      const text =
        String(trend || "")
          .toLowerCase();

      if (
        [
          "gömlek",
          "pantolon",
          "şort",
          "elbise",
          "etek",
          "mont",
          "ceket",
          "kazak",
          "tişört",
          "tshirt",
          "oversize"
        ].some(x =>
          text.includes(x)
        )
      ) {
        return "Tekstil / moda ürünü";
      }

      if (
        [
          "iphone",
          "telefon",
          "samsung",
          "xiaomi",
          "oppo",
          "huawei"
        ].some(x =>
          text.includes(x)
        )
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
        return "Kahve / ekipman";
      }

      if (
        text.includes("parfüm") ||
        text.includes("kozmetik")
      ) {
        return "Kozmetik / bakım";
      }

      if (
        text.includes("bebek") ||
        text.includes("oyuncak")
      ) {
        return "Bebek / çocuk ürünü";
      }

      if (
        text.includes("ev") ||
        text.includes("mobilya") ||
        text.includes("dekorasyon")
      ) {
        return "Ev yaşam ürünü";
      }

      if (
        text.includes("araba") ||
        text.includes("otomobil")
      ) {
        return "Otomotiv aksesuarı";
      }

      return "Ticari kategori araştırılmalı";
    }

    const scoredTrends =
      rawTrends.map(item => {
        const score =
          calculateScore(
            item.trend,
            item.traffic
          );

        const commercial =
          commercialHits(item.trend);

        const noise =
          noiseHits(item.trend);

        return {
          rank: item.rank,
          trend: item.trend,
          traffic:
            item.traffic || "—",
          score,
          category:
            getCategory(item.trend),
          productIdea:
            getProductIdea(item.trend),
          commercial:
            commercial > 0,
          noise:
            noise > 0
        };
      });

    const topTrends =
      scoredTrends
        .sort(
          (a, b) =>
            b.score - a.score
        )
        .slice(0, 10);

    const radarScore =
      topTrends.length
        ? Math.max(
            ...topTrends.map(
              x => Number(x.score) || 0
            )
          )
        : 0;

    const opportunityCount =
      topTrends.filter(
        x =>
          x.commercial &&
          !x.noise &&
          x.score >= 65
      ).length;

    res.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=600"
    );

    return res.status(200).json({
      success: true,
      country: "TR",
      source:
        "Google Trends Türkiye",
      updatedAt:
        new Date().toISOString(),
      count:
        topTrends.length,
      radarScore,
      opportunityCount,
      trends:
        topTrends
    });

  } catch (error) {

    console.error(
      "RADAR ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        "Güncel trend verisi alınamadı",
      message:
        error?.name === "AbortError"
          ? "Google Trends zaman aşımına uğradı"
          : error?.message ||
            "Bilinmeyen hata",
      updatedAt:
        new Date().toISOString(),
      trends: []
    });
  }
}
