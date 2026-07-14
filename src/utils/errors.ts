export function getErrorMessage(
  error
) {

  if (!error) {
    return "Bilinmeyen hata";
  }

  return (
    error.message ||
    "İşlem başarısız"
  );
}
