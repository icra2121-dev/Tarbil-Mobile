import { CbsUnit, getCenter, loadCbsUnits } from "./cbs";
import { getProducerByTc, searchKobuksUnits, type KobuksUnitRecord } from "./kobuks";

type MinistryLookupValues = {
  tc_no?: string;
  unit_no?: string;
  city?: string;
  district_name?: string;
  village?: string;
  ada_no?: string;
  parcel_no?: string;
};

function normalize(value: unknown) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function matchesAdministrativeFields(unit: KobuksUnitRecord, values: MinistryLookupValues) {
  const checks = [
    [unit.city, values.city],
    [unit.district_name, values.district_name],
    [unit.village, values.village],
  ];

  return checks.every(([unitValue, expected]) => !normalize(expected) || normalize(unitValue).includes(normalize(expected)));
}

function cbsToKobuksRecord(unit: CbsUnit): KobuksUnitRecord {
  const center = getCenter(unit.greenhousePolygon);

  return {
    tc_no: unit.producerTc,
    producer_name: unit.producerName,
    phone: unit.producerPhone || "",
    city: unit.city,
    district_name: unit.district,
    village: unit.village,
    unit_no: unit.unitNo,
    ada_no: unit.adaNo,
    parcel_no: unit.parcelNo,
    greenhouse_area: String(unit.greenhouseArea || ""),
    detected_crop: unit.crop,
    registration_status: "Aktif",
    latitude: center.latitude,
    longitude: center.longitude,
    parcel_polygon: unit.parcelPolygon,
    greenhouse_polygon: unit.greenhousePolygon,
  };
}

async function lookupFromKobuks(values: MinistryLookupValues) {
  const unitNo = String(values.unit_no || "").trim();
  const tcNo = String(values.tc_no || "").trim();
  const adaNo = String(values.ada_no || "").trim();
  const parcelNo = String(values.parcel_no || "").trim();

  if (unitNo) {
    const units = await searchKobuksUnits(unitNo);
    return units.find((unit) => matchesAdministrativeFields(unit, values)) || units[0] || null;
  }

  if (tcNo) {
    return await getProducerByTc(tcNo);
  }

  if (adaNo && parcelNo) {
    const units = await searchKobuksUnits(`${adaNo}/${parcelNo}`);
    return units.find((unit) => matchesAdministrativeFields(unit, values)) || units[0] || null;
  }

  return null;
}

async function lookupFromCbs(values: MinistryLookupValues) {
  const units = await loadCbsUnits();
  const unitNo = normalize(values.unit_no);
  const adaNo = normalize(values.ada_no);
  const parcelNo = normalize(values.parcel_no);
  const city = normalize(values.city);
  const district = normalize(values.district_name);
  const village = normalize(values.village);

  const match = units.find((unit) => {
    const unitMatches = !unitNo || normalize(unit.unitNo) === unitNo;
    const parcelMatches = (!adaNo || normalize(unit.adaNo) === adaNo) && (!parcelNo || normalize(unit.parcelNo) === parcelNo);
    const cityMatches = !city || normalize(unit.city).includes(city);
    const districtMatches = !district || normalize(unit.district).includes(district);
    const villageMatches = !village || normalize(unit.village).includes(village);

    return unitMatches && parcelMatches && cityMatches && districtMatches && villageMatches;
  });

  return match ? cbsToKobuksRecord(match) : null;
}

export async function lookupMinistryUnit(values: MinistryLookupValues) {
  const kobuksRecord = await lookupFromKobuks(values).catch(() => null);

  if (kobuksRecord) {
    return kobuksRecord;
  }

  const cbsRecord = await lookupFromCbs(values).catch(() => null);

  if (cbsRecord) {
    return cbsRecord;
  }

  throw new Error("Bakanlık sisteminde bu bilgilere uygun ünite bulunamadı.");
}
