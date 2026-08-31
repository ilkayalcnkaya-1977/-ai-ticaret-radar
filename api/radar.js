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
          "User-Agent": "Mozilla/5.0",
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
      throw new Error(
        "Google Trends veri döndürmedi."
      );
    }

    function clean(value) {
      return String(value || "")
        .replace(
          /<!\[CDATA\[(.*?)\]\]>/gs,
          "$1"
        )
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

      return match
        ? clean(match[1])
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
        ? clean(match[1])
        : "";
    }

    function trafficNumber(value) {
      const text = String(value || "")
        .replace(/\./g, "")
        .replace(/,/g, "");

      const match = text.match(/\d+/);

      return match
        ? Number(match[0])
        : 0;
    }

    function calculateScore(traffic) {
      const number =
        trafficNumber(traffic);

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
      const text =
        trend.toLocaleLowerCase("tr-TR");

      if (
        /keten|gömlek|pantolon|şort|elbise|etek|ayakkabı|çanta|mont|ceket|tekstil|kumaş|tişört|sweatshirt|hoodie|takım|eşofman|forma|takı|kolye|bileklik|çorap/.test(
          text
        )
      ) {
        return "Moda / Tekstil";
      }

      if (
        /telefon|iphone|samsung|xiaomi|tablet|bilgisayar|airpods|kulaklık|kamera|şarj|powerbank|klavye|mouse|playstation|xbox|konsol/.test(
          text
        )
      ) {
        return "Teknoloji";
      }

      if (
        /araba|otomobil|otomotiv|lastik|motor|motosiklet|araç|akü/.test(
          text
        )
      ) {
        return "Otomotiv";
      }

      if (
        /mobilya|koltuk|masa|sandalye|dekorasyon|mutfak|beyaz eşya|halı|perde|aydınlatma|yatak|ev/.test(
          text
        )
      ) {
        return "Ev / Yaşam";
      }

      if (
        /kahve|çikolata|gıda|market|yemek|tatlı|içecek|atıştırmalık/.test(
          text
        )
      ) {
        return "Gıda";
      }

      if (
        /fitness|koşu|basketbol|futbol|voleybol|tenis|spor|kamp|bisiklet/.test(
          text
        )
      ) {
        return "Spor";
      }

      if (
        /tatil|otel|uçak|seyahat|turizm|valiz|kabin/.test(
          text
        )
      ) {
        return "Seyahat";
      }

      if (
        /uygulama|yazılım|yapay zeka|internet|chatgpt|saas/.test(
          text
        )
      ) {
        return "Dijital";
      }

      return "Genel Trend";
    }

    function hasProductIntent(trend) {
      const text =
        trend.toLocaleLowerCase("tr-TR");

      return /keten|gömlek|pantolon|şort|elbise|etek|ayakkabı|çanta|mont|ceket|tekstil|kumaş|tişört|sweatshirt|hoodie|takım|eşofman|forma|takı|kolye|bileklik|çorap|telefon|iphone|samsung|xiaomi|tablet|bilgisayar|airpods|kulaklık|kamera|şarj|powerbank|klavye|mouse|lastik|akü|motosiklet|otomobil|araba|motor|mobilya|koltuk|masa|sandalye|dekorasyon|mutfak|halı|perde|yatak|kahve|çikolata|gıda|atıştırmalık|fitness|koşu|bisiklet|kamp|valiz/.test(
        text
      );
    }

    function isGundem(trend) {
      const text =
        trend.toLocaleLowerCase("tr-TR");

      return /maç|maçları|lig|fikstür|puan durumu|transfer|şampiyonlar ligi|premier lig|son dakika|haber|kimdir|kaç yaşında|hangi kanalda|canlı skor|skor|cumhurbaşkanı|bakan|seçim|parti|milletvekili|deprem|yangın|hava durumu|ölüm|vefat|dizi|film|fragman|oyuncu|ünlü|şarkıcı/.test(
        text
      );
    }

    function createProductIdea(
      category,
      trend
    ) {
      if (category === "Moda / Tekstil") {
        return (
          trend +
          " ürünleri, aksesuar veya tekstil"
        );
      }

      if (category === "Teknoloji") {
        return (
          trend +
          " aksesuarı veya teknoloji ürünü"
        );
      }

      if (category === "Otomotiv") {
        return (
          trend +
          " aksesuarı veya otomotiv ürünü"
        );
      }

      if (category === "Ev / Yaşam") {
        return (
          trend +
          " odaklı ev ürünü"
        );
      }

      if (category === "Gıda") {
        return (
          trend +
          " temalı gıda ürünü"
        );
      }

      if (category === "Spor") {
        return (
          trend +
          " spor ürünü veya aksesuar"
        );
      }

      if (category === "Seyahat") {
        return (
          trend +
          " seyahat ürünü veya aksesuar"
        );
      }

      if (category === "Dijital") {
        return (
          trend +
          " odaklı dijital ürün"
        );
      }

      return (
        trend +
        " ile ilgili ticari ürün"
      );
    }

    function classifyTrend(
      trend,
      score,
      category
    ) {
      const productIntent =
        hasProductIntent(trend);

      const gundem =
        isGundem(trend);

      if (
        gundem &&
        !productIntent
      ) {
        return {
          commercial: false,
          signal: "GUNDEM",
          signalLabel: "SADECE GÜNDEM",
          commercialScore: 0,
          productIdea:
            "Satılabilir ürün sinyali yok"
        };
      }

      if (productIntent) {
        if (score >= 85) {
          return {
            commercial: true,
            signal: "SELL",
            signalLabel:
              "SATILABİLİR ÜRÜN",
            commercialScore: score,
            productIdea:
              createProductIdea(
                category,
                trend
              )
          };
        }

        if (score >= 60) {
          return {
            commercial: true,
            signal: "TEST",
            signalLabel:
              "POTANSİYEL — TEST ET",
            commercialScore: score,
            productIdea:
              createProductIdea(
                category,
                trend
              )
          };
        }

        return {
          commercial: true,
          signal: "WATCH",
          signalLabel: "İZLE",
          commercialScore: score,
          productIdea:
            createProductIdea(
              category,
              trend
            )
        };
      }

      return {
        commercial: false,
        signal: "NON_COMMERCIAL",
        signalLabel: "TİCARİ DEĞİL",
        commercialScore: 0,
        productIdea:
          "Satılabilir ürün sinyali bulunamadı"
      };
    }

    const itemBlocks =
      xml.match(
        /<item[\s\S]*?<\/item>/gi
      ) || [];

    const trends =
      itemBlocks
        .map((block) => {
          const trend =
            getTag(
              block,
              "title"
            );

          if (!trend) {
            return null;
          }

          const traffic =
            getNamespacedTag(
              block,
              "approx_traffic"
            );

          const score =
            calculateScore(
              traffic
            );

          const category =
            detectCategory(
              trend
            );

          const result =
            classifyTrend(
              trend,
              score,
              category
            );

          return {
            trend: trend,

            traffic:
              traffic || "—",

            score: score,

            category:
              result.commercial
                ? category
                : "Sadece Gündem",

            commercial:
              result.commercial,

            signal:
              result.signal,

            signalLabel:
              result.signalLabel,

            commercialScore:
              result.commercialScore,

            productIdea:
              result.productIdea
          };
        })
        .filter(Boolean);

    if (!trends.length) {
      throw new Error(
        "Google Trends verisi bulunamadı."
      );
    }

    trends.sort((a, b) => {
      if (
        a.commercial !==
        b.commercial
      ) {
        return a.commercial
          ? -1
          : 1;
      }

      return b.score - a.score;
    });

    const commercialTrends = trends
  .filter(item => item.commercial === true);

const finalTrends = commercialTrends.length
  ? commercialTrends.slice(0, 20)
  : trends
      .filter(item => item.signal !== "GUNDEM")
      .slice(0, 20);

    const opportunityCount =
      finalTrends.filter(
        item =>
          item.commercial === true
      ).length;

    const sellableCount =
      finalTrends.filter(
        item =>
          item.signal === "SELL"
      ).length;

    const testCount =
      finalTrends.filter(
        item =>
          item.signal === "TEST"
      ).length;

    return res.status(200).json({
      success: true,

      source:
        "Google Trends",

      country:
        "TR",

      updatedAt:
        new Date().toISOString(),

      count:
        finalTrends.length,

      opportunityCount,

      sellableCount,

      testCount,

      trends:
        finalTrends
    });

  } catch (error) {
    console.error(
      "RADAR ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Radar verisi alınamadı.",

      error:
        error?.message ||
        "Bilinmeyen hata"
    });
  }
}
