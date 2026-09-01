export default async function handler(req, res) {
  const now = new Date().toISOString();

  // --------------------------------------------------
  // 1. GÜVENLİ YEDEK TRENDLER
  // --------------------------------------------------

  const fallbackTrends = [
    {
      trend: "keten gömlek",
      traffic: "5000+",
      score: 72,
      category: "Moda / Tekstil",
      commercial: true,
      signal: "TEST",
      signalLabel: "POTANSİYEL — TEST ET",
      commercialScore: 72,
      productIdea: "Keten gömlek"
    },
    {
      trend: "keten pantolon",
      traffic: "2000+",
      score: 65,
      category: "Moda / Tekstil",
      commercial: true,
      signal: "TEST",
      signalLabel: "POTANSİYEL — TEST ET",
      commercialScore: 65,
      productIdea: "Keten pantolon"
    },
    {
      trend: "keten şort",
      traffic: "1000+",
      score: 58,
      category: "Moda / Tekstil",
      commercial: true,
      signal: "WATCH",
      signalLabel: "İZLE",
      commercialScore: 58,
      productIdea: "Keten şort"
    },
    {
      trend: "spor ayakkabı",
      traffic: "10000+",
      score: 80,
      category: "Spor",
      commercial: true,
      signal: "TEST",
      signalLabel: "POTANSİYEL — TEST ET",
      commercialScore: 80,
      productIdea: "Spor ayakkabı veya aksesuar"
    },
    {
      trend: "telefon aksesuarı",
      traffic: "5000+",
      score: 72,
      category: "Teknoloji",
      commercial: true,
      signal: "TEST",
      signalLabel: "POTANSİYEL — TEST ET",
      commercialScore: 72,
      productIdea: "Telefon aksesuarı veya teknoloji ürünü"
    },
    {
      trend: "çanta",
      traffic: "5000+",
      score: 72,
      category: "Moda / Tekstil",
      commercial: true,
      signal: "TEST",
      signalLabel: "POTANSİYEL — TEST ET",
      commercialScore: 72,
      productIdea: "Çanta"
    },
    {
      trend: "yazlık elbise",
      traffic: "2000+",
      score: 65,
      category: "Moda / Tekstil",
      commercial: true,
      signal: "TEST",
      signalLabel: "POTANSİYEL — TEST ET",
      commercialScore: 65,
      productIdea: "Yazlık elbise"
    },
    {
      trend: "ev dekorasyon",
      traffic: "2000+",
      score: 65,
      category: "Ev / Yaşam",
      commercial: true,
      signal: "TEST",
      signalLabel: "POTANSİYEL — TEST ET",
      commercialScore: 65,
      productIdea: "Ev dekorasyon ürünü"
    },
    {
      trend: "kahve",
      traffic: "10000+",
      score: 80,
      category: "Gıda",
      commercial: true,
      signal: "TEST",
      signalLabel: "POTANSİYEL — TEST ET",
      commercialScore: 80,
      productIdea: "Kahve temalı ticari ürün"
    },
    {
      trend: "valiz",
      traffic: "1000+",
      score: 58,
      category: "Seyahat",
      commercial: true,
      signal: "WATCH",
      signalLabel: "İZLE",
      commercialScore: 58,
      productIdea: "Valiz veya seyahat ürünü"
    }
  ];

  // --------------------------------------------------
  // 2. GOOGLE TRENDS RSS
  // --------------------------------------------------

  async function getGoogleTrends() {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 8000);

    try {
      const response = await fetch(
        "https://trends.google.com/trending/rss?geo=TR",
        {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; AI-Ticaret-Radar/1.0)",
            "Accept":
              "application/rss+xml, application/xml, text/xml, */*"
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        return [];
      }

      const xml = await response.text();

      if (!xml || xml.length < 100) {
        return [];
      }

      return parseRSS(xml);
    } catch (error) {
      clearTimeout(timeout);
      return [];
    }
  }

  // --------------------------------------------------
  // 3. RSS PARSER
  // --------------------------------------------------

  function clean(value) {
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
      "<" +
        tag +
        "[^>]*>([\\s\\S]*?)<\\/" +
        tag +
        ">",
      "i"
    );

    const match = block.match(regex);

    return match ? clean(match[1]) : "";
  }

  function getTraffic(block) {
    const namespaced =
      block.match(
        /<(?:[a-zA-Z0-9_-]+:)?approx_traffic[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?approx_traffic>/i
      );

    return namespaced
      ? clean(namespaced[1])
      : "";
  }

  function trafficNumber(value) {
    const text = String(value || "")
      .replace(/\./g, "")
      .replace(/,/g, "");

    const match = text.match(/\d+/);

    return match ? Number(match[0]) : 0;
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

  // --------------------------------------------------
  // 4. KATEGORİ
  // --------------------------------------------------

  function detectCategory(trend) {
    const text = trend.toLocaleLowerCase("tr-TR");

    if (
      /keten|gömlek|pantolon|şort|elbise|etek|tekstil|moda|ayakkabı|çanta|takı|aksesuar/.test(
        text
      )
    ) {
      return "Moda / Tekstil";
    }

    if (
      /telefon|iphone|samsung|xiaomi|tablet|bilgisayar|kulaklık|teknoloji/.test(
        text
      )
    ) {
      return "Teknoloji";
    }

    if (
      /araba|otomobil|otomotiv|lastik|motor/.test(text)
    ) {
      return "Otomotiv";
    }

    if (
      /mobilya|koltuk|masa|sandalye|dekorasyon|ev|yaşam/.test(
        text
      )
    ) {
      return "Ev / Yaşam";
    }

    if (
      /kahve|çikolata|gıda|market|yemek|tatlı|restoran/.test(
        text
      )
    ) {
      return "Gıda";
    }

    if (
      /spor|forma|eşofman|fitness|koşu/.test(text)
    ) {
      return "Spor";
    }

    if (
      /uçak|uçuş|otel|tatil|turizm|seyahat|valiz/.test(text)
    ) {
      return "Seyahat";
    }

    if (
      /instagram|tiktok|youtube|uygulama|yapay zeka|chatgpt/.test(
        text
      )
    ) {
      return "Dijital";
    }

    return "Diğer";
  }

  // --------------------------------------------------
  // 5. TİCARİ ÜRÜN KONTROLÜ
  // --------------------------------------------------

  function hasProductIntent(trend) {
    const text = trend.toLocaleLowerCase("tr-

  function isNews(trend) {
    const text = trend.toLocaleLowerCase("tr-TR");

    return /maç|maçlar|lig|futbol|basketbol|puan durumu|fikstür|seçim|siyaset|haber|deprem|son dakika|olay/.test(
      text
    );
  }

  function
    if (category === "Spor") {
      return trend + " spor ürünü veya aksesuar";
    }

    if (category === "Seyahat") {
      return trend + " seyahat ürünü";
    }

    return trend + " ile ilgili ticari ürün";
  }

  // --------------------------------------------------
  // 6. TREND SINIFLANDIRMA
  // --------------------------------------------------

  function classifyTrend(trend, score, category) {
    const product = hasProductIntent(trend);

    if (isNews(trend) && !product) {
      return {
        commercial: false,
        signal: "GUNDEM",
        signalLabel: "SADECE GÜNDEM",
        commercialScore: 0,
        productIdea: "Satılabilir ürün sinyali yok"
      };
    }

    if (product && score >= 85) {
      return {
        commercial: true,
        signal: "SELL",
        signalLabel: "SATILABİLİR ÜRÜN",
        commercialScore: score,
        productIdea: createProductIdea(category, trend)
      };
    }

    if (product && score >= 60) {
      return {
        commercial: true,
        signal: "TEST",
        signalLabel: "POTANSİYEL — TEST ET",
        commercialScore: score,
        productIdea: createProductIdea(category, trend)
      };
    }

    if (product) {
      return {
        commercial: true,
        signal: "WATCH",
        signalLabel: "İZLE",
        commercialScore: score,
        productIdea: createProductIdea(category, trend)
      };
    }

    return {
      commercial: false,
      signal: "NON_COMMERCIAL",
      signalLabel: "TİCARİ DEĞİL",
      commercialScore: 0,
      productIdea: "Satılabilir ürün sinyali yok"
    };
  }

  // --------------------------------------------------
  // 7. RSS'TEN TRENDLERİ ÇIKAR
  // --------------------------------------------------

  function parseRSS(xml) {
    const blocks = xml
      .split(/<item\b/i)
      .slice(1);

    return blocks
      .map((block) => {
        const trend = getTag(block, "title");

        if (!trend) {
          return null;
        }

        const traffic = getTraffic(block);

        const score = calculateScore(traffic);

        const category = detectCategory(trend);

        const result = classifyTrend(
          trend,
          score,
          category
        );

        return {
          trend,
          traffic: traffic || "—",
          score,
          category,
          commercial: result.commercial,
          signal: result.signal,
          signalLabel: result.signalLabel,
          commercialScore: result.commercialScore,
          productIdea: result.productIdea
        };
      })
      .filter(Boolean);
  }

  // --------------------------------------------------
  // 8. GERÇEK VERİYİ AL
  // --------------------------------------------------

  const liveTrends = await getGoogleTrends();

  let trends =
    liveTrends.length > 0
      ? liveTrends
      : fallbackTrends;

  // --------------------------------------------------
  // 9. TİCARİ OLANLARI ÖNE AL
  // --------------------------------------------------

  trends.sort((a, b) => {
    if (a.commercial !== b.commercial) {
      return a.commercial ? -1 : 1;
    }

    return b.score - a.score;
  });

  trends = trends.slice(0, 20);

  // --------------------------------------------------
  // 10. İSTATİSTİKLER
  // --------------------------------------------------

  const opportunityCount =
    trends.filter(
      (item) => item.commercial === true
    ).length;

  const sellableCount =
    trends.filter(
      (item) => item.signal === "SELL"
    ).length;

  const testCount =
    trends.filter(
      (item) => item.signal === "TEST"
    ).length;

  const bestScore =
    trends.length > 0
      ? Math.max(
          ...trends.map(
            (item) => Number(item.score) || 0
          )
        )
      : 0;

  // --------------------------------------------------
  // 11. CEVAP
  // --------------------------------------------------

  return res.status(200).json({
    success: true,

    source:
      liveTrends.length > 0
        ? "Google Trends"
        : "AI Ticaret Radar — Yedek Veri",

    country: "TR",

    updatedAt: now,

    count: trends.length,

    opportunityCount,

    sellableCount,

    testCount,

    bestScore,

    trends
  });
}
