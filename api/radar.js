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
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
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
      throw new Error(
        "Google Trends verisi boş geldi"
      );
    }

    function decodeHtml(value) {
      return String(value || "")
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

      return match
        ? decodeHtml(match[1])
        : "";
    }

    /*
      GOOGLE TRENDS RSS
      Türkiye'deki güncel trendleri al
    */

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


    /*
      TİCARİ KELİMELER
    */

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
      "market",

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
      "motosiklet",

      "spor ayakkabı",
      "fitness",
      "bisiklet"
    ];


    /*
      TİCARİ OLMAYAN / GÜRÜLTÜLÜ TRENDLER
    */

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
      "hava durumu",

      "ölüm",
      "vefat",

      "dizi",
      "film",
      "sinema",
      "oyuncu",
      "şarkıcı",
      "ünlü",
      "magazin",

      "milli takım",

      "sınav",
      "kpss",
      "yks",
      "tyt",
      "ayt",
      "üniversite",

      "doğa rutkay",
      "carlos alcaraz",
      "justin",
      "beinsports",
      "bein sports",
      "trabzonspor",
      "beşiktaş",
      "galatasaray",
      "fenerbahçe"
    ];


    function getTrafficNumber(value) {
      const text = String(value || "")
        .toLowerCase()
        .replace(/\s/g, "")
        .replace(",", ".");

      const match =
        text.match(/([\d.]+)/);

      if (!match) {
        return 0;
      }

      const number =
        parseFloat(match[1]);

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


    function getCommercialHits(text) {
      const lower =
        String(text || "").toLowerCase();

      return commercialWords.filter(
        word => lower.includes(word)
      ).length;
    }


    function getNoiseHits(text) {
      const lower =
        String(text || "").toLowerCase();

      return noiseWords.filter(
        word => lower.includes(word)
      ).length;
    }


    /*
      TRAFİK SKORU
    */

    function getTrafficScore(traffic) {
      const number =
        getTrafficNumber(traffic);

      if (number >= 1000000) {
        return 100;
      }

      if (number >= 500000) {
        return 94;
      }

      if (number >= 200000) {
        return 88;
      }

      if (number >= 100000) {
        return 82;
      }

      if (number >= 50000) {
        return 75;
      }

      if (number >= 10000) {
        return 68;
      }

      if (number >= 5000) {
        return 60;
      }

      return 50;
    }


    /*
      TİCARİ RADAR SKORU
    */

    function calculateScore(
      trend,
      traffic
    ) {
      const commercialHits =
        getCommercialHits(trend);

      const noiseHits =
        getNoiseHits(trend);

      let score =
        getTrafficScore(traffic);

      /*
        Ticari kelime bonusu
      */

      score +=
        commercialHits * 10;

      /*
        Ticari olmayan içerik cezası
      */

      score -=
        noiseHits * 45;

      /*
        Hiç ticari sinyal yoksa
        puanı aşağı çek
      */

      if (commercialHits === 0) {
        score -= 18;
      }

      /*
        Maç / siyaset / magazin gibi
        tamamen gürültülü içerikleri
        çok daha sert düşür
      */

      if (noiseHits >= 2) {
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


    /*
      KATEGORİ
    */

    function getCategory(trend) {
      const text =
        String(trend || "").toLowerCase();

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
        ].some(word =>
          text.includes(word)
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
        ].some(word =>
          text.includes(word)
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
        ].some(word =>
          text.includes(word)
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
        ].some(word =>
          text.includes(word)
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
        ].some(word =>
          text.includes(word)
        )
      ) {
        return "Gıda / Mutfak";
      }


      if (
        [
          "mobilya",
          "koltuk",
          "masa",
          "sandalye",
          "ev",
          "dekorasyon"
        ].some(word =>
          text.includes(word)
        )
      ) {
        return "Ev Yaşam";
      }


      if (
        [
          "bebek",
          "çocuk",
          "oyuncak"
        ].some(word =>
          text.includes(word)
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
        ].some(word =>
          text.includes(word)
        )
      ) {
        return "Otomotiv";
      }


      return "İncelenecek";
    }


    /*
      ÜRÜN FİKRİ
    */

    function getProductIdea(trend) {
      const text =
        String(trend || "").toLowerCase();


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
          "tshirt"
        ].some(word =>
          text.includes(word)
        )
      ) {
        return "Moda ürünü / tekstil";
      }


      if (
        [
          "iphone",
          "telefon",
          "samsung",
          "xiaomi",
          "oppo",
          "huawei"
        ].some(word =>
          text.includes(word)
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


      if (
        text.includes("laptop") ||
        text.includes("bilgisayar")
      ) {
        return "Bilgisayar aksesuarı";
      }


      if (
        text.includes("araba") ||
        text.includes("otomobil")
      ) {
        return "Otomotiv aksesuarı";
      }


      return "Ticari kategori araştırılmalı";
    }


    /*
      VERİYİ İŞLE
    */

    const scoredTrends =
      rawTrends
        .map(item => {
          const score =
            calculateScore(
              item.trend,
              item.traffic
            );

          const commercialHits =
            getCommercialHits(
              item.trend
            );

          const noiseHits =
            getNoiseHits(
              item.trend
            );

          return {
            rank: item.rank,

            trend: item.trend,

            traffic:
              item.traffic || "—",

            score,

            category:
              getCategory(
                item.trend
              ),

            productIdea:
              getProductIdea(
                item.trend
              ),

            commercial:
              commercialHits > 0,

            noise:
              noiseHits > 0
          };
        });


    /*
      ÖNCE GERÇEK TİCARİ FIRSATLAR
    */

    const commercialTrends =
      scoredTrends
        .filter(item =>
          item.commercial &&
          !item.noise &&
          item.score >= 60
        )
        .sort(
          (a, b) =>
            b.score - a.score
        );


    /*
      TİCARİ SONUÇ YETERSİZSE
      NORMAL TRENDLERDEN TAMAMLA
    */

    const otherTrends =
      scoredTrends
        .filter(item =>
          !commercialTrends.some(
            commercial =>
              commercial.trend ===
              item.trend
          )
        )
        .sort(
          (a, b) =>
            b.score - a.score
        );


    const topTrends = [
      ...commercialTrends,
      ...otherTrends
    ]
      .slice(0, 10);


    /*
      RADAR İSTATİSTİKLERİ
    */

    const radarScore =
      topTrends.length
        ? Math.max(
            ...topTrends.map(
              item =>
                Number(item.score) || 0
            )
          )
        : 0;


    const opportunityCount =
      topTrends.filter(item =>
        item.commercial &&
        !item.noise &&
        item.score >= 65
      ).length;


    /*
      CACHE
      5 dakikada bir güncellensin
    */

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
        "Radar verisi alınamadı",

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
