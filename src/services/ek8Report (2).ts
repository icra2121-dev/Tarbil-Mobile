import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { supabase } from "../lib/supabase";
import { CbsUnit, STATUS_LABEL, formatArea, formatCoord, getCenter } from "./cbs";

export type Ek8ReportRecord = {
  id: string;
  task_id?: string;
  unit_no?: string;
  producer_name?: string;
  ada_no?: string;
  parcel_no?: string;
  crop_name?: string;
  pdf_uri?: string;
  report_payload?: any;
  created_at?: string;
};

function escapeHtml(value: unknown) {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function coordinateRows(title: string, points: { latitude: number; longitude: number }[]) {
  return `
    <div class="section-title">${title}</div>
    <table>
      <thead>
        <tr><th>Nokta</th><th>Enlem</th><th>Boylam</th></tr>
      </thead>
      <tbody>
        ${points
          .map(
            (point, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${formatCoord(point.latitude)}</td>
                <td>${formatCoord(point.longitude)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export function buildEk8Html(unit: CbsUnit) {
  const center = getCenter(unit.greenhousePolygon);

  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          @page { size: A4; margin: 18mm 16mm; }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #111827; font-size: 11px; }
          .header { text-align: center; margin-bottom: 14px; line-height: 1.35; }
          .tc { font-weight: 700; letter-spacing: 0.5px; }
          .ministry { font-weight: 700; font-size: 13px; margin-top: 4px; }
          .unit { font-size: 11px; margin-top: 4px; }
          .title { font-weight: 800; font-size: 16px; margin-top: 8px; }
          .section-title { margin-top: 12px; font-weight: 800; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; page-break-inside: avoid; }
          th, td { border: 1px solid #94a3b8; padding: 6px 7px; text-align: left; vertical-align: top; }
          th { background: #e5e7eb; font-weight: 800; }
          .label { width: 34%; background: #f8fafc; font-weight: 700; }
          .value { width: 66%; font-weight: 600; }
          .signature { display: grid; grid-template-columns: 1fr 1fr; gap: 34px; margin-top: 34px; }
          .signature div { border-top: 1px solid #111827; padding-top: 8px; text-align: center; min-height: 54px; }
          .footer { margin-top: 18px; color: #475569; font-size: 9px; line-height: 1.35; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="tc">T.C.</div>
          <div class="ministry">TARIM VE ORMAN BAKANLIĞI</div>
          <div class="unit">KAPALI ORTAMDA BİTKİSEL ÜRETİM</div>
          <div class="title">DENETİM FORMU (EK-8)</div>
        </div>

        <div class="section-title">A. ÜRETİCİ VE ÜNİTE BİLGİLERİ</div>
        <table>
          <tbody>
            <tr><td class="label">T.C. Kimlik No / VKN</td><td class="value">${escapeHtml(unit.producerTc)}</td></tr>
            <tr><td class="label">Üretici Adı Soyadı / Ünvanı</td><td class="value">${escapeHtml(unit.producerName)}</td></tr>
            <tr><td class="label">Kayıt No</td><td class="value">${escapeHtml(unit.registrationNo)}</td></tr>
            <tr><td class="label">İl / İlçe</td><td class="value">${escapeHtml(`${unit.city} / ${unit.district}`)}</td></tr>
            <tr><td class="label">Mahalle</td><td class="value">${escapeHtml(unit.village)}</td></tr>
            <tr><td class="label">Ada / Parsel</td><td class="value">${escapeHtml(`${unit.adaNo} / ${unit.parcelNo}`)}</td></tr>
            <tr><td class="label">Ünite No</td><td class="value">${escapeHtml(unit.unitNo)}</td></tr>
            <tr><td class="label">Kapalı Alan</td><td class="value">${escapeHtml(formatArea(unit.greenhouseArea))}</td></tr>
            <tr><td class="label">Ürün</td><td class="value">${escapeHtml(unit.crop)}</td></tr>
            <tr><td class="label">Durum</td><td class="value">${escapeHtml(STATUS_LABEL[unit.status])}</td></tr>
            <tr><td class="label">Ünite Merkez</td><td class="value">${formatCoord(center.latitude)}, ${formatCoord(center.longitude)}</td></tr>
          </tbody>
        </table>

        <div class="section-title">B. PARSEL VE ÜNİTE KOORDİNATLARI</div>
        ${coordinateRows("Parsel Koordinatları", unit.parcelPolygon)}
        ${coordinateRows("Kapalı Üretim Ünitesi Koordinatları", unit.greenhousePolygon)}

        <div class="signature">
          <div>Denetim Personeli<br/>Adı Soyadı / İmza</div>
          <div>İl / İlçe Müdürlüğü Onayı<br/>Adı Soyadı / İmza</div>
        </div>

        <div class="footer">
          Bu form KOBÜKS kayıtları, Bakanlık CBS katmanları ve saha denetim verileri esas alınarak oluşturulmuştur.
        </div>
      </body>
    </html>
  `;
}

export async function createEk8PdfFromUnit(unit: CbsUnit) {
  const html = buildEk8Html(unit);
  const file = await Print.printToFileAsync({ html });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const result = await supabase.from("ek8_reports").insert({
      greenhouse_unit_id: unit.greenhouseUnitId || null,
      unit_no: unit.unitNo,
      producer_name: unit.producerName,
      ada_no: unit.adaNo,
      parcel_no: unit.parcelNo,
      crop_name: unit.crop,
      report_payload: unit,
      pdf_uri: file.uri,
      created_by: user?.id || null,
    });

    if (result.error) {
      console.warn("ek8_reports kaydı oluşturulamadı", result.error);
    }
  } catch (error) {
    console.warn("ek8_reports kaydı oluşturulamadı", error);
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: "application/pdf",
    UTI: ".pdf",
  });

  return file.uri;
}

export async function getRecentEk8Reports(): Promise<Ek8ReportRecord[]> {
  const result = await supabase
    .from("ek8_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(25);

  if (result.error) {
    return [];
  }

  return result.data || [];
}

export async function getLatestEk8ReportForTask(taskId: string): Promise<Ek8ReportRecord | null> {
  if (!taskId) {
    return null;
  }

  const result = await supabase
    .from("ek8_reports")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    return null;
  }

  return result.data || null;
}

export async function shareEk8ReportPdf(report: Ek8ReportRecord) {
  if (report.pdf_uri) {
    await Sharing.shareAsync(report.pdf_uri, {
      mimeType: "application/pdf",
      UTI: ".pdf",
    });
  }
}
