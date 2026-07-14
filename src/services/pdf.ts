import * as Print
from "expo-print";

export async function createFieldReport({
  engineer,
  parcel,
  detectedCrop,
  registeredCrop,
  riskScore,
}) {
  const html = `
    <html>
      <body style="
        font-family:Arial;
        padding:40px;
      ">
        <h1>TARBİL AI SAHA RAPORU</h1>

        <hr />

        <h2>Mühendis</h2>
        <p>${engineer}</p>

        <h2>Parsel</h2>
        <p>${parcel}</p>

        <h2>Tespit Edilen Ürün</h2>
        <p>${detectedCrop}</p>

        <h2>Kayıtlı Ürün</h2>
        <p>${registeredCrop}</p>

        <h2>Risk Skoru</h2>
        <p>${riskScore}</p>

        <hr />

        <p>
          Bu rapor AI analiz sistemi
          tarafından oluşturulmuştur.
        </p>
      </body>
    </html>
  `;

  return await Print.printToFileAsync({
    html,
  });
}
