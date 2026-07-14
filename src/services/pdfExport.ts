import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { supabase } from "../lib/supabase";
import { ANTALYA_REGION, formatCoord, getCenter, parsePolygon } from "./cbs";
import { getTaskStatus } from "./workflowGuard";

function escapeHtml(value: unknown) {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isMissingTaskIdColumn(error: any) {
  const text = [error?.code, error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  return text.includes("task_id") && (text.includes("does not exist") || text.includes("schema cache") || text.includes("pgrst204"));
}

function formatDate(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString("tr-TR");
  }

  return date.toLocaleDateString("tr-TR");
}

function field(label: string, value: unknown, wide = false) {
  return `
    <tr>
      <td class="label">${escapeHtml(label)}</td>
      <td class="${wide ? "value wide" : "value"}">${escapeHtml(value)}</td>
    </tr>
  `;
}

function coordinateRows(points: { latitude: number; longitude: number }[]) {
  return points
    .map(
      (point, index) => `
        <tr>
          <td>${String.fromCharCode(65 + index)}</td>
          <td>${formatCoord(point.latitude)}</td>
          <td>${formatCoord(point.longitude)}</td>
        </tr>
      `,
    )
    .join("");
}

function buildTaskEk8Html(task: any) {
  const center = {
    latitude: Number(task?.latitude || ANTALYA_REGION.latitude),
    longitude: Number(task?.longitude || ANTALYA_REGION.longitude),
  };
  const parcelPolygon = parsePolygon(task?.parcel_polygon, center);
  const greenhousePolygon = parsePolygon(task?.greenhouse_polygon, center);
  const greenhouseCenter = getCenter(greenhousePolygon);
  const description = String(task?.description || "").trim() || "Saha denetimi mobil uygulama üzerinden kaydedilmiştir.";

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
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
          .meta-box { border: 1px solid #94a3b8; padding: 6px 8px; min-height: 28px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; page-break-inside: avoid; }
          th, td { border: 1px solid #94a3b8; padding: 6px 7px; vertical-align: top; }
          th { background: #e5e7eb; text-align: left; font-weight: 800; }
          .label { width: 34%; background: #f8fafc; font-weight: 700; }
          .value { width: 66%; font-weight: 600; }
          .section-title { margin-top: 12px; font-weight: 800; font-size: 12px; }
          .note { min-height: 78px; line-height: 1.45; }
          .signature { display: grid; grid-template-columns: 1fr 1fr; gap: 34px; margin-top: 34px; }
          .signature-box { border-top: 1px solid #111827; text-align: center; padding-top: 8px; min-height: 54px; }
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

        <div class="meta">
          <div class="meta-box"><b>Rapor Tarihi:</b> ${escapeHtml(formatDate(task?.updated_at || task?.created_at))}</div>
          <div class="meta-box"><b>Görev Durumu:</b> ${escapeHtml(getTaskStatus(task))}</div>
        </div>

        <div class="section-title">A. ÜRETİCİ VE ÜNİTE BİLGİLERİ</div>
        <table>
          <tbody>
            ${field("T.C. Kimlik No / VKN", task?.tc_no)}
            ${field("Üretici Adı Soyadı / Ünvanı", task?.producer_name)}
            ${field("Telefon", task?.phone)}
            ${field("İl / İlçe", `${task?.city || "-"} / ${task?.district_name || task?.district || "-"}`)}
            ${field("Mahalle", task?.village)}
            ${field("Ada / Parsel", `${task?.ada_no || "-"} / ${task?.parcel_no || "-"}`)}
            ${field("Ünite No", task?.unit_no)}
            ${field("Kapalı Alan", task?.greenhouse_area ? `${task.greenhouse_area} m²` : "-")}
            ${field("KOBÜKS Kayıtlı Ürün", task?.registered_crop || task?.detected_crop)}
            ${field("Sahada Tespit Edilen Ürün", task?.detected_crop)}
          </tbody>
        </table>

        <div class="section-title">B. DENETİM SONUCU</div>
        <table>
          <tbody>
            ${field("Denetçi", task?.assigned_name || task?.inspector_name || "-")}
            ${field("Uygunluk / Sonuç", task?.compliance_result || getTaskStatus(task))}
            <tr>
              <td class="label">Açıklama</td>
              <td class="value note">${escapeHtml(description).replace(/\n/g, "<br/>")}</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">C. PARSEL KOORDİNATLARI</div>
        <table>
          <thead><tr><th>Nokta</th><th>Enlem</th><th>Boylam</th></tr></thead>
          <tbody>${coordinateRows(parcelPolygon)}</tbody>
        </table>

        <div class="section-title">D. KAPALI ÜRETİM ÜNİTESİ KOORDİNATLARI</div>
        <table>
          <thead><tr><th>Nokta</th><th>Enlem</th><th>Boylam</th></tr></thead>
          <tbody>
            ${coordinateRows(greenhousePolygon)}
            <tr><td>Merkez</td><td>${formatCoord(greenhouseCenter.latitude)}</td><td>${formatCoord(greenhouseCenter.longitude)}</td></tr>
          </tbody>
        </table>

        <div class="signature">
          <div class="signature-box">Denetim Personeli<br/>Adı Soyadı / İmza</div>
          <div class="signature-box">İl / İlçe Müdürlüğü Onayı<br/>Adı Soyadı / İmza</div>
        </div>

        <div class="footer">
          Bu form KOBÜKS kayıtları, Bakanlık CBS katmanları ve saha denetim verileri esas alınarak oluşturulmuştur.
        </div>
      </body>
    </html>
  `;
}

export async function exportTaskPdf(task: any, options: { share?: boolean } = {}) {
  const html = buildTaskEk8Html(task);
  const shouldShare = options.share ?? true;

  const file = await Print.printToFileAsync({ html });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const reportPayload = {
    task_id: task?.id || null,
    unit_no: task?.unit_no || null,
    producer_name: task?.producer_name || null,
    ada_no: task?.ada_no || null,
    parcel_no: task?.parcel_no || null,
    crop_name: task?.detected_crop || null,
    report_payload: task,
    pdf_uri: file.uri,
    created_by: user?.id || null,
  };

  let saved = false;

  try {
    const result = await supabase.from("ek8_reports").insert(reportPayload);

    if (result.error) {
      if (isMissingTaskIdColumn(result.error)) {
        const fallbackPayload = { ...reportPayload };
        delete fallbackPayload.task_id;
        const fallbackResult = await supabase.from("ek8_reports").insert(fallbackPayload);
        saved = !fallbackResult.error;
        if (fallbackResult.error) {
          console.warn("ek8_reports kaydı oluşturulamadı", fallbackResult.error);
        }
      } else {
        console.warn("ek8_reports kaydı oluşturulamadı", result.error);
      }
    } else {
      saved = true;
    }
  } catch (error) {
    console.warn("ek8_reports kaydı oluşturulamadı", error);
  }

  if (shouldShare) {
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/pdf",
      UTI: ".pdf",
    });
  }

  return { uri: file.uri, saved };
}
