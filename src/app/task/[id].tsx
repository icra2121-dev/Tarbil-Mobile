import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { supabase } from "../../lib/supabase";
import { BottomTabMenu } from "../../components/BottomTabMenu";
import { PRODUCT_OPTIONS } from "../../data/products";
import { assignTaskToInspector } from "../../services/assignments";
import { getLatestEk8ReportForTask, shareEk8ReportPdf } from "../../services/ek8Report";
import { updateTaskOnlineOrQueue } from "../../services/offline";
import { exportTaskPdf } from "../../services/pdfExport";
import { getMyProfile, isAdmin } from "../../services/profile";
import { getTaskById } from "../../services/taskDetail";
import { deleteTaskById } from "../../services/tasks";
import {
  getTaskStatus,
  getTaskWorkflowKind,
  hasKobuksSync,
  hasReportOutput,
  hasAssignedInspector as taskHasAssignedInspector,
  hasTaskCoordinates,
  isTaskCancelled,
  isTaskCompleted,
  isTaskStarted,
  taskStatuses,
  type TaskWorkflowKind,
  validateTaskBeforeCompletion,
  validateTaskBeforeKobuksSync,
  validateTaskBeforeReport,
  validateTaskBeforeStart,
  validateTaskForAssignment,
} from "../../services/workflowGuard";

type FieldConfig = {
  key: string;
  label: string;
  taskKey?: string;
};

const detectionFields: FieldConfig[] = [
  { key: "detected_crop", label: "Ürün", taskKey: "detected_crop" },
  { key: "unit_status", label: "Ünite Durumu" },
  { key: "usage_type", label: "Kullanım Şekli" },
  { key: "crop_type", label: "Tür" },
  { key: "crop_variety", label: "Çeşit" },
  { key: "production_material", label: "Materyal" },
  { key: "production_season", label: "Dönem" },
  { key: "production_model", label: "Model" },
  { key: "planting_area", label: "Alan", taskKey: "greenhouse_area" },
  { key: "planting_date", label: "Ekim/Dikim Tarihi" },
  { key: "harvest_dates", label: "Hasat Tarihleri" },
  { key: "production_amount", label: "Miktar" },
];

const classificationFields: FieldConfig[] = [
  { key: "unit_type", label: "Ünite Tipi" },
  { key: "current_class", label: "Güncel Sınıf" },
  { key: "foundation_concrete", label: "Temel Betonu" },
  { key: "roof_type", label: "Çatı Tipi" },
  { key: "roof_height", label: "Yükseklik" },
  { key: "roof_width", label: "Genişlik" },
  { key: "gutter_height", label: "Oluk Altı Yüksekliği" },
  { key: "construction_age", label: "Konstrüksiyon Yaşı" },
  { key: "profile_material", label: "Profil" },
  { key: "cover_material", label: "Örtü" },
  { key: "ventilation", label: "Havalandırma" },
  { key: "heating_type", label: "Isıtma" },
  { key: "automation", label: "Otomasyon" },
];

const passiveProfileStatuses = new Set(["passive", "inactive", "pasif", "inaktif", "disabled", "false", "0"]);

const workflowLabels: Record<TaskWorkflowKind, string> = {
  inspection: "Denetim",
  detection: "Ürün Tespiti",
  classification: "Sınıflandırma",
};

const startModeOptions: Record<
  TaskWorkflowKind,
  { key: TaskWorkflowKind; title: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string }
> = {
  inspection: { key: "inspection", title: "Başvurulu Denetim", icon: "clipboard-check-outline", color: "#16a34a" },
  detection: { key: "detection", title: "Re'sen Tespit", icon: "sprout-outline", color: "#0ea5e9" },
  classification: { key: "classification", title: "Sınıflandırma", icon: "greenhouse", color: "#f59e0b" },
};

function getWorkflowLines(description: unknown) {
  return String(description || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const dividerIndex = line.indexOf(":");

      if (dividerIndex === -1) {
        return { label: "Not", value: line };
      }

      return {
        label: line.slice(0, dividerIndex).trim(),
        value: line.slice(dividerIndex + 1).trim() || "-",
      };
    });
}

function getDescriptionMap(description: unknown) {
  const map = new Map<string, string>();

  getWorkflowLines(description).forEach((line) => {
    map.set(line.label.toLocaleLowerCase("tr-TR"), line.value);
  });

  return map;
}

function getFieldConfig(workflowKind: TaskWorkflowKind) {
  return workflowKind === "classification" ? classificationFields : detectionFields;
}

function buildManualFields(task: any, workflowKind: TaskWorkflowKind) {
  const descriptionMap = getDescriptionMap(task?.description);
  const config = getFieldConfig(workflowKind);

  return config.reduce<Record<string, string>>((fields, field) => {
    const fromDescription = descriptionMap.get(field.label.toLocaleLowerCase("tr-TR"));
    const fromTask = field.taskKey ? task?.[field.taskKey] : "";
    fields[field.key] = String(fromDescription || fromTask || "");
    return fields;
  }, {});
}

function mergeManualDescription(description: unknown, workflowKind: TaskWorkflowKind, fields: Record<string, string>) {
  const config = getFieldConfig(workflowKind);
  const labels = new Set(config.map((field) => field.label.toLocaleLowerCase("tr-TR")));
  const existingLines = String(description || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const label = line.includes(":") ? line.slice(0, line.indexOf(":")).trim().toLocaleLowerCase("tr-TR") : "";
      return !labels.has(label);
    });

  const manualLines = config
    .map((field) => {
      const value = String(fields[field.key] || "").trim();
      return value ? `${field.label}: ${value}` : "";
    })
    .filter(Boolean);

  return [...existingLines, ...manualLines].join("\n");
}

function getProfileName(profile: any) {
  return String(profile?.full_name || profile?.email || profile?.id || "Kullanıcı");
}

function getProfileSubtitle(profile: any) {
  const parts = [profile?.email, profile?.city || profile?.work_city, profile?.district || profile?.work_district].filter(Boolean);

  return parts.join(" · ");
}

function getProfileRole(profile: any) {
  const roles: Record<string, string> = {
    admin: "Admin",
    manager: "Yönetici",
    inspector: "Denetçi",
    worker: "Saha personeli",
  };

  return roles[String(profile?.role || "")] || String(profile?.title || profile?.role || "Kullanıcı");
}

function isActiveProfile(profile: any) {
  if (!profile?.id) {
    return false;
  }

  if (profile?.is_active === false) {
    return false;
  }

  const status = String(profile?.status || "").trim().toLocaleLowerCase("tr-TR");

  return !passiveProfileStatuses.has(status);
}

function mergeAssignableUsers(users: any[], profile: any, task: any) {
  const map = new Map<string, any>();

  [...users, profile]
    .filter(isActiveProfile)
    .forEach((item) => {
      map.set(String(item.id), item);
    });

  if (task?.assigned_to && !map.has(String(task.assigned_to))) {
    map.set(String(task.assigned_to), {
      id: task.assigned_to,
      full_name: task.assigned_name || "Atanan kullanıcı",
      role: "inspector",
    });
  }

  return [...map.values()].sort((first, second) => getProfileName(first).localeCompare(getProfileName(second), "tr"));
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams();
  const [task, setTask] = useState<any>(null);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [inspectors, setInspectors] = useState<any[]>([]);
  const [selectedInspector, setSelectedInspector] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cropMatches, setCropMatches] = useState<"same" | "different" | "">("");
  const [selectedCrop, setSelectedCrop] = useState("");
  const [customCrop, setCustomCrop] = useState("");
  const [manualFields, setManualFields] = useState<Record<string, string>>({});
  const [fieldMode, setFieldMode] = useState<TaskWorkflowKind>("inspection");
  const [saving, setSaving] = useState(false);
  const [closingAction, setClosingAction] = useState<"" | "kobuks" | "report" | "pdf" | "excel">("");

  const loadEvidence = useCallback(async () => {
    const result = await supabase
      .from("task_evidence")
      .select("*")
      .eq("task_id", id)
      .order("created_at", { ascending: false });

    return result.data || [];
  }, [id]);

  const loadAssignableUsers = useCallback(async () => {
    const result = await supabase.from("profiles").select("*");

    return result.data || [];
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([getTaskById(id), loadEvidence(), loadAssignableUsers(), getMyProfile().catch(() => null)])
      .then(([taskResult, evidenceResult, usersResult, profileResult]) => {
        if (!active) {
          return;
        }

        const nextTask = taskResult.data;
        const nextWorkflowKind = getTaskWorkflowKind(nextTask);

        setTask(nextTask);
        setFieldMode(nextWorkflowKind);
        setManualFields(buildManualFields(nextTask, nextWorkflowKind));
        setEvidence(evidenceResult);
        setInspectors(mergeAssignableUsers(usersResult, profileResult, nextTask));
        setProfile(profileResult);
        setSelectedInspector(String(nextTask?.assigned_to || ""));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id, loadEvidence, loadAssignableUsers]);

  const management = isAdmin(profile) || profile?.role === "manager";
  const currentStatus = getTaskStatus(task);
  const workflowKind = getTaskWorkflowKind(task);
  const workflowLabel = workflowLabels[workflowKind];
  const inspectionStarted = isTaskStarted(task);
  const inspectionCancelled = isTaskCancelled(task);
  const reportReady = isTaskCompleted(task);
  const assignedInspector = taskHasAssignedInspector(task);
  const assignedToMe =
    profile?.id &&
    (String(task?.assigned_to || "") === String(profile.id) || String(task?.user_id || "") === String(profile.id));
  const canInspectTask = !management && Boolean(assignedToMe);
  const inspectionEditable = canInspectTask && inspectionStarted && !reportReady && !inspectionCancelled;
  const kobuksTransferred = hasKobuksSync(task);
  const reportCreated = hasReportOutput(task);
  const canCreateReport = canInspectTask && reportReady && !reportCreated && !inspectionCancelled;
  const canDownloadReport = canInspectTask && reportCreated && !inspectionCancelled;
  const canSyncKobuks = canInspectTask && reportCreated && !kobuksTransferred && !inspectionCancelled;
  const assignmentMissingItems = useMemo(() => validateTaskForAssignment(task), [task]);
  const canAssignTask = management && !assignedInspector && !reportReady && !inspectionCancelled;
  const canCancelTask = management && assignedInspector && !inspectionCancelled && !reportReady;
  const showInspectionFlow = canInspectTask && !reportReady;
  const incompleteInspectionItems = useMemo(
    () => validateTaskBeforeCompletion(task, evidence),
    [evidence, task],
  );
  const manualFieldConfig = useMemo(() => getFieldConfig(fieldMode), [fieldMode]);
  const verifiedCrop = useMemo(() => customCrop.trim() || selectedCrop || task?.detected_crop || "", [customCrop, selectedCrop, task]);
  const cropVerificationReady = cropMatches === "same" || (cropMatches === "different" && verifiedCrop.trim().length > 0);
  const manualEntryReady = evidence.length > 0 && hasTaskCoordinates(task);
  const selectedInspectorProfile = useMemo(
    () => inspectors.find((item) => String(item.id) === String(selectedInspector)),
    [inspectors, selectedInspector],
  );

  async function loadTask() {
    const result = await getTaskById(id);
    const nextWorkflowKind = getTaskWorkflowKind(result.data);
    setTask(result.data);
    setFieldMode(nextWorkflowKind);
    setManualFields(buildManualFields(result.data, nextWorkflowKind));
  }

  function applyLocalTaskUpdate(payload: Record<string, unknown>) {
    setTask((current: any) => ({
      ...current,
      ...payload,
    }));
  }

  async function assignInspector() {
    const inspector = inspectors.find((item) => String(item.id) === String(selectedInspector));

    if (!inspector) {
      Alert.alert("Denetçi seçin", "Görev atamak için listeden bir denetçi seçin.");
      return;
    }

    setAssigning(true);

    try {
      await assignTaskToInspector(id, inspector);
      Alert.alert("Başarılı", "Görev atandı ve personele bildirim kaydı oluşturuldu.");
      await loadTask();
    } catch (error: any) {
      Alert.alert("Atama yapılamadı", error?.message || "Görev atanamadı.");
    } finally {
      setAssigning(false);
    }
  }

  async function updateStatus(status: string) {
    const payload = { workflow_status: status, status };
    const result = await updateTaskOnlineOrQueue(id, payload, `Görev durumu: ${status}`);

    if (result.queued) {
      applyLocalTaskUpdate(payload);
      return {
        queued: true,
      };
    }

    await loadTask();
    return {
      queued: false,
    };
  }

  async function cancelInspection() {
    Alert.alert("Görevi iptal et", "Bu görev admin tarafından iptal edildi olarak işaretlenecek.", [
      {
        text: "Vazgeç",
        style: "cancel",
      },
      {
        text: "İptal Et",
        style: "destructive",
        onPress: async () => {
          setCancelling(true);

          try {
            const taskId = String(Array.isArray(id) ? id[0] : id || "");
            const result = await supabase
              .from("tasks")
              .update({
                workflow_status: taskStatuses.cancelled,
                status: taskStatuses.cancelled,
                compliance_result: task?.compliance_result || "Admin tarafından iptal edildi",
              })
              .eq("id", taskId)
              .select("*")
              .single();

            if (result.error) {
              throw result.error;
            }

            setTask(result.data);
            Alert.alert("İptal edildi", "Denetim iptal edildi olarak güncellendi.");
          } catch (error: any) {
            Alert.alert("İptal edilemedi", error?.message || "Denetim durumu güncellenemedi.");
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  }

  async function deleteInspection() {
    Alert.alert("Denetimi sil", "İptal edilen denetim kalıcı olarak silinecek.", [
      {
        text: "Vazgeç",
        style: "cancel",
      },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);

          try {
            await deleteTaskById(id);
            Alert.alert("Silindi", "İptal edilen denetim silindi.");
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/tasks" as any);
            }
          } catch (error: any) {
            Alert.alert("Silinemedi", error?.message || "Denetim silinemedi.");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  function getStartComplianceResult(mode: TaskWorkflowKind) {
    if (mode === "detection") {
      return "Re'sen ürün tespiti bekliyor";
    }

    if (mode === "classification") {
      return "Sınıflandırma başladı";
    }

    return task?.compliance_result || "Başvurulu denetim başladı";
  }

  async function startInspection(mode: TaskWorkflowKind) {
    if (!canInspectTask) {
      Alert.alert("Yetki yok", "Denetim yalnızca görevin atandığı denetçi tarafından başlatılır.");
      return;
    }

    const missing = validateTaskBeforeStart(task);

    if (missing.length) {
      Alert.alert("Denetim başlatılamaz", `Önce şu eksikleri tamamlayın:\n\n${missing.join("\n")}`);
      return;
    }

    setFieldMode(mode);
    setManualFields(buildManualFields(task, mode));

    try {
      const payload = {
        workflow_status: taskStatuses.started,
        status: taskStatuses.started,
        compliance_result: getStartComplianceResult(mode),
      };
      const result = await updateTaskOnlineOrQueue(id, payload, "Denetim başlatma");
      const nextTask = result.queued ? { ...task, ...payload } : result.data;

      setTask(nextTask);
      setFieldMode(mode);
      setManualFields(buildManualFields(nextTask, mode));

      if (result.queued) {
        Alert.alert("Sıraya alındı", "Denetim başlatma işlemi internet geldiğinde sisteme aktarılacak.");
      }
    } catch (error: any) {
      Alert.alert("Denetim başlatılamadı", error?.message || "Denetim başlatılamadı.");
    }
  }

  function openQrScan() {
    if (!canInspectTask) {
      Alert.alert("Yetki yok", "QR ile bilgi alma yalnızca görevin atandığı denetçide açıktır.");
      return;
    }

    router.push({
      pathname: "/qr-scan",
      params: {
        task_id: String(Array.isArray(id) ? id[0] : id || ""),
        workflow: fieldMode,
      },
    } as any);
  }

  function takeEvidencePhoto() {
    if (!canInspectTask) {
      Alert.alert("Yetki yok", "Fotoğraf yalnızca görevin atandığı denetçi tarafından eklenir.");
      return;
    }

    router.push(`/task/${String(Array.isArray(id) ? id[0] : id)}/camera` as any);
  }

  function updateManualField(key: string, value: string) {
    setManualFields((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openPolygonEditor() {
    router.push(`/task/${String(Array.isArray(id) ? id[0] : id)}/polygon` as any);
  }

  function openManualWorkflow(mode: Exclude<TaskWorkflowKind, "inspection">) {
    if (!inspectionEditable) {
      Alert.alert("İşlem kapalı", "Saha bilgisi yalnızca devam eden görevde güncellenebilir.");
      return;
    }

    setFieldMode(mode);
    setManualFields(buildManualFields(task, mode));
  }

  async function saveAndFinishInspection() {
    if (!canInspectTask) {
      Alert.alert("Yetki yok", "Kaydetme işlemi yalnızca görevin atandığı denetçi tarafından yapılır.");
      return;
    }

    let payload: Record<string, unknown> = {};
    let successMessage = "Saha denetimi kaydedildi. Şimdi rapor oluşturabilirsiniz.";

    if (fieldMode === "inspection") {
      if (!cropMatches) {
        Alert.alert("Seçim gerekli", "Ürün doğrulama sonucunu seçin.");
        return;
      }

      if (cropMatches === "different" && !verifiedCrop.trim()) {
        Alert.alert("Ürün gerekli", "Re'sen tespit edilen ürünü seçin veya girin.");
        return;
      }

      payload = {
        detected_crop: cropMatches === "different" ? verifiedCrop : task.detected_crop,
        registered_crop: task.detected_crop,
        compliance_result: cropMatches === "same" ? "KOBÜKS ürünü doğrulandı" : `Re'sen ürün tespiti: ${verifiedCrop}`,
      };
    } else {
      const nextDescription = mergeManualDescription(task?.description, fieldMode, manualFields);
      const nextCrop = fieldMode === "detection" ? manualFields.detected_crop?.trim() || task?.detected_crop : task?.detected_crop;

      payload = {
        description: nextDescription,
        detected_crop: nextCrop,
        greenhouse_area: manualFields.planting_area?.trim() || task?.greenhouse_area,
        compliance_result:
          fieldMode === "classification"
            ? "Sınıflandırma güncellendi"
            : `Re'sen ürün tespiti: ${nextCrop || "Güncellendi"}`,
      };
      successMessage =
        fieldMode === "classification"
          ? "Sınıflandırma kaydedildi. Şimdi rapor oluşturabilirsiniz."
          : "Re'sen tespit kaydedildi. Şimdi rapor oluşturabilirsiniz.";
    }

    const missing = validateTaskBeforeCompletion({ ...task, ...payload }, evidence);

    if (missing.length) {
      Alert.alert("Kaydedilemedi", `Önce şu eksikleri tamamlayın:\n\n${missing.join("\n")}`);
      return;
    }

    payload.workflow_status = taskStatuses.completed;
    payload.status = taskStatuses.completed;

    setSaving(true);

    try {
      const result = await updateTaskOnlineOrQueue(id, payload, "Denetim kaydı");
      const nextTask = result.queued ? { ...task, ...payload } : result.data;

      setTask(nextTask);
      const nextWorkflowKind = getTaskWorkflowKind(nextTask);
      setFieldMode(nextWorkflowKind);
      setManualFields(buildManualFields(nextTask, nextWorkflowKind));

      Alert.alert(
        result.queued ? "Sıraya alındı" : "Kaydedildi",
        result.queued ? "Denetim kaydı internet geldiğinde sisteme aktarılacak." : successMessage,
      );
    } catch (error: any) {
      Alert.alert("Kaydedilemedi", error?.message || "Denetim kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function syncTaskToKobuks() {
    if (!canInspectTask) {
      Alert.alert("Yetki yok", "KOBÜKS aktarımı yalnızca görevin atandığı denetçide açıktır.");
      return;
    }

    const missing = validateTaskBeforeKobuksSync(task, evidence);

    if (missing.length) {
      Alert.alert("KOBÜKS'e aktarılamaz", `Önce şu eksikleri tamamlayın:\n\n${missing.join("\n")}`);
      return;
    }

    setClosingAction("kobuks");

    try {
      const result = await updateStatus(taskStatuses.kobuksSynced);
      Alert.alert(
        result.queued ? "Sıraya alındı" : "Aktarıldı",
        result.queued
          ? "KOBÜKS aktarımı internet geldiğinde sisteme aktarılacak."
          : "Saha kaydı KOBÜKS'e aktarıldı. İş akışı tamamlandı.",
      );
    } catch (error: any) {
      Alert.alert("Aktarım başarısız", error?.message || "KOBÜKS aktarımı tamamlanamadı.");
    } finally {
      setClosingAction("");
    }
  }

  function ensureReportReady(actionTitle: string) {
    const missing = validateTaskBeforeReport(task, evidence);

    if (missing.length) {
      Alert.alert(actionTitle, `Rapor için şu eksikler tamamlanmalı:\n\n${missing.join("\n")}`);
      return false;
    }

    return true;
  }

  async function createReport() {
    if (!canInspectTask) {
      Alert.alert("Yetki yok", "Rapor işlemi yalnızca görevin atandığı denetçide açıktır.");
      return;
    }

    if (!ensureReportReady("Rapor oluşturulamaz")) {
      return;
    }

    setClosingAction("report");

    try {
      const { saved } = await exportTaskPdf(task, { share: false });
      await updateStatus(taskStatuses.reportCreated);

      if (saved) {
        Alert.alert("Rapor oluşturuldu", "Ek-8 raporu raporlar ekranında en üstte görünecek. Şimdi PDF/Excel alabilir, ardından KOBÜKS'e aktarabilirsiniz.");
      } else {
        Alert.alert(
          "Rapor PDF'i oluşturuldu",
          "PDF hazırlandı ancak rapor kaydı sunucuya yazılamadı; Raporlar ekranındaki listede görünmeyebilir. İnternet bağlantınızı kontrol edip tekrar deneyin.",
        );
      }
    } catch (error: any) {
      Alert.alert("Rapor oluşturulamadı", error?.message || "Ek-8 raporu oluşturulamadı.");
    } finally {
      setClosingAction("");
    }
  }

  async function shareReportPdf() {
    if (!canDownloadReport) {
      Alert.alert("Rapor hazır değil", "PDF/Excel almadan önce raporu oluşturun.");
      return;
    }

    const taskId = String(Array.isArray(id) ? id[0] : id || "");

    setClosingAction("pdf");

    try {
      const report = await getLatestEk8ReportForTask(taskId);

      if (report) {
        await shareEk8ReportPdf(report);
      } else {
        await exportTaskPdf(task);
      }
    } catch (error: any) {
      Alert.alert("PDF alınamadı", error?.message || "PDF çıktısı alınamadı.");
    } finally {
      setClosingAction("");
    }
  }

  async function shareReportExcel() {
    if (!canDownloadReport) {
      Alert.alert("Rapor hazır değil", "PDF/Excel almadan önce raporu oluşturun.");
      return;
    }

    const taskId = String(task?.id || id || Date.now());

    setClosingAction("excel");

    try {
      const csv = buildTaskCsv(task);
      const uri = `${FileSystem.cacheDirectory}kobuds-denetim-${task?.unit_no || taskId}.csv`;

      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(uri, {
        mimeType: "text/csv",
        dialogTitle: "KOBÜDS Excel çıktısı",
      });
    } catch (error: any) {
      Alert.alert("Excel alınamadı", error?.message || "Excel çıktısı oluşturulamadı.");
    } finally {
      setClosingAction("");
    }
  }

  function startNavigation() {
    if (!task?.latitude || !task?.longitude) {
      Alert.alert("Koordinat yok", "Bu görev için CBS koordinatı bulunamadı.");
      return;
    }

    Linking.openURL(`google.navigation:q=${task.latitude},${task.longitude}`);
  }

  function callProducer() {
    if (!task?.phone) {
      Alert.alert("Telefon yok", "Üretici telefon bilgisi bulunamadı.");
      return;
    }

    Linking.openURL(`tel:${task.phone}`);
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator color="#22c55e" />
          <Text style={styles.loadingText}>Denetim yükleniyor...</Text>
        </View>
        <BottomTabMenu />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.root}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Görev bulunamadı.</Text>
        </View>
        <BottomTabMenu />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>{workflowLabel}</Text>
          <Text style={styles.title}>{task.detected_crop || "Denetim"}</Text>
          <Text style={styles.subtitle}>{task.unit_no || "-"} - {task.producer_name || "-"}</Text>
        </View>
        <Text style={styles.statusPill}>{currentStatus || "Bekliyor"}</Text>
      </View>

      <View style={styles.infoGrid}>
        <InfoCard label="Üretici" value={task.producer_name} helper={task.phone || "-"} />
        <InfoCard label="Parsel" value={task.city || "-"} helper={`${task.ada_no || "-"} / ${task.parcel_no || "-"}`} />
        <InfoCard label="Ürün" value={task.detected_crop} helper={`İşletme: ${task.business_no || "-"}`} />
        <InfoCard label="Ünite" value={task.unit_no} helper={`${task.greenhouse_area || "-"} m²`} />
      </View>

      <View style={styles.actionRow}>
        <Pressable onPress={callProducer} style={styles.callButton}>
          <MaterialCommunityIcons name="phone-outline" color="white" size={18} />
          <Text style={styles.actionText}>Üreticiyi Ara</Text>
        </Pressable>
        <Pressable onPress={startNavigation} style={styles.navButton}>
          <MaterialCommunityIcons name="navigation-variant-outline" color="white" size={18} />
          <Text style={styles.actionText}>Navigasyon</Text>
        </Pressable>
      </View>

      {!management && !canInspectTask ? (
        <View style={styles.roleNotice}>
          <MaterialCommunityIcons name="lock-outline" color="#fed7aa" size={20} />
          <Text style={styles.roleNoticeText}>Bu görev size atanmamış.</Text>
        </View>
      ) : null}

      {management ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>{reportReady ? "Denetim Özeti" : "Görevlendirme"}</Text>
              <Text style={styles.sectionMeta}>
                {reportReady
                  ? "Denetim tamamlandı; yeni atama kapalı. Rapor işlemleri aşağıdaki rapor alanından yapılır."
                  : "Denetimi sahada yürütecek kullanıcıyı seçin."}
              </Text>
            </View>
            <MaterialCommunityIcons name={reportReady ? "file-document-check-outline" : "account-check-outline"} color="#38bdf8" size={22} />
          </View>
          <View style={styles.assignmentSummary}>
            <View style={styles.assignmentSummaryItem}>
              <Text style={styles.assignmentLabel}>Mevcut atama</Text>
              <Text style={styles.assignmentValue} numberOfLines={1}>
                {task.assigned_name || "Henüz atanmadı"}
              </Text>
            </View>
            <View style={styles.assignmentSummaryItem}>
              <Text style={styles.assignmentLabel}>Durum</Text>
              <Text style={styles.assignmentValue} numberOfLines={1}>
                {currentStatus || "Bekliyor"}
              </Text>
            </View>
          </View>
          {canAssignTask && assignmentMissingItems.length ? (
            <View style={styles.requirementsNotice}>
              <Text style={styles.requirementsTitle}>Atama öncesi eksikler</Text>
              {assignmentMissingItems.map((item) => (
                <Text key={item} style={styles.requirementsText}>
                  {item}
                </Text>
              ))}
            </View>
          ) : null}
          {canAssignTask ? (
            <>
              {inspectors.length ? (
                <View style={styles.pickerWrap}>
                  <Picker selectedValue={selectedInspector} onValueChange={setSelectedInspector} style={styles.picker}>
                    <Picker.Item label="Denetçi seçin" value="" />
                    {inspectors.map((item) => {
                      const subtitle = getProfileSubtitle(item);
                      const label = `${getProfileName(item)} - ${getProfileRole(item)}${subtitle ? ` - ${subtitle}` : ""}`;

                      return <Picker.Item key={String(item.id)} label={label} value={String(item.id)} />;
                    })}
                  </Picker>
                </View>
              ) : (
                <View style={styles.emptyAssignableList}>
                  <Text style={styles.emptyAssignableText}>Atanabilir aktif kullanıcı bulunamadı.</Text>
                </View>
              )}
              {selectedInspectorProfile ? (
                <Text style={styles.assignmentHint}>
                  Seçilen kullanıcı: {getProfileName(selectedInspectorProfile)} ({getProfileRole(selectedInspectorProfile)})
                </Text>
              ) : null}
              <Pressable
                onPress={assignInspector}
                style={[styles.blueButton, (!selectedInspector || assigning || assignmentMissingItems.length > 0) && styles.dimmedButton]}
                disabled={!selectedInspector || assigning || assignmentMissingItems.length > 0}
              >
                <Text style={styles.buttonText}>{assigning ? "Atanıyor..." : "Görevi Ata"}</Text>
              </Pressable>
            </>
          ) : null}
          {canCancelTask ? (
            <Pressable onPress={cancelInspection} style={[styles.cancelButton, cancelling && styles.dimmedButton]} disabled={cancelling}>
              <MaterialCommunityIcons name="close-octagon-outline" color="white" size={18} />
              <Text style={styles.buttonText}>{cancelling ? "İptal ediliyor..." : "Görevi İptal Et"}</Text>
            </Pressable>
          ) : null}
          {inspectionCancelled ? (
            <Pressable onPress={deleteInspection} style={[styles.deleteButton, deleting && styles.dimmedButton]} disabled={deleting}>
              <MaterialCommunityIcons name="trash-can-outline" color="white" size={18} />
              <Text style={styles.buttonText}>{deleting ? "Siliniyor..." : "Denetimi Sil"}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {showInspectionFlow ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saha İşlemleri</Text>
          {!inspectionStarted && !management ? (
            <View style={styles.startModeGrid}>
              <Pressable
                onPress={() => startInspection(startModeOptions[workflowKind].key)}
                style={[styles.startModeButton, { backgroundColor: startModeOptions[workflowKind].color }]}
              >
                <MaterialCommunityIcons name={startModeOptions[workflowKind].icon} color="white" size={19} />
                <Text style={styles.buttonText}>{startModeOptions[workflowKind].title}</Text>
              </Pressable>
            </View>
          ) : null}

          {!reportReady && !inspectionCancelled ? (
            <Pressable onPress={openQrScan} style={styles.qrButton}>
              <MaterialCommunityIcons name="qrcode-scan" color="#38bdf8" size={18} />
              <Text style={styles.qrButtonText}>QR ile Bilgi Al</Text>
            </Pressable>
          ) : null}

          {inspectionEditable ? (
            <Pressable onPress={takeEvidencePhoto} style={styles.cyanButton}>
              <MaterialCommunityIcons name="camera-outline" color="white" size={18} />
              <Text style={styles.buttonText}>Fotoğraf Çek</Text>
            </Pressable>
          ) : null}

          {inspectionCancelled ? (
            <View style={styles.cancelledNotice}>
              <MaterialCommunityIcons name="close-octagon-outline" color="#fecaca" size={20} />
              <Text style={styles.cancelledNoticeText}>Bu denetim admin tarafından iptal edildi.</Text>
            </View>
          ) : null}

        </View>
      ) : null}

      {inspectionEditable && fieldMode === "inspection" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ürün Doğrulama</Text>
          <View style={styles.segmentRow}>
            <Pressable
              onPress={() => setCropMatches("same")}
              style={[styles.segmentButton, cropMatches === "same" && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, cropMatches === "same" && styles.segmentTextActive]}>KOBÜKS ile aynı</Text>
            </Pressable>
            <Pressable
              onPress={() => setCropMatches("different")}
              style={[styles.segmentButton, cropMatches === "different" && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, cropMatches === "different" && styles.segmentTextActive]}>Farklı ürün</Text>
            </Pressable>
          </View>

          {cropMatches === "different" ? (
            <>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={selectedCrop} onValueChange={setSelectedCrop} style={styles.picker}>
                  <Picker.Item label="Re'sen ürün seç" value="" />
                  {PRODUCT_OPTIONS.map((item) => (
                    <Picker.Item key={item} label={item} value={item === "Diğer" ? "" : item} />
                  ))}
                </Picker>
              </View>
              <TextInput
                value={customCrop}
                onChangeText={setCustomCrop}
                placeholder="Listede yoksa re'sen yeni ürün gir"
                placeholderTextColor="#64748b"
                style={styles.input}
              />
            </>
          ) : null}

          {cropVerificationReady ? (
            <Pressable onPress={saveAndFinishInspection} style={[styles.orangeButton, saving && styles.dimmedButton]} disabled={saving}>
              <Text style={styles.buttonText}>{saving ? "Kaydediliyor..." : "Kaydet"}</Text>
            </Pressable>
          ) : null}

          <View style={styles.branchActionRow}>
            <Pressable onPress={() => openManualWorkflow("detection")} style={styles.branchButton}>
              <MaterialCommunityIcons name="sprout-outline" color="#38bdf8" size={18} />
              <Text style={styles.branchButtonText}>{"Re'sen Giriş"}</Text>
            </Pressable>
            <Pressable onPress={() => openManualWorkflow("classification")} style={styles.branchButton}>
              <MaterialCommunityIcons name="greenhouse" color="#f59e0b" size={18} />
              <Text style={styles.branchButtonText}>Sınıflandırma Girişi</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {inspectionEditable && (fieldMode === "detection" || fieldMode === "classification") ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{fieldMode === "classification" ? "Sera Sınıfı" : "Re'sen Kayıt"}</Text>
          <Pressable onPress={openPolygonEditor} style={styles.cyanButton}>
            <MaterialCommunityIcons name="shape-polygon-plus" color="white" size={18} />
            <Text style={styles.buttonText}>CBS Poligonu Çiz</Text>
          </Pressable>
          <View style={styles.manualGrid}>
            {manualFieldConfig.map((field) => (
              <ManualField
                key={field.key}
                label={field.label}
                value={manualFields[field.key] || ""}
                onChangeText={(value) => updateManualField(field.key, value)}
              />
            ))}
          </View>
          {manualEntryReady ? (
            <Pressable onPress={saveAndFinishInspection} style={[styles.greenButton, saving && styles.dimmedButton]} disabled={saving}>
              <Text style={styles.buttonText}>{saving ? "Kaydediliyor..." : "Kaydet"}</Text>
            </Pressable>
          ) : (
            <View style={styles.requirementsNotice}>
              <Text style={styles.requirementsTitle}>Kaydetmeden önce tamamlanmalı</Text>
              {!hasTaskCoordinates(task) ? <Text style={styles.requirementsText}>CBS poligonu çizilmeli.</Text> : null}
              {!evidence.length ? <Text style={styles.requirementsText}>En az bir saha kanıt fotoğrafı eklenmeli.</Text> : null}
            </View>
          )}
        </View>
      ) : null}

      {inspectionStarted ? (
        <>
          <Text style={styles.evidenceTitle}>Saha Kanıtları</Text>
          {evidence.length ? (
            evidence.map((item) => (
              <View key={item.id} style={styles.evidenceCard}>
                <Image source={{ uri: item.image_url }} style={styles.evidenceImage} />
                <Text style={styles.evidenceMeta}>GPS: {item.latitude}, {item.longitude}</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyEvidence}>
              <Text style={styles.emptyEvidenceText}>Henüz kanıt fotoğrafı yok.</Text>
            </View>
          )}
        </>
      ) : null}

      {(inspectionEditable || reportReady) && canInspectTask ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Rapor ve Kapanış</Text>
            </View>
            <MaterialCommunityIcons name="file-document-outline" color="#38bdf8" size={22} />
          </View>
          {incompleteInspectionItems.length && inspectionEditable ? (
            <View style={styles.requirementsNotice}>
              <Text style={styles.requirementsTitle}>Kaydetmeden önce tamamlanmalı</Text>
              {incompleteInspectionItems.map((item) => (
                <Text key={item} style={styles.requirementsText}>
                  {item}
                </Text>
              ))}
            </View>
          ) : null}

          {canCreateReport ? (
            <Pressable
              onPress={createReport}
              style={[styles.reportPrimaryButton, closingAction === "report" && styles.dimmedButton]}
              disabled={closingAction === "report"}
            >
              <MaterialCommunityIcons name="file-document-plus-outline" color="white" size={18} />
              <Text style={styles.buttonText}>{closingAction === "report" ? "Oluşturuluyor..." : "Rapor Oluştur"}</Text>
            </Pressable>
          ) : null}

          {canDownloadReport ? (
            <View style={styles.reportActionRow}>
              <Pressable
                onPress={shareReportPdf}
                style={[styles.reportPrimaryButton, closingAction === "pdf" && styles.dimmedButton]}
                disabled={closingAction === "pdf"}
              >
                <MaterialCommunityIcons name="file-pdf-box" color="white" size={18} />
                <Text style={styles.buttonText}>{closingAction === "pdf" ? "Hazırlanıyor..." : "PDF Al"}</Text>
              </Pressable>
              <Pressable
                onPress={shareReportExcel}
                style={[styles.excelButton, closingAction === "excel" && styles.dimmedButton]}
                disabled={closingAction === "excel"}
              >
                <MaterialCommunityIcons name="microsoft-excel" color="white" size={18} />
                <Text style={styles.buttonText}>{closingAction === "excel" ? "Hazırlanıyor..." : "Excel Al"}</Text>
              </Pressable>
            </View>
          ) : null}

          {canSyncKobuks ? (
            <Pressable
              onPress={syncTaskToKobuks}
              style={[styles.primaryButton, closingAction === "kobuks" && styles.dimmedButton]}
              disabled={closingAction === "kobuks"}
            >
              <MaterialCommunityIcons name="database-export-outline" color="white" size={18} />
              <Text style={styles.buttonText}>{closingAction === "kobuks" ? "Aktarılıyor..." : "KOBÜKS'e Aktar"}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      </ScrollView>
      <BottomTabMenu />
    </View>
  );
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function getReportDate(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString("tr-TR");
  }

  return date.toLocaleDateString("tr-TR");
}

function buildTaskCsv(task: any) {
  const headers = ["İl", "İlçe", "Mahalle", "Ürün", "Üretim yılı", "Ünite no", "Üretici", "Ada", "Parsel", "Durum", "Tarih"];
  const row = [
    task?.city || task?.province || task?.il || "",
    task?.district_name || task?.district || task?.ilce || "",
    task?.village || task?.neighborhood || task?.mahalle || "",
    task?.detected_crop || task?.crop_name || task?.crop || "",
    task?.production_year || task?.productionYear || "",
    task?.unit_no || "",
    task?.producer_name || "",
    task?.ada_no || "",
    task?.parcel_no || "",
    getTaskStatus(task),
    getReportDate(task?.updated_at || task?.created_at),
  ];

  return `\ufeff${[headers, row].map((items) => items.map(csvCell).join(";")).join("\n")}`;
}

function InfoCard({ label, value, helper }: { label: string; value: unknown; helper?: unknown }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{String(value || "-")}</Text>
      <Text style={styles.infoHelper} numberOfLines={1}>{String(helper || "-")}</Text>
    </View>
  );
}

function ManualField({
  label,
  onChangeText,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <View style={styles.manualField}>
      <Text style={styles.manualFieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="#64748b"
        style={styles.manualInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020617" },
  screen: { flex: 1, backgroundColor: "#020617" },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 104, gap: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#020617" },
  loadingText: { color: "#cbd5e1", marginTop: 10, fontWeight: "700" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  headerText: { flex: 1 },
  kicker: { color: "#38bdf8", fontSize: 12, fontWeight: "800" },
  title: { color: "white", fontSize: 30, fontWeight: "800", marginTop: 2 },
  subtitle: { color: "#94a3b8", marginTop: 4 },
  statusPill: {
    maxWidth: 110,
    borderRadius: 8,
    backgroundColor: "#f59e0b",
    color: "white",
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 8,
    overflow: "hidden",
  },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  infoCard: {
    width: "48%",
    minHeight: 92,
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 14,
  },
  infoLabel: { color: "#38bdf8", fontWeight: "800", fontSize: 12 },
  infoValue: { color: "white", fontWeight: "800", marginTop: 8 },
  infoHelper: { color: "#94a3b8", marginTop: 4 },
  actionRow: { flexDirection: "row", gap: 8 },
  callButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#0ea5e9",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  actionText: { color: "white", fontWeight: "800" },
  roleNotice: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#92400e",
    backgroundColor: "#422006",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roleNoticeText: {
    color: "#ffedd5",
    fontWeight: "800",
  },
  section: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: { color: "white", fontSize: 18, fontWeight: "800" },
  sectionMeta: { color: "#94a3b8", marginTop: 4, lineHeight: 18 },
  assignmentSummary: {
    flexDirection: "row",
    gap: 8,
  },
  assignmentSummaryItem: {
    flex: 1,
    minHeight: 66,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#111827",
    padding: 10,
    justifyContent: "center",
  },
  assignmentLabel: { color: "#38bdf8", fontSize: 11, fontWeight: "800" },
  assignmentValue: { color: "white", marginTop: 5, fontWeight: "800" },
  assignmentHint: { color: "#cbd5e1", fontWeight: "700", lineHeight: 18 },
  emptyAssignableList: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  emptyAssignableText: {
    color: "#cbd5e1",
    fontWeight: "700",
    textAlign: "center",
  },
  requirementsNotice: {
    backgroundColor: "#422006",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f59e0b",
    padding: 12,
    gap: 5,
  },
  requirementsTitle: { color: "#fed7aa", fontWeight: "800" },
  requirementsText: { color: "#ffedd5", fontWeight: "700", lineHeight: 18 },
  pickerWrap: { backgroundColor: "#1e293b", borderRadius: 8, overflow: "hidden" },
  picker: { color: "white" },
  blueButton: { minHeight: 48, borderRadius: 8, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  cyanButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#0ea5e9",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  greenButton: { minHeight: 48, borderRadius: 8, backgroundColor: "#16a34a", alignItems: "center", justifyContent: "center" },
  orangeButton: { minHeight: 48, borderRadius: 8, backgroundColor: "#f59e0b", alignItems: "center", justifyContent: "center" },
  cancelButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#991b1b",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  deleteButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#7f1d1d",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  reportActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  reportPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
  },
  excelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#15803d",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
  },
  dimmedButton: { opacity: 0.75 },
  buttonText: { color: "white", fontWeight: "800", textAlign: "center" },
  startModeGrid: {
    gap: 8,
  },
  startModeButton: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
  },
  qrButton: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
  },
  qrButtonText: {
    color: "#38bdf8",
    fontWeight: "800",
  },
  segmentRow: { flexDirection: "row", gap: 8 },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    paddingHorizontal: 8,
  },
  segmentActive: { backgroundColor: "#14532d", borderColor: "#22c55e" },
  segmentText: { color: "#94a3b8", fontWeight: "800", textAlign: "center" },
  segmentTextActive: { color: "white" },
  branchActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  branchButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 8,
  },
  branchButtonText: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1e293b",
    color: "white",
    paddingHorizontal: 12,
  },
  manualGrid: {
    gap: 9,
  },
  manualField: {
    gap: 6,
  },
  manualFieldLabel: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "800",
  },
  manualInput: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1e293b",
    color: "white",
    paddingHorizontal: 12,
  },
  evidenceTitle: { color: "white", fontSize: 20, fontWeight: "800" },
  evidenceCard: { backgroundColor: "#0f172a", borderRadius: 8, padding: 12, gap: 10 },
  evidenceImage: { width: "100%", height: 220, borderRadius: 8 },
  evidenceMeta: { color: "#94a3b8" },
  emptyEvidence: { backgroundColor: "#0f172a", borderRadius: 8, padding: 16 },
  emptyEvidenceText: { color: "#94a3b8", fontWeight: "700" },
  cancelledNotice: {
    backgroundColor: "#450a0a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#991b1b",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cancelledNoticeText: { flex: 1, color: "#fee2e2", fontWeight: "800", lineHeight: 18 },
});
