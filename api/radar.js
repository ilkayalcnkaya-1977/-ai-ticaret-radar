export default async function handler(req, res) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(
      "https://trends.google.com/trending/rss?geo=TR",
      {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
          Accept: "application/rss+xml, application/xml, text/xml, */*"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Google Trends HTTP ${response.status}`);
    }

    const xml = await response.text();

    if (!xml || !/<item[\s>]/i.test(xml)) {
      throw new Error("Google Trends verisi alınamadı");
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
      ...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)
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

    // TİCARİ KELİMELER
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

    // SPOR / HABER / MAGAZİN FİLTRESİ
    const noiseWords = [
      "maç",
      "maçları",
      "futbol",
      "spor",
      "transfer",
      "puan",
      "skor",
      "lig",

      "son dakika",
      "kimdir",
      "kaç yaşında",
      "nereli",
      "evlendi",

      "seçim",
      "siyaset",
      "başbakan",
      "bakan",
      "cumhurbaşkanı",
      "meclis",

      "yangın",
      "deprem",
      "sel",
      "ölüm",
      "vefat",
      "cenaze",

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

      "carlos alcaraz",
      "benfica - estoril",
      "barcelona vs rayo",
      "barcelona rayo",

      "bahis",
      "bet tv",
      "iptv"
    ];

    function trafficNumber(value) {
      const text = String(value || "")
        .toLowerCase()
        .replace(/\s/g, "")
        .replace(/,/g, ".");

      const match = text.match(/[\d.]+/);

      if (!match) return 0;

      const number = Number.parseFloat(match[0]);

      if (!Number.isFinite(number)) return 0;

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

    function hits(text, words) {
      const lower = String(text || "")
        .toLocaleLowerCase("tr-TR");

      return words.filter(word =>
        lower.includes(word)
      ).length;
    }

    function trafficScore(traffic) {
      const number = trafficNumber(traffic);

      if (number >= 1000000) return 100;
      if (number >= 500000) return 94;
      if (number >= 200000) return 88;
      if (number >= 100000) return 82;
      if (number >= 50000) return 75;
      if (number >= 10000) return 68;
      if (number >= 5000) return 60;
      if (number >= 1000) return 54;

      return 48;
    }

    function calculateScore(trend, traffic) {
      const commercial = hits(
        trend,
        commercialWords
      );

      const noise = hits(
        trend,
        noiseWords
      );

      let score = trafficScore(traffic);

      score += Math.min(commercial, 3) * 12;

      score -= noise * 60;

      if (commercial >= 2) {
        score += 8;
      }

      if (commercial >= 3) {
        score += 5;
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
      const text = String(trend || "")
        .toLocaleLowerCase("tr-TR");

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
          "eşofman"
        ].some(x => text.includes(x))
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
          "pixel",
          "laptop",
          "bilgisayar",
          "tablet",
          "kulaklık",
          "televizyon",
          "ps5",
          "elektronik"
        ].some(x => text.includes(x))
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
        ].some(x => text.includes(x))
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
        ].some(x => text.includes(x))
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
        ].some(x => text.includes(x))
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
        ].some(x => text.includes(x))
      ) {
        return "Ev Yaşam";
      }

      if (
        [
          "bebek",
          "çocuk",
          "oyuncak",
          "mama",
          "bebek arabası"
        ].some(x => text.includes(x))
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
        ].some(x => text.includes(x))
      ) {
        return "Otomotiv / Yakıt";
      }

      return "Diğer Ticari";
    }

    function getProductIdea(trend) {
      const text = String(trend || "")
        .toLocaleLowerCase("tr-TR");

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
          "jean"
        ].some(x => text.includes(x))
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
        ].some(x => text.includes(x))
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
        return "Kahve / ekipman";
      }

      if (
        [
          "parfüm",
          "kozmetik",
          "makyaj",
          "cilt",
          "bakım"
        ].some(x => text.includes(x))
      ) {
        return "Kozmetik / bakım";
      }

      if (
        [
          "bebek",
          "oyuncak",
          "çocuk"
        ].some(x => text.includes(x))
      ) {
        return "Bebek / çocuk ürünü";
      }

      if (
        [
          "ev",
          "mobilya",
          "dekorasyon"
        ].some(x => text.includes(x))
      ) {
        return "Ev yaşam ürünü";
      }

      if (
        [
          "araba",
          "otomobil",
          "motor",
          "motosiklet",
          "lastik",
          "jant"
        ].some(x => text.includes(x))
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
        ].some(x => text.includes(x))
      ) {
        return "Yakıt / otomotiv hizmeti";
      }

      return "Ticari kategori araştırılmalı";
    }

    const scoredTrends = rawTrends
      .map(item => {
        const commercial = hits(
          item.trend,
          commercialWords
        );

        const noise = hits(
          item.trend,
          noiseWords
        );

        return {
          rank: item.rank,
          trend: item.trend,
          traffic: item.traffic || "—",
          score: calculateScore(
            item.trend,
            item.traffic
          ),
          category: getCategory(
            item.trend
          ),
          productIdea: getProductIdea(
            item.trend
          ),
          commercial: commercial > 0,
          noise: noise > 0
        };
      })

      // EN ÖNEMLİ KISIM:
      // Spor/haber değil, yalnızca ticari sinyal.
      .filter(item =>
        item.commercial &&
        !item.noise
      )

      .sort(
        (a, b) =>
          b.score - a.score ||
          a.rank - b.rank
      )

      .slice(0, 10);

    const radarScore =
      scoredTrends.length
        ? Math.max(
            ...scoredTrends.map(
              item =>
                Number(item.score) || 0
            )
          )
        : 0;

    const opportunityCount =
      scoredTrends.filter(
        item => item.score >= 65
      ).length;

    res.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=600"
    );

    return res.status(200).json({
      success: true,
      country: "TR",
      source: "Google Trends Türkiye",
      updatedAt:
        new Date().toISOString(),
      count:
        scoredTrends.length,
      radarScore,
      opportunityCount,
      trends:
        scoredTrends
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

  } finally {
    clearTimeout(timeout);
  }
}
