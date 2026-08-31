export default async function handler(req, res) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 15000);

  try {
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

    if (!xml || !/<item[\s>]/i.test(xml)) {
      throw new Error(
        "Google Trends verisi alınamadı."
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
        .replace(/\s+/g, " ")
        .trim();
    }

    function getTag(item, tag) {
      const match = item.match(
        new RegExp(
          `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
          "i"
        )
      );

      return match ? clean(match[1]) : "";
    }

    const rawTrends = [
      ...xml.matchAll(
        /<item>([\s\S]*?)<\/item>/gi
      )
    ]
      .map((match, index) => ({
        rank: index + 1,
        trend: getTag(match[1], "title"),
        traffic: getTag(
          match[1],
          "ht:approx_traffic"
        )
      }))
      .filter(item => item.trend);

    /*
      ==========================================
      TİCARİ KELİMELER
      ==========================================
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
      "online",
      "e-ticaret",
      "ticaret",

      "telefon",
      "iphone",
      "samsung",
      "xiaomi",
      "oppo",
      "huawei",
      "pixel",

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
      "kot",
      "jean",
      "eşofman",
      "tekstil",
      "keten",

      "parfüm",
      "kozmetik",
      "makyaj",
      "cilt",
      "bakım",
      "şampuan",
      "krem",

      "kahve",
      "çay",
      "gıda",
      "restoran",
      "yemek",

      "mobilya",
      "koltuk",
      "masa",
      "sandalye",
      "ev",
      "dekorasyon",
      "halı",

      "laptop",
      "bilgisayar",
      "tablet",
      "kulaklık",
      "televizyon",
      "elektronik",
      "ps5",

      "bebek",
      "çocuk",
      "oyuncak",
      "mama",
      "bebek arabası",

      "takı",
      "saat",
      "aksesuar",
      "altın",
      "gümüş",

      "araba",
      "otomobil",
      "motor",
      "motosiklet",
      "lastik",
      "jant",
      "yedek parça",

      "mazot",
      "motorin",
      "benzin",
      "akaryakıt",
      "yakıt",
      "şarj"
    ];

    /*
      ==========================================
      SPOR / MAGAZİN / HABER / BAHİS FİLTRESİ
      ==========================================
    */

    const noiseWords = [
      "maç",
      "maçları",
      "futbol",
      "spor",
      "transfer",
      "puan",
      "skor",
      "lig",
      "şampiyon",
      "şampiyonlar",

      "trabzonspor",
      "beşiktaş",
      "galatasaray",
      "fenerbahçe",
      "başakşehir",
      "benfica",
      "estoril",
      "barcelona",
      "rayo",
      "alcaraz",
      "carlos alcaraz",
      "bein sports",
      "beinsports",

      "bahis",
      "bet",
      "bet tv",
      "iptv",

      "son dakika",
      "kimdir",
      "kaç yaşında",
      "nereli",
      "evlendi",
      "boşandı",

      "seçim",
      "siyaset",
      "başbakan",
      "bakan",
      "cumhurbaşkanı",
      "meclis",
      "parti",

      "yangın",
      "deprem",
      "sel",
      "ölüm",
      "vefat",
      "cenaze",
      "kaza",
      "saldırı",

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
      "üniversite"
    ];

    function lower(text) {
      return String(text || "")
        .toLocaleLowerCase("tr-TR");
    }

    function hits(text, words) {
      const value = lower(text);

      return words.filter(word =>
        value.includes(lower(word))
      ).length;
    }

    function trafficNumber(value) {
      const text = lower(value)
        .replace(/\s/g, "")
        .replace(/,/g, ".");

      const match = text.match(/[\d.]+/);

      if (!match) {
        return 0;
      }

      const number = Number.parseFloat(
        match[0]
      );

      if (!Number.isFinite(number)) {
        return 0;
      }

      if (
        text.includes("milyon") ||
        /\d+(?:\.\d+)?m/.test(text)
      ) {
        return number * 1000000;
      }

      if (
        text.includes("bin") ||
        /\d+(?:\.\d+)?k/.test(text)
      ) {
        return number * 1000;
      }

      return number;
    }

    function trafficScore(traffic) {
      const number = trafficNumber(
        traffic
      );

      if (number >= 1000000) return 90;
      if (number >= 500000) return 84;
      if (number >= 200000) return 78;
      if (number >= 100000) return 72;
      if (number >= 50000) return 66;
      if (number >= 10000) return 60;
      if (number >= 5000) return 55;
      if (number >= 1000) return 50;
      if (number >= 500) return 45;
      if (number >= 200) return 40;
      if (number >= 100) return 35;

      return 30;
    }

    /*
      ==========================================
      TİCARİ SKOR
      ==========================================
    */

    function calculateScore(
      trend,
      traffic
    ) {
      const commercial = hits(
        trend,
        commercialWords
      );

      const noise = hits(
        trend,
        noiseWords
      );

      let score = trafficScore(
        traffic
      );

      /*
        Ticari kelime bonusu
      */

      score += Math.min(
        commercial,
        3
      ) * 10;

      /*
        Arama konusu direkt ticariyse
      */

      if (commercial >= 2) {
        score += 8;
      }

      /*
        Gürültü varsa ciddi düşür
      */

      score -= noise * 70;

      /*
        Asla 100'ü geçmesin
      */

      return Math.max(
        0,
        Math.min(
          100,
          Math.round(score)
        )
      );
    }

    /*
      ==========================================
      KATEGORİ
      ==========================================
    */

    function getCategory(trend) {
      const text = lower(trend);

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
          "moda",
          "kot",
          "jean",
          "eşofman",
          "tekstil",
          "keten"
        ].some(x =>
          text.includes(x)
        )
      ) {
        return "Moda / Tekstil";
      }

      if (
        [
          "iphone",
          "telefon",
          "samsung",
          "xiaomi",
          "oppo",
          "huawei",
          "pixel",
          "laptop",
          "bilgisayar",
          "tablet",
          "kulaklık",
          "televizyon",
          "elektronik",
          "ps5"
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
          "aksesuar",
          "altın",
          "gümüş"
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
          "bakım",
          "şampuan",
          "krem"
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
          "market",
          "restoran",
          "yemek"
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
          "dekorasyon",
          "halı"
        ].some(x =>
          text.includes(x)
        )
      ) {
        return "Ev / Yaşam";
      }

      if (
        [
          "bebek",
          "çocuk",
          "oyuncak",
          "mama",
          "bebek arabası"
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
          "motosiklet",
          "lastik",
          "jant",
          "yedek parça",
          "mazot",
          "motorin",
          "benzin",
          "akaryakıt",
          "yakıt",
          "şarj"
        ].some(x =>
          text.includes(x)
        )
      ) {
        return "Otomotiv / Yakıt";
      }

      return "Ticari";
    }

    /*
      ==========================================
      ÜRÜN / İŞ FİKRİ
      ==========================================
    */

    function getProductIdea(trend) {
      const text = lower(trend);

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
          "kot",
          "jean",
          "tekstil",
          "keten"
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
          "huawei",
          "pixel"
        ].some(x =>
          text.includes(x)
        )
      ) {
        return "Telefon aksesuarı";
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
        return "Moda aksesuarı";
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
        return "Kozmetik / bakım";
      }

      if (
        [
          "kahve",
          "çay",
          "gıda",
          "restoran",
          "yemek"
        ].some(x =>
          text.includes(x)
        )
      ) {
        return "Gıda / içecek";
      }

      if (
        [
          "bebek",
          "çocuk",
          "oyuncak",
          "mama"
        ].some(x =>
          text.includes(x)
        )
      ) {
        return "Bebek / çocuk ürünü";
      }

      if (
        [
          "mobilya",
          "ev",
          "dekorasyon"
        ].some(x =>
          text.includes(x)
        )
      ) {
        return "Ev / yaşam ürünü";
      }

      if (
        [
          "araba",
          "otomobil",
          "motor",
          "motosiklet",
          "lastik",
          "jant"
        ].some(x =>
          text.includes(x)
        )
      ) {
        return "Otomotiv ürünü / aksesuar";
      }

      if (
        [
          "mazot",
          "motorin",
          "benzin",
          "akaryakıt",
          "yakıt"
        ].some(x =>
          text.includes(x)
        )
      ) {
        return "Yakıt / otomotiv hizmeti";
      }

      return "Ticari fırsat araştırılmalı";
    }

    /*
      ==========================================
      TRENDLERİ PUANLA
      ==========================================
    */

    const allScored = rawTrends
      .map(item => {
        const commercialHits =
          hits(
            item.trend,
            commercialWords
          );

        const noiseHits =
          hits(
            item.trend,
            noiseWords
          );

        const score =
          calculateScore(
            item.trend,
            item.traffic
          );

        return {
          rank: item.rank,

          trend: item.trend,

          traffic:
            item.traffic ||
            "—",

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
      ==========================================
      1. SADECE TEMİZ TİCARİ TRENDLER
      ==========================================
    */

    const commercialTrends =
      allScored
        .filter(item =>
          item.commercial &&
          !item.noise
        )
        .sort(
          (a, b) =>
            b.score - a.score ||
            a.rank - b.rank
        );

    /*
      ==========================================
      2. 10 TANE YOKSA
      TEMİZ / NÖTR TRENDLERDEN TAMAMLA
      ==========================================
    */

    const neutralTrends =
      allScored
        .filter(item =>
          !item.commercial &&
          !item.noise
        )
        .sort(
          (a, b) =>
            b.score - a.score ||
            a.rank - b.rank
        );

    /*
      Önce gerçek ticari fırsatlar.
      Sonra nötr konular.
      Spor/haber asla alınmaz.
    */

    const finalTrends = [
      ...commercialTrends,
      ...neutralTrends
    ]
      .slice(0, 10)
      .map(item => ({
        ...item,

        /*
          Nötr konuysa ticari skorunu
          daha düşük tut.
        */

        score:
          item.commercial
            ? item.score
            : Math.min(
                item.score,
                35
              ),

        status:
          item.score >= 75
            ? "GÜÇLÜ SİNYAL"
            : item.score >= 55
            ? "AKTİF"
            : "İNCELENECEK"
      }));

    /*
      ==========================================
      RADAR ÖZETİ
      ==========================================
    */

    const strongest =
      finalTrends.length
        ? Math.max(
            ...finalTrends.map(
              item =>
                Number(
                  item.score
                ) || 0
            )
          )
        : 0;

    const commercialCount =
      finalTrends.filter(
        item =>
          item.commercial
      ).length;

    /*
      ==========================================
      CEVAP
      ==========================================
    */

    res.status(200).json({
      ok: true,

      country: "TR",

      updatedAt:
        new Date().toISOString(),

      lastScan:
        "şimdi",

      trendCount:
        finalTrends.length,

      strongestScore:
        strongest,

      commercialCount,

      commercialOpportunities:
        commercialCount,

      trends:
        finalTrends,

      /*
        Frontend eski isimleri
        kullanıyorsa bunlar da çalışır.
      */

      stats: {
        trendCount:
          finalTrends.length,

        strongestScore:
          strongest,

        commercialCount:
          commercialCount
      }
    });
  } catch (error) {
    clearTimeout(timeout);

    console.error(
      "RADAR ERROR:",
      error
    );

    res.status(500).json({
      ok: false,

      error:
        error?.message ||
        "Radar verisi alınamadı.",

      trends: [],

      trendCount: 0,

      strongestScore: 0,

      commercialCount: 0
    });
  }
}
