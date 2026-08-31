export default async function handler(req, res) {
  try {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 10000);

    let xml = "";

    try {
      const response = await fetch(
        "https://trends.google.com/trending/rss?geo=TR",
        {
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept":
              "application/rss+xml, application/xml, text/xml, */*"
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeout);

      if (response.ok) {
        xml = await response.text();
      }
    } catch {
      clearTimeout(timeout);
    }

    if (!xml || xml.length < 100) {
      return res.status(200).json({
        success: false,
        source: "Google Trends",
        country: "TR",
        updatedAt: new Date().toISOString(),
        count: 0,
        opportunityCount: 0,
        sellableCount: 0,
        testCount: 0,
        trends: [],
        warning: "Google Trends şu anda veri vermiyor."
      });
    }

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

      return match ? clean(match[1]) : "";
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
        /spor ayakkabı|forma|eşofman|spor çanta|spor aksesuar/.test(
          text
        )
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

    function isGundem(trend) {
      const text = trend.toLocaleLowerCase("tr-TR");

      return /maç|maçlar|lig|futbol|basketbol|puan durumu|fikstür|seçim|siyaset|haber|deprem|son dakika|olay/.test(
        text
      );
    }

    function hasProductIntent(trend) {
      const text = trend.toLocaleLowerCase("tr-TR");

      return /keten|gömlek|pantolon|şort|elbise|etek|tekstil|moda|ayakkabı|çanta|takı|aksesuar|telefon|iphone|samsung|xiaomi|tablet|bilgisayar|kulaklık|araba|otomobil|lastik|motor|mobilya|koltuk|masa|kahve|çikolata|gıda|market|ürün|valiz|forma|eşofman/.test(
        text
      );
    }

    function createProductIdea(category, trend) {
      if (category === "Moda / Tekstil") {
        return trend + " odaklı ürün fırsatı";
      }

      if (category === "Teknoloji") {
        return trend + " aksesuarı veya teknoloji ürünü";
      }

      if (category === "Otomotiv") {
        return trend + " aksesuarı veya otomotiv ürünü";
      }

      if (category === "Ev / Yaşam") {
        return trend + " odaklı ev ürünü";
      }

      if (category === "Gıda") {
        return trend + " temalı ticari ürün";
      }

      if (category === "Spor") {
        return trend + " spor ürünü veya aksesuar";
      }

      if (category === "Seyahat") {
        return trend + " seyahat ürünü";
      }

      if (category === "Dijital") {
        return trend + " odaklı dijital ürün";
      }

      return trend + " ile ilgili ticari ürün";
    }

    function classifyTrend(trend, score, category) {
      const productIntent = hasProductIntent(trend);
      const gundem = isGundem(trend);

      // Gündem + ürün olmayan aramalar kesinlikle ticari değil
      if (gundem && !productIntent) {
        return {
          commercial: false,
          signal: "GUNDEM",
          signalLabel: "SADECE GÜNDEM",
          commercialScore: 0,
          productIdea: "Satılabilir ürün sinyali yok"
        };
      }

      // Güçlü ticari sinyal
      if (productIntent && score >= 85) {
        return {
          commercial: true,
          signal: "SELL",
          signalLabel: "SATILABİLİR ÜRÜN",
          commercialScore: score,
          productIdea: createProductIdea(category, trend)
        };
      }

      // Test edilecek fırsat
      if (productIntent && score >= 60) {
        return {
          commercial: true,
          signal: "TEST",
          signalLabel: "POTANSİYEL — TEST ET",
          commercialScore: score,
          productIdea: createProductIdea(category, trend)
        };
      }

      // Takip
      if (productIntent) {
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

    const itemBlocks = xml
      .split(/<item\b/i)
      .slice(1);

    const trends = itemBlocks
      .map((block) => {
        const trend = getTag(block, "title");

        if (!trend) return null;

        const traffic =
          getNamespacedTag(block, "approx_traffic") ||
          getTag(block, "approx_traffic");

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

    trends.sort((a, b) => {
      if (a.commercial !== b.commercial) {
        return a.commercial ? -1 : 1;
      }

      return b.score - a.score;
    });

    const finalTrends = trends.slice(0, 20);

    const opportunityCount =
      finalTrends.filter(
        (item) => item.commercial === true
      ).length;

    const sellableCount =
      finalTrends.filter(
        (item) => item.signal === "SELL"
      ).length;

    const testCount =
      finalTrends.filter(
        (item) => item.signal === "TEST"
      ).length;

    return res.status(200).json({
      success: true,
      source: "Google Trends",
      country: "TR",
      updatedAt: new Date().toISOString(),
      count: finalTrends.length,
      opportunityCount,
      sellableCount,
      testCount,
      trends: finalTrends
    });
  } catch (error) {
    console.error("RADAR ERROR:", error);

    return res.status(200).json({
      success: false,
      source: "Radar",
      country: "TR",
      updatedAt: new Date().toISOString(),
      count: 0,
      opportunityCount: 0,
      sellableCount: 0,
      testCount: 0,
      trends: [],
      warning: "Radar geçici olarak veri alamadı."
    });
  }
}
