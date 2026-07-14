export function calculateRisk(
  confidence
) {

  if (confidence >= 90) {
    return 90;
  }

  if (confidence >= 70) {
    return 70;
  }

  return 40;
}
