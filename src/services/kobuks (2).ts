import { supabase } from "../lib/supabase";
import { integrationFetch } from "./integrations";

export type KobuksUnitRecord = {
  tc_no?: string;
  producer_name?: string;
  phone?: string;
  city?: string;
  district_name?: string;
  village?: string;
  unit_no?: string;
  ada_no?: string;
  parcel_no?: string;
  greenhouse_area?: string;
  detected_crop?: string;
  registration_status?: string;
  latitude?: number;
  longitude?: number;
  parcel_polygon?: unknown;
  greenhouse_polygon?: unknown;
};

type KobuksSearchPayload = {
  data?: {
    unit?: any;
    producer?: any;
    production?: any;
  }[];
};

function normalizeRecord(unit: any, producer?: any, production?: any): KobuksUnitRecord {
  return {
    tc_no: producer?.tc_no || unit?.producer_tc || unit?.tc_no,
    producer_name: producer?.full_name || unit?.producer_name || unit?.full_name || "-",
    phone: producer?.phone || unit?.phone || "",
    city: producer?.city || unit?.city || unit?.province,
    district_name: producer?.district || unit?.district_name || unit?.district,
    village: producer?.village || unit?.village || unit?.neighborhood,
    unit_no: unit?.unit_no,
    ada_no: unit?.ada_no,
    parcel_no: unit?.parcel_no,
    greenhouse_area: String(unit?.greenhouse_area || unit?.area_m2 || ""),
    detected_crop: production?.crop_name || unit?.detected_crop || unit?.crop_name || unit?.crop,
    registration_status: unit?.registration_status || "Aktif",
    latitude: unit?.latitude || unit?.unit_latitude,
    longitude: unit?.longitude || unit?.unit_longitude,
    parcel_polygon: unit?.parcel_polygon || unit?.polygon,
    greenhouse_polygon: unit?.greenhouse_polygon || unit?.unit_polygon,
  };
}

async function enrichUnit(unit: any): Promise<KobuksUnitRecord> {
  const [producerResult, productionResult] = await Promise.all([
    unit?.producer_tc
      ? supabase.from("kobuks_producers").select("*").eq("tc_no", unit.producer_tc).maybeSingle()
      : Promise.resolve({ data: null }),
    unit?.unit_no
      ? supabase.from("kobuks_production").select("*").eq("unit_no", unit.unit_no).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return normalizeRecord(unit, producerResult.data, productionResult.data);
}

async function searchRemoteKobuks(query: string): Promise<KobuksUnitRecord[] | null> {
  const payload = await integrationFetch<KobuksSearchPayload | any[]>(
    `/kobuks/units/search?q=${encodeURIComponent(query)}`,
  );

  if (!payload) {
    return null;
  }

  const rows = Array.isArray(payload) ? payload : payload.data || [];
  return rows.map((row: any) => normalizeRecord(row.unit || row, row.producer, row.production));
}

export async function searchKobuksUnits(query: string): Promise<KobuksUnitRecord[]> {
  const normalized = query.trim();

  if (!normalized) {
    return [];
  }

  const remote = await searchRemoteKobuks(normalized);

  if (remote) {
    return remote;
  }

  const parts = normalized
    .replace("\\", "/")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  let unitQuery = supabase.from("kobuks_units").select("*").limit(50);

  if (parts.length >= 2) {
    unitQuery = unitQuery.eq("ada_no", parts[0]).eq("parcel_no", parts[1]);
  } else {
    const unitResult = await supabase.from("kobuks_units").select("*").eq("unit_no", normalized).limit(50);

    if (unitResult.data?.length) {
      const first = unitResult.data[0];
      const sameParcelQuery =
        first?.ada_no && first?.parcel_no
          ? supabase
              .from("kobuks_units")
              .select("*")
              .eq("ada_no", first.ada_no)
              .eq("parcel_no", first.parcel_no)
              .limit(50)
          : unitResult;

      const sameParcelResult = await sameParcelQuery;
      return await Promise.all((sameParcelResult.data || unitResult.data).map(enrichUnit));
    }

    unitQuery = unitQuery.or(`ada_no.eq.${normalized},parcel_no.eq.${normalized}`);
  }

  const result = await unitQuery;

  if (result.error) {
    throw result.error;
  }

  return await Promise.all((result.data || []).map(enrichUnit));
}

export async function getProducerByUnitNo(unitNo: string) {
  const units = await searchKobuksUnits(unitNo);

  if (!units.length) {
    throw new Error("Ünite bulunamadı");
  }

  return units[0];
}

export async function getProducerByTc(tcNo: string) {
  const remote = await searchRemoteKobuks(tcNo);

  if (remote?.length) {
    return remote[0];
  }

  const producerResult = await supabase.from("kobuks_producers").select("*").eq("tc_no", tcNo).single();

  if (producerResult.error || !producerResult.data) {
    throw new Error("Üretici bulunamadı");
  }

  const unitResult = await supabase.from("kobuks_units").select("*").eq("producer_tc", tcNo).limit(1);

  const unit = unitResult.data?.[0];
  return await enrichUnit({
    ...unit,
    producer_tc: tcNo,
  });
}
