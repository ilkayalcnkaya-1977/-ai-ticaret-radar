export default async function handler(req, res) {
  const now = new Date().toISOString();

  const fallbackTrends = [
    { trend: "spor ayakkabı", traffic: "10K+", score: 80 },
    { trend: "telefon aksesuarı", traffic: "5K+", score: 72 },
    { trend: "çanta", traffic: "5K+", score: 72 },
    { trend: "kahve", traffic: "10K+", score: 80 },
    { trend: "ev dekorasyon", traffic: "2K+", score: 65 },
    { trend: "valiz", traffic: "1K+", score: 58 }
  ];

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
      "<(?:[a-zA-Z0-9_-]+:)?" +
        tag +
        "\\b[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9_-]+:)?" +
        tag +
        ">",
      "i"
    );

    const match = block.match(regex);
    return match ? clean(match[1]) : "";
  }

  function getTraffic(block) {
    const match = block.match(
      /<(?:[a-zA-Z0-9_-]+:)?approx_traffic\b[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?approx_traffic>/i
    );

    return match ? clean(match[1]) : "";
  }

  function trafficNumber(value) {
    const text = String(value || "")
      .toUpperCase()
      .replace(/\s/g, "")
      .replace(/,/g, ".");

    const match = text.match(/\d+(?:\.\d+)?/);
    if (!match) return 0;

    let number = Number(match[0]);

    if (text.includes("B")) number *= 1000000000;
    else if (text.includes("M")) number *= 1000000;
    else if (text.includes("K")) number *= 1000;

    return Math.round(number);
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
      /keten|gömlek|pantolon|şort|elbise|etek|tekstil|moda|ayakkabı|çanta|takı|aksesuar|forma|eşofman/.test(
        text
      )
    ) {
      return "Moda / Tekstil";
    }

    if (
      /iphone|ıphone|telefon|samsung|xiaomi|tablet|bilgisayar|laptop|kulaklık|airpods|dyson|teknoloji|kamera/.test(
        text
      )
    ) {
      return "Teknoloji";
    }

    if (
      /araba|otomobil|otomotiv|lastik|motor|motosiklet|scooter|araç/.test(
        text
      )
    ) {
      return "Otomotiv";
    }

    if (
      /mobilya|koltuk|masa|sandalye|dekorasyon|ev|yaşam|mutfak|süpürge/.test(
        text
      )
    ) {
      return "Ev / Yaşam";
    }

    if (
      /kahve|çikolata|gıda|market|yemek|tatlı|restoran|kek|kafe/.test(text)
    ) {
      return "Gıda";
    }

    if (
      /spor|futbol|basketbol|forma|fitness|koşu|galatasaray|fenerbahçe|beşiktaş|trabzonspor/.test(
        text
      )
    ) {
      return "Spor";
    }

    if (/uçak|uçuş|otel|tatil|turizm|seyahat|valiz/.test(text)) {
      return "Seyahat";
    }

    if (
      /instagram|tiktok|youtube|uygulama|yapay zeka|chatgpt|sosyal medya/.test(
        text
      )
    ) {
      return "Dijital";
    }

    return "Diğer";
  }

  function isNews(trend) {
    const text = trend.toLocaleLowerCase("tr-TR");

    return /maç|maçlar|lig|puan durumu|fikstür|seçim|siyaset|haber|deprem|son dakika|olay|kimdir|kaç bölüm|ne zaman başlayacak|istifa/.test(
      text
    );
  }

  function directProductSignal(trend) {
    const text = trend.toLocaleLowerCase("tr-TR");

    return /ayakkabı|çanta|gömlek|pantolon|şort|elbise|etek|takı|aksesuar|telefon|iphone|ıphone|samsung|xiaomi|tablet|bilgisayar|laptop|kulaklık|airpods|araba|otomobil|lastik|motor|motosiklet|scooter|mobilya|koltuk|masa|sandalye|dekorasyon|kahve|çikolata|gıda|yemek|tatlı|spor|forma|eşofman|fitness|koşu|otel|tatil|seyahat|valiz|dyson|kamera/.test(
      text
    );
  }

  function createDirectProductIdea(category, trend) {
    if (category === "Moda / Tekstil") {
      return `${trend} ürünleri ve tamamlayıcı aksesuarlar`;
    }

    if (category === "Teknoloji") {
      return `${trend} için aksesuar ve tamamlayıcı ürünler`;
    }

    if (category === "Otomotiv") {
      return `${trend} aksesuarları ve bakım ürünleri`;
    }

    if (category === "Ev / Yaşam") {
      return `${trend} için ev kullanım ürünleri ve aksesuarlar`;
    }

    if (category === "Gıda") {
      return `${trend} ile ilgili tüketim ve sunum ürünleri`;
    }

    if (category === "Spor") {
      return `${trend} ile ilgili spor ve taraftar aksesuarları`;
    }

    if (category === "Seyahat") {
      return `${trend} için seyahat aksesuarları`;
    }

    return `${trend} ile ilişkili tamamlayıcı ürün`;
  }

  function createDerivedOpportunity(trend, score) {
    const text = trend.toLocaleLowerCase("tr-TR");
    if (/\b\d+\s*(pro|max|ultra|plus)\b|pro max|iphone|ıphone/.test(text)) {
      return {
        opportunity: true,
        category: "Teknoloji",
        signal: "DERIVED",
        signalLabel: "TÜRETİLMİŞ FIRSAT",
        commercialScore: Math.min(95, score + 10),
        productIdea: "Telefon kılıfı, ekran koruyucu, şarj cihazı ve MagSafe aksesuarları",
        reason: "Ürün/model araması tamamlayıcı teknoloji ürünleri için fırsat oluşturabilir."
      };
    }
    if (
  /iphone|ıphone|telefon|samsung|xiaomi|tablet|bilgisayar|laptop|kulaklık|airpods|dyson|teknoloji|kamera|pro max|ultra|plus/.test(
      return {
        opportunity: true,
        category: "Teknoloji",
        signal: "DERIVED",
        signalLabel: "TÜRETİLMİŞ FIRSAT",
        commercialScore: Math.min(95, score + 8),
        productIdea: "Telefon kılıfı, ekran koruyucu, şarj ve MagSafe aksesuarları",
        reason: "Teknoloji ürünü araması ticari tamamlayıcı ürün talebi oluşturabilir."
      };
    }

    if (/dyson|süpürge|robot süpürge/.test(text)) {
      return {
        opportunity: true,
        category: "Ev / Yaşam",
        signal: "DERIVED",
        signalLabel: "TÜRETİLMİŞ FIRSAT",
        commercialScore: Math.min(95, score + 8),
        productIdea: "Süpürge başlığı, filtre, temizlik ve yedek aksesuar ürünleri",
        reason: "Ana ürün çevresinde tamamlayıcı aksesuar ihtiyacı oluşabilir."
      };
    }

    if (/motosiklet|motor|scooter/.test(text)) {
      return {
        opportunity: true,
        category: "Otomotiv",
        signal: "DERIVED",
        signalLabel: "TÜRETİLMİŞ FIRSAT",
        commercialScore: Math.min(95, score + 10),
        productIdea: "Motosiklet telefon tutucu, çanta, yağmur ekipmanı ve bakım aksesuarları",
        reason: "Araç ilgisi aksesuar ve bakım ürünlerine çevrilebilir."
      };
    }

    if (
      /galatasaray|fenerbahçe|beşiktaş|trabzonspor|futbol|basketbol|maç/.test(
        text
      )
    ) {
      return {
        opportunity: true,
        category: "Spor",
        signal: "DERIVED",
        signalLabel: "TÜRETİLMİŞ FIRSAT",
        commercialScore: Math.min(90, score + 5),
        productIdea: "Lisanssız marka kullanımı gerektirmeyen genel taraftar ve maç günü aksesuarları",
        reason: "Spor gündemi taraftar ve maç günü ürünlerine talep oluşturabilir."
      };
    }

    if (/altın|dolar|euro|asgari ücret|emekli/.test(text)) {
      return {
        opportunity: true,
        category: "Finansal İlgi",
        signal: "DERIVED",
        signalLabel: "TÜRETİLMİŞ FIRSAT",
        commercialScore: Math.max(45, score - 5),
        productIdea: "Bütçe dostu tüketim, indirim ve fiyat karşılaştırma odaklı ürün fırsatları",
        reason: "Ekonomik gündem tüketici davranışını fiyat/indirim odaklı değiştirebilir."
      };
    }

    if (/valiz|tatil|seyahat|uçuş|otel/.test(text)) {
      return {
        opportunity: true,
        category: "Seyahat",
        signal: "DERIVED",
        signalLabel: "TÜRETİLMİŞ FIRSAT",
        commercialScore: Math.min(90, score + 8),
        productIdea: "Valiz düzenleyici, seyahat çantası, boyun yastığı ve seyahat aksesuarları",
        reason: "Seyahat ilgisi tamamlayıcı seyahat ürünlerine dönüştürülebilir."
      };
    }

    return null;
  }

  function classifyTrend(trend, score, category) {
    const direct = directProductSignal(trend);

    if (direct) {
      if (score >= 85) {
        return {
          commercial: true,
          signal: "SELL",
          signalLabel: "SATILABİLİR ÜRÜN",
          commercialScore: score,
          productIdea: createDirectProductIdea(category, trend),
          reason: "Doğrudan ürün sinyali ve yüksek trend skoru."
        };
      }

      if (score >= 60) {
        return {
          commercial: true,
          signal: "TEST",
          signalLabel: "POTANSİYEL — TEST ET",
          commercialScore: score,
          productIdea: createDirectProductIdea(category, trend),
          reason: "Doğrudan ürün sinyali var."
        };
      }

      return {
        commercial: true,
        signal: "WATCH",
        signalLabel: "İZLE",
        commercialScore: score,
        productIdea: createDirectProductIdea(category, trend),
        reason: "Ürün sinyali var ancak trend hacmi düşük."
      };
    }

    const derived = createDerivedOpportunity(trend, score);

    if (derived) {
      return {
        commercial: true,
        signal: derived.signal,
        signalLabel: derived.signalLabel,
        commercialScore: derived.commercialScore,
        productIdea: derived.productIdea,
        reason: derived.reason,
        category: derived.category
      };
    }

    if (isNews(trend)) {
      return {
        commercial: false,
        signal: "GUNDEM",
        signalLabel: "SADECE GÜNDEM",
        commercialScore: 0,
        productIdea: "Satılabilir ürün sinyali yeterli değil",
        reason: "Trend haber/gündem ağırlıklı."
      };
    }

    return {
      commercial: false,
      signal: "NON_COMMERCIAL",
      signalLabel: "TİCARİ DEĞİL",
      commercialScore: 0,
      productIdea: "Satılabilir ürün sinyali yok",
      reason: "Yeterli ticari sinyal bulunamadı."
    };
  }

  function parseRSS(xml) {
    const blocks = xml.split(/<item\b/i).slice(1);

    return blocks
      .map((block) => {
        const trend = getTag(block, "title");

        if (!trend) return null;

        const traffic = getTraffic(block);
        const score = calculateScore(traffic);
        const category = detectCategory(trend);
        const result = classifyTrend(trend, score, category);

        return {
          trend,
          traffic: traffic || "—",
          score,
          category: result.category || category,
          commercial: result.commercial,
          signal: result.signal,
          signalLabel: result.signalLabel,
          commercialScore: result.commercialScore,
          productIdea: result.productIdea,
          reason: result.reason
        };
      })
      .filter(Boolean);
  }

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
              "Mozilla/5.0 (compatible; AI-Ticaret-Radar/3.0)",
            Accept:
              "application/rss+xml, application/xml, text/xml, */*"
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeout);

      if (!response.ok) return [];

      const xml = await response.text();

      if (!xml || xml.length < 100) return [];

      return parseRSS(xml);
    } catch (error) {
      clearTimeout(timeout);
      return [];
    }
  }

  try {
    const liveTrends = await getGoogleTrends();

    const usingFallback = liveTrends.length === 0;

    let trends = usingFallback
      ? fallbackTrends.map((item) => {
          const category = detectCategory(item.trend);
          const result = classifyTrend(
            item.trend,
            item.score,
            category
          );

          return {
            ...item,
            category,
            commercial: result.commercial,
            signal: "TEST_DATA",
            signalLabel: "TEST VERİSİ — CANLI VERİ YOK",
            commercialScore: result.commercialScore,
            productIdea: result.productIdea,
            reason: result.reason
          };
        })
      : liveTrends;

    trends.sort((a, b) => {
      if (a.commercial !== b.commercial) {
        return a.commercial ? -1 : 1;
      }

      return (
        Number(b.commercialScore || b.score || 0) -
        Number(a.commercialScore || a.score || 0)
      );
    });

    trends = trends.slice(0, 20);

    const opportunityCount = trends.filter(
      (item) => item.commercial === true
    ).length;

    const sellableCount = trends.filter(
      (item) => item.signal === "SELL"
    ).length;

    const testCount = trends.filter(
      (item) =>
        item.signal === "TEST" ||
        item.signal === "TEST_DATA"
    ).length;

    const derivedCount = trends.filter(
      (item) => item.signal === "DERIVED"
    ).length;

    const bestScore =
      trends.length > 0
        ? Math.max(
            ...trends.map(
              (item) =>
                Number(item.commercialScore) ||
                Number(item.score) ||
                0
            )
          )
        : 0;

    return res.status(200).json({
      success: true,
      source: usingFallback
        ? "AI Ticaret Radar — TEST VERİSİ"
        : "Google Trends",
      live: !usingFallback,
      country: "TR",
      updatedAt: now,
      version: "3.0-commercial",
      count: trends.length,
      opportunityCount,
      sellableCount,
      testCount,
      derivedCount,
      bestScore,
      trends
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      source: "AI Ticaret Radar — TEST VERİSİ",
      live: false,
      country: "TR",
      updatedAt: now,
      version: "3.0-commercial",
      count: fallbackTrends.length,
      opportunityCount: 0,
      sellableCount: 0,
      testCount: fallbackTrends.length,
      derivedCount: 0,
      bestScore: Math.max(
        ...fallbackTrends.map((item) => item.score)
      ),
      trends: fallbackTrends.map((item) => ({
        ...item,
        category: detectCategory(item.trend),
        commercial: false,
        signal: "TEST_DATA",
        signalLabel: "TEST VERİSİ — CANLI VERİ YOK",
        commercialScore: 0,
        productIdea: "Canlı veri bekleniyor",
        reason: "Google Trends verisi alınamadı."
      }))
    });
  }
}
