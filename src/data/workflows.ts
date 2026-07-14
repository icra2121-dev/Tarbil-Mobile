import { MaterialCommunityIcons } from "@expo/vector-icons";

export type KobudsWorkflowKind = "inspection" | "detection" | "classification";

export type WorkflowPhase = {
  title: string;
  description: string;
  items: string[];
};

export type WorkflowDefinition = {
  kind: KobudsWorkflowKind;
  slug: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accent: string;
  phases: WorkflowPhase[];
  findMethods: string[];
  primaryAction: string;
};

export const kobuds30Flow = [
  "Görev Aç",
  "Üniteyi Bul",
  "Navigasyon",
  "Sahaya Git",
  "QR Kod Oku",
  "Ürünü Kontrol Et",
  "Fotoğraf Çek",
  "Kaydet",
  "KOBÜKS'e Gönder",
  "Görev Tamamlandı",
];

export const kobuds30Workflows: WorkflowDefinition[] = [
  {
    kind: "inspection",
    slug: "denetim",
    title: "Denetim (Başvurulu)",
    shortTitle: "Denetim",
    subtitle: "KOBÜKS başvurusu, dilekçe, ünite ve beyan kontrolü",
    icon: "clipboard-check-outline",
    accent: "#22c55e",
    primaryAction: "Başvurulu denetim başlat",
    findMethods: ["QR Kod Okut", "TC/VKN ile Ara", "KOBÜKS'ten Üniteleri Getir"],
    phases: [
      {
        title: "A - Özlük Bilgileri",
        description: "Gerçek veya tüzel kişi KOBÜKS kaydından otomatik gelir.",
        items: ["Gerçek / Tüzel kişi", "QR kod okut", "TC/VKN ile ara"],
      },
      {
        title: "B - Dilekçe",
        description: "Başvuru üretim yılı görev kaydına bağlanır.",
        items: ["Üretim yılı"],
      },
      {
        title: "C - Ünite",
        description: "KOBÜKS üniteleri getirilir ve seçilen ünite haritada yeşil poligonla açılır.",
        items: ["KOBÜKS'ten üniteleri getir", "Ünite no seç", "Ünite poligonu"],
      },
      {
        title: "D - Üretim",
        description: "Ürün KOBÜKS'ten gelir; denetçi yalnızca beyanı kontrol eder, fotoğraf çeker ve kaydeder.",
        items: ["Ürün", "Beyan doğru / yanlış", "Fotoğraf çek", "Kaydet"],
      },
    ],
  },
  {
    kind: "detection",
    slug: "resen-tespit",
    title: "Re'sen Tespit",
    shortTitle: "Re'sen",
    subtitle: "Kayıt aramadan sahadaki üniteyi bul, üretimi tespit et ve KOBÜKS'e gönder",
    icon: "sprout-outline",
    accent: "#38bdf8",
    primaryAction: "Re'sen tespit başlat",
    findMethods: ["QR Kod", "CBS Haritası", "Ada Parsel", "Ünite No"],
    phases: [
      {
        title: "Üniteyi Bul",
        description: "Kullanıcı kayıt aramaz; sadece üniteyi bulma yöntemini seçer.",
        items: ["QR kod", "CBS haritası", "Ada/parsel", "Ünite no"],
      },
      {
        title: "Harita Seçimi",
        description: "Bulunan sera haritada otomatik seçilir.",
        items: ["Sera otomatik seçimi", "Navigasyona başla"],
      },
      {
        title: "Ünite Durumu",
        description: "Pasif ünite seçilirse ürün ekranı açılmaz.",
        items: ["Aktif", "Pasif"],
      },
      {
        title: "Üretim",
        description: "Aktif ünite için ürün bilgileri girilir ve fotoğrafla kaydedilir.",
        items: ["Ürün", "Kullanım şekli", "Tür", "Çeşit", "Materyal", "Dönem", "Model", "Alan", "Tarihler", "Miktar", "Fotoğraf", "KOBÜKS'e gönder"],
      },
    ],
  },
  {
    kind: "classification",
    slug: "siniflandirma",
    title: "Sınıflandırma",
    shortTitle: "Sınıflandırma",
    subtitle: "Ünite bulunur ve yalnızca sera özellikleri kaydedilir",
    icon: "greenhouse",
    accent: "#f59e0b",
    primaryAction: "Sınıflandırma başlat",
    findMethods: ["QR Kod", "CBS Haritası", "Ada Parsel", "Ünite No"],
    phases: [
      {
        title: "Üniteyi Bul",
        description: "Sınıflandırma üretici veya ürün aramasıyla değil, seçilen üniteyle başlar.",
        items: ["QR kod", "CBS haritası", "Ada/parsel", "Ünite no"],
      },
      {
        title: "Sera Özellikleri",
        description: "Yapı, örtü, havalandırma, ısıtma ve otomasyon bilgileri kaydedilir.",
        items: ["Ünite tipi", "Temel betonu", "Çatı tipi", "Yükseklik", "Genişlik", "Profil", "Örtü", "Havalandırma", "Isıtma", "Otomasyon"],
      },
      {
        title: "Kaydet",
        description: "Sınıflandırma kaydı görev geçmişine ve rapor altyapısına bağlanır.",
        items: ["Fotoğraf", "GPS", "Kaydet"],
      },
    ],
  },
];

export const cbsLayerLegend = [
  { label: "Kayıtlı sera", color: "#22c55e", status: "registered" },
  { label: "Denetime gidilecek", color: "#38bdf8", status: "assigned" },
  { label: "Eksik bilgi", color: "#f59e0b", status: "missing" },
  { label: "Riskli sera", color: "#ef4444", status: "risk" },
];

export const reportFilterFlow = ["İl", "İlçe", "Mahalle", "Ürün", "Üretim yılı", "PDF", "Excel"];

export const aiSuggestionFields = ["Ürün", "Tür", "Çeşit", "Tahmini alan", "Tahmini verim"];

export const offlineChecklist = [
  "İnternet yokken denetim yapılır",
  "Fotoğraf ve GPS telefonda saklanır",
  "Veriler çevrimdışı kuyrukta tutulur",
  "İnternet gelince tek tuşla senkronize edilir",
];

export function getWorkflowBySlug(slug: string | string[] | undefined) {
  const value = Array.isArray(slug) ? slug[0] : slug;

  return kobuds30Workflows.find((workflow) => workflow.slug === value) || kobuds30Workflows[0];
}

export function getWorkflowByKind(kind: KobudsWorkflowKind) {
  return kobuds30Workflows.find((workflow) => workflow.kind === kind) || kobuds30Workflows[0];
}
