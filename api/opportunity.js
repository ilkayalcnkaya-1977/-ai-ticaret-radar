export default async function handler(req, res) {
  try {
    const {
      cost = 0,
      sale = 0,
      demand = 50,
      competition = "Orta"
    } = req.query;

    const maliyet = Number(cost);
    const satis = Number(sale);
    const talep = Number(demand);

    if (!maliyet || !satis || maliyet < 0 || satis < 0) {
      return res.status(400).json({
        success: false,
        error: "Maliyet ve satış fiyatı girilmelidir."
      });
    }

    const brutKar = satis - maliyet;

    const marj = satis > 0
      ? (brutKar / satis) * 100
      : 0;

    let rekabetPuani = 60;

    if (competition === "Düşük") {
      rekabetPuani = 90;
    }

    if (competition === "Orta") {
      rekabetPuani = 65;
    }

    if (competition === "Yüksek") {
      rekabetPuani = 35;
    }

    const marjPuani = Math.max(
      0,
      Math.min(100, marj)
    );

    const firsatSkoru = Math.round(
      (talep * 0.4) +
      (marjPuani * 0.4) +
      (rekabetPuani * 0.2)
    );

    let karar = "İNCELENMELİ";

    if (firsatSkoru >= 80) {
      karar = "GÜÇLÜ FIRSAT";
    } else if (firsatSkoru >= 65) {
      karar = "DEĞERLENDİR";
    } else if (firsatSkoru < 45) {
      karar = "ZAYIF FIRSAT";
    }

    res.status(200).json({
      success: true,

      maliyet,
      satis,

      brutKar: Math.round(brutKar),

      marj: Number(marj.toFixed(1)),

      talep,
      rekabet: competition,
      rekabetPuani,

      firsatSkoru,
      karar,

      hesaplama: {
        talepAgirligi: "40%",
        marjAgirligi: "40%",
        rekabetAgirligi: "20%"
      },

      uyari:
        "Bu hesaplama tahmindir; gerçek satış, maliyet ve kâr garantisi değildir."
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
