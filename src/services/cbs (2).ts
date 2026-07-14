import { supabase } from "../lib/supabase";

export type UnitStatus = "aktif" | "inceleme" | "ihlal" | "taslak";

export type MapPoint = {
  latitude: number;
  longitude: number;
};

export type CbsUnit = {
  id: string;
  cbsUnitId?: string;
  greenhouseUnitId?: string;
  producerId?: string;
  producerName: string;
  producerTc: string;
  producerPhone?: string;
  registrationNo: string;
  unitNo: string;
  city: string;
  district: string;
  village: string;
  adaNo: string;
  parcelNo: string;
  crop: string;
  greenhouseArea: number;
  status: UnitStatus;
  violationNote?: string;
  parcelPolygon: MapPoint[];
  greenhousePolygon: MapPoint[];
};

export const ANTALYA_REGION = {
  latitude: 36.8969,
  longitude: 30.7133,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export const STATUS_LABEL: Record<UnitStatus, string> = {
  aktif: "Kayıtlı sera",
  inceleme: "Denetime gidilecek",
  ihlal: "Riskli sera",
  taslak: "Eksik bilgi",
};

export const STATUS_COLOR: Record<UnitStatus, string> = {
  aktif: "#22c55e",
  inceleme: "#38bdf8",
  ihlal: "#ef4444",
  taslak: "#f59e0b",
};

const SAMPLE_UNITS: CbsUnit[] = [
  {
    id: "sample-1",
    producerName: "Örnek Üretici",
    producerTc: "00000000000",
    producerPhone: "05321234567",
    registrationNo: "KOBUKS-2026-001",
    unitNo: "KU-001",
    city: "Antalya",
    district: "Aksu",
    village: "Kundu",
    adaNo: "215",
    parcelNo: "14",
    crop: "Domates",
    greenhouseArea: 12840,
    status: "aktif",
    parcelPolygon: [
      { latitude: 36.9011, longitude: 30.7079 },
      { latitude: 36.9011, longitude: 30.7132 },
      { latitude: 36.8976, longitude: 30.7132 },
      { latitude: 36.8976, longitude: 30.7079 },
    ],
    greenhousePolygon: [
      { latitude: 36.9004, longitude: 30.709 },
      { latitude: 36.9004, longitude: 30.7121 },
      { latitude: 36.8983, longitude: 30.7121 },
      { latitude: 36.8983, longitude: 30.709 },
    ],
  },
  {
    id: "sample-2",
    producerName: "KOBÜKS Sera İşletmesi",
    producerTc: "11111111111",
    producerPhone: "05329876543",
    registrationNo: "KOBUKS-2026-002",
    unitNo: "KU-002",
    city: "Antalya",
    district: "Serik",
    village: "Belek",
    adaNo: "82",
    parcelNo: "9",
    crop: "Biber",
    greenhouseArea: 9200,
    status: "ihlal",
    violationNote: "CBS sınırı ile beyan edilen kapalı alan uyumsuz.",
    parcelPolygon: [
      { latitude: 36.8664, longitude: 31.0472 },
      { latitude: 36.8664, longitude: 31.0515 },
      { latitude: 36.8638, longitude: 31.0515 },
      { latitude: 36.8638, longitude: 31.0472 },
    ],
    greenhousePolygon: [
      { latitude: 36.8659, longitude: 31.048 },
      { latitude: 36.8659, longitude: 31.0508 },
      { latitude: 36.8644, longitude: 31.0508 },
      { latitude: 36.8644, longitude: 31.048 },
    ],
  },
  {
    id: "sample-3",
    producerName: "Aksu Sera Kooperatifi",
    producerTc: "22222222222",
    producerPhone: "05335551122",
    registrationNo: "KOBUKS-2026-003",
    unitNo: "KU-003",
    city: "Antalya",
    district: "Aksu",
    village: "Sarısu",
    adaNo: "310",
    parcelNo: "27",
    crop: "Salatalık",
    greenhouseArea: 7600,
    status: "inceleme",
    parcelPolygon: [
      { latitude: 36.9192, longitude: 30.7561 },
      { latitude: 36.9192, longitude: 30.7609 },
      { latitude: 36.9159, longitude: 30.7609 },
      { latitude: 36.9159, longitude: 30.7561 },
    ],
    greenhousePolygon: [
      { latitude: 36.9186, longitude: 30.757 },
      { latitude: 36.9186, longitude: 30.7598 },
      { latitude: 36.9167, longitude: 30.7598 },
      { latitude: 36.9167, longitude: 30.757 },
    ],
  },
  {
    id: "sample-4",
    producerName: "Aksu Merkez Üretici",
    producerTc: "33333333333",
    producerPhone: "05337778899",
    registrationNo: "KOBUKS-2026-004",
    unitNo: "KU-004",
    city: "Antalya",
    district: "Aksu",
    village: "Kadriye",
    adaNo: "148",
    parcelNo: "6",
    crop: "Patlıcan",
    greenhouseArea: 5400,
    status: "taslak",
    parcelPolygon: [
      { latitude: 36.8802, longitude: 30.8014 },
      { latitude: 36.8802, longitude: 30.8054 },
      { latitude: 36.8774, longitude: 30.8054 },
      { latitude: 36.8774, longitude: 30.8014 },
    ],
    greenhousePolygon: [
      { latitude: 36.8797, longitude: 30.8021 },
      { latitude: 36.8797, longitude: 30.8045 },
      { latitude: 36.8781, longitude: 30.8045 },
      { latitude: 36.8781, longitude: 30.8021 },
    ],
  },
];

export function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toStatus(value: unknown): UnitStatus {
  const text = String(value || "").toLocaleLowerCase("tr-TR");
  if (text.includes("ihlal")) return "ihlal";
  if (text.includes("inceleme") || text.includes("saha")) return "inceleme";
  if (text.includes("aktif")) return "aktif";
  return "taslak";
}

export function buildFallbackPolygon(center: MapPoint): MapPoint[] {
  const delta = 0.0012;
  return [
    { latitude: center.latitude + delta, longitude: center.longitude - delta },
    { latitude: center.latitude + delta, longitude: center.longitude + delta },
    { latitude: center.latitude - delta, longitude: center.longitude + delta },
    { latitude: center.latitude - delta, longitude: center.longitude - delta },
  ];
}

export function parsePolygon(value: unknown, center: MapPoint): MapPoint[] {
  if (typeof value === "string") {
    try {
      return parsePolygon(JSON.parse(value), center);
    } catch {
      return buildFallbackPolygon(center);
    }
  }

  if (Array.isArray(value)) {
    const points = value
      .map((item) => ({
        latitude: toNumber(item?.latitude ?? item?.lat, NaN),
        longitude: toNumber(item?.longitude ?? item?.lng, NaN),
      }))
      .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));

    if (points.length >= 3) return points;
  }

  return buildFallbackPolygon(center);
}

export function getCenter(points: MapPoint[]) {
  if (!points.length) {
    return {
      latitude: ANTALYA_REGION.latitude,
      longitude: ANTALYA_REGION.longitude,
    };
  }

  const total = points.reduce(
    (sum, point) => ({
      latitude: sum.latitude + point.latitude,
      longitude: sum.longitude + point.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: total.latitude / points.length,
    longitude: total.longitude / points.length,
  };
}

export function formatArea(value: number) {
  return `${Math.round(value).toLocaleString("tr-TR")} m²`;
}

export function formatCoord(value: number) {
  return value.toFixed(6);
}

async function fetchAllRows<T>(table: string, pageSize = 1000): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const result = await supabase.from(table).select("*").range(from, to);

    if (result.error) {
      throw result.error;
    }

    const page = (result.data || []) as T[];
    rows.push(...page);

    if (page.length < pageSize) {
      return rows;
    }
  }
}

function normalizeLegacyUnit(raw: any): CbsUnit {
  const center = {
    latitude: toNumber(raw.latitude ?? raw.lat ?? raw.unit_latitude, ANTALYA_REGION.latitude),
    longitude: toNumber(raw.longitude ?? raw.lng ?? raw.unit_longitude, ANTALYA_REGION.longitude),
  };

  return {
    id: String(raw.id ?? raw.unit_no ?? raw.task_id ?? Date.now()),
    producerName: String(raw.producer_name ?? raw.full_name ?? raw.name ?? "Üretici"),
    producerTc: String(raw.tc_no ?? raw.producer_tc ?? raw.producer_identity ?? "-"),
    producerPhone: String(raw.phone ?? raw.producer_phone ?? ""),
    registrationNo: String(raw.registration_no ?? raw.kobuks_no ?? raw.unit_no ?? "-"),
    unitNo: String(raw.unit_no ?? raw.greenhouse_no ?? "-"),
    city: String(raw.city ?? raw.province ?? raw.il ?? "-"),
    district: String(raw.district_name ?? raw.district ?? raw.ilce ?? "-"),
    village: String(raw.village ?? raw.neighborhood ?? raw.mahalle ?? "-"),
    adaNo: String(raw.ada_no ?? raw.block_no ?? raw.ada ?? "-"),
    parcelNo: String(raw.parcel_no ?? raw.parsel ?? "-"),
    crop: String(raw.detected_crop ?? raw.crop_name ?? raw.crop ?? "-"),
    greenhouseArea: toNumber(raw.greenhouse_area ?? raw.area_m2 ?? raw.area),
    status: toStatus(raw.registration_status ?? raw.workflow_status ?? raw.status),
    violationNote: raw.violation_note ?? raw.violationNote ?? undefined,
    parcelPolygon: parsePolygon(raw.parcel_polygon ?? raw.parcelPolygon ?? raw.polygon, center),
    greenhousePolygon: parsePolygon(raw.greenhouse_polygon ?? raw.greenhousePolygon ?? raw.unit_polygon, center),
  };
}

function normalizeGreenhouseUnit(raw: any, parcel: any, producer: any, crop: any): CbsUnit {
  const center = {
    latitude: toNumber(raw.latitude ?? raw.lat, ANTALYA_REGION.latitude),
    longitude: toNumber(raw.longitude ?? raw.lng, ANTALYA_REGION.longitude),
  };

  return {
    id: String(raw.id ?? raw.unit_no),
    cbsUnitId: raw.cbs_unit_id,
    greenhouseUnitId: raw.id,
    producerId: raw.producer_id,
    producerName: String(producer?.full_name ?? raw.producer_name ?? "Üretici"),
    producerTc: String(producer?.tc_no ?? raw.producer_tc ?? "-"),
    producerPhone: String(producer?.phone ?? raw.phone ?? ""),
    registrationNo: String(raw.registration_no ?? raw.unit_no ?? "-"),
    unitNo: String(raw.unit_no ?? "-"),
    city: String(parcel?.city ?? producer?.city ?? raw.city ?? "-"),
    district: String(parcel?.district ?? producer?.district ?? raw.district ?? "-"),
    village: String(parcel?.village ?? producer?.village ?? raw.village ?? "-"),
    adaNo: String(parcel?.ada_no ?? raw.ada_no ?? "-"),
    parcelNo: String(parcel?.parcel_no ?? raw.parcel_no ?? "-"),
    crop: String(crop?.crop_name ?? raw.crop_name ?? "-"),
    greenhouseArea: toNumber(raw.greenhouse_area ?? raw.area_m2),
    status: toStatus(raw.status),
    parcelPolygon: parsePolygon(parcel?.parcel_polygon ?? raw.parcel_polygon, center),
    greenhousePolygon: parsePolygon(raw.greenhouse_polygon ?? raw.unit_polygon, center),
  };
}

export async function loadCbsUnits(): Promise<CbsUnit[]> {
  const [greenhouseResult, parcelResult, producerResult, cropResult] = await Promise.allSettled([
    fetchAllRows<any>("greenhouse_units"),
    fetchAllRows<any>("cbs_units"),
    fetchAllRows<any>("producers"),
    fetchAllRows<any>("unit_crops"),
  ]);

  const greenhouses = greenhouseResult.status === "fulfilled" ? greenhouseResult.value : [];

  if (greenhouses.length) {
    const parcels = new Map((parcelResult.status === "fulfilled" ? parcelResult.value : []).map((item) => [String(item.id), item]));
    const producers = new Map((producerResult.status === "fulfilled" ? producerResult.value : []).map((item) => [String(item.id), item]));
    const crops = cropResult.status === "fulfilled" ? cropResult.value : [];

    return greenhouses.map((unit) =>
      normalizeGreenhouseUnit(
        unit,
        parcels.get(String(unit.cbs_unit_id)),
        producers.get(String(unit.producer_id)),
        crops.find((crop) => String(crop.greenhouse_unit_id) === String(unit.id)),
      ),
    );
  }

  const [kobuksResult, taskResult] = await Promise.allSettled([
    fetchAllRows<any>("kobuks_units"),
    fetchAllRows<any>("tasks"),
  ]);

  const kobuksRows = kobuksResult.status === "fulfilled" ? kobuksResult.value : [];
  const taskRows = taskResult.status === "fulfilled" ? taskResult.value : [];
  const merged = [...kobuksRows, ...taskRows].map(normalizeLegacyUnit);
  return merged.length ? merged : SAMPLE_UNITS;
}

export async function startInspectionFromUnit(unit: CbsUnit, initialStatus = "Bekliyor") {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const center = getCenter(unit.greenhousePolygon);

  const inspectionResult = await supabase
    .from("inspection_history")
    .insert({
      greenhouse_unit_id: unit.greenhouseUnitId || null,
      producer_id: unit.producerId || null,
      inspector_user_id: user?.id || null,
      unit_no: unit.unitNo,
      status: initialStatus,
      latitude: center.latitude,
      longitude: center.longitude,
    })
    .select()
    .single();

  const taskPayload = {
    user_id: user?.id,
    tc_no: unit.producerTc,
    producer_name: unit.producerName,
    phone: unit.producerPhone || null,
    city: unit.city,
    district_name: unit.district,
    village: unit.village,
    ada_no: unit.adaNo,
    parcel_no: unit.parcelNo,
    unit_no: unit.unitNo,
    greenhouse_area: String(unit.greenhouseArea || ""),
    detected_crop: unit.crop,
    status: initialStatus,
    workflow_status: initialStatus,
    compliance_result: null,
    latitude: center.latitude,
    longitude: center.longitude,
  };

  let taskResult = await supabase
    .from("tasks")
    .insert({
      ...taskPayload,
      parcel_polygon: unit.parcelPolygon,
      greenhouse_polygon: unit.greenhousePolygon,
      inspection_id: inspectionResult.data?.id || null,
      greenhouse_unit_id: unit.greenhouseUnitId || null,
      cbs_unit_id: unit.cbsUnitId || null,
    })
    .select()
    .single();

  if (taskResult.error) {
    taskResult = await supabase.from("tasks").insert(taskPayload).select().single();
  }

  if (taskResult.error) {
    throw taskResult.error;
  }

  return {
    inspection: inspectionResult.data,
    task: taskResult.data,
  };
}
