function calculateOpportunity(){

  const cost = Number(document.getElementById("cost").value);
  const sale = Number(document.getElementById("sale").value);
  const demand = Number(document.getElementById("demand").value);

  const competition =
    document.getElementById("competition").value;

  const result =
    document.getElementById("result");

  if(!cost || !sale || sale <= cost){

    result.style.display = "block";

    result.innerHTML = `
      <div class="result-title">KARAR MOTORU</div>

      <strong>🔴 UZAK DUR</strong>

      <div class="recommend">
        Satış fiyatı maliyetten yüksek olmalı.
      </div>
    `;

    return;
  }

  const profit = sale - cost;

  const margin =
    (profit / sale) * 100;

  let competitionScore = 65;

  if(competition === "Düşük")
    competitionScore = 90;

  if(competition === "Yüksek")
    competitionScore = 40;

  /*
    Ticari fırsat skoru:
    %40 talep
    %40 kâr marjı
    %20 rekabet
  */

  const marginScore =
    Math.min(margin * 2, 100);

  const opportunityScore = Math.round(
    demand * 0.40 +
    marginScore * 0.40 +
    competitionScore * 0.20
  );

  let decision = "";
  let emoji = "";

  if(opportunityScore >= 80){

    decision = "AL";
    emoji = "🟢";

  }else if(opportunityScore >= 60){

    decision = "TEST ET";
    emoji = "🟡";

  }else if(opportunityScore >= 40){

    decision = "İNCELE";
    emoji = "🟠";

  }else{

    decision = "UZAK DUR";
    emoji = "🔴";

  }

  result.style.display = "block";

  result.innerHTML = `

    <div class="result-title">
      TİCARİ KARAR MOTORU
    </div>

    <strong>
      ${emoji} ${decision}
    </strong>

    <div class="recommend">

      <b>Fırsat skoru:</b>
      ${opportunityScore}/100
      <br><br>

      <b>Ürün maliyeti:</b>
      ${cost.toLocaleString("tr-TR")} TL
      <br>

      <b>Satış fiyatı:</b>
      ${sale.toLocaleString("tr-TR")} TL
      <br>

      <b>Birim kâr:</b>
      ${profit.toLocaleString("tr-TR")} TL
      <br>

      <b>Kâr marjı:</b>
      ${margin.toFixed(1)}%
      <br>

      <b>Talep:</b>
      ${demand}/100
      <br>

      <b>Rekabet:</b>
      ${competition}

      <br><br>

      <b>Karar:</b>
      ${decision === "AL"
        ? "Güçlü ticari sinyal. Ürün ciddi şekilde değerlendirilebilir."
        : decision === "TEST ET"
        ? "Potansiyel var. Önce küçük stokla test etmek daha güvenli."
        : decision === "İNCELE"
        ? "Sinyal orta seviyede. Maliyet ve talep tekrar kontrol edilmeli."
        : "Risk yüksek. Bu ürüne şu aşamada girme."
      }

    </div>
  `;
}
