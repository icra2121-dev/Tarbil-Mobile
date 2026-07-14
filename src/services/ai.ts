export async function analyzeCropImage(
  imageUrl
) {

  return {
    disease:
      "Leaf Rust",

    confidence:
      0.94,

    recommendation:
      "Apply fungicide",

    detectedCrop:
      "Domates",

    registeredCrop:
      "Domates",

    riskScore:
      24,

    status:
      "Bekliyor",
  };
}
