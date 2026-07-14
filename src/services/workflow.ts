import {
  analyzeCropImage,
} from "./ai";

import {
  createTask,
} from "./tasks";

export async function runAiWorkflow({
  imageUri,
  parcel,
}) {

  const aiResult =
    await analyzeCropImage(
      imageUri
    );

  await createTask({
    user_name:"İsmail ZENGİN",

    parcel_no:parcel,

    district:"Aksu",

    detected_crop:
      aiResult.detectedCrop,

    registered_crop:
      aiResult.registeredCrop,

    risk_score:
      aiResult.riskScore,

    status:
      aiResult.status,
  });

  return aiResult;
}
