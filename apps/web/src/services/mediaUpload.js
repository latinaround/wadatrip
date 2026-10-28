// Closed until backend-owned storage authorization, content validation and retention are verified.
// A client environment flag cannot enable device uploads.
export const IMAGE_UPLOADS_ENABLED = false;

export async function uploadImageFile() {
  throw new Error('Device uploads are paused during the operator beta. Use a reviewed public photo URL or a Wadatrip destination cover. Do not submit identity documents here.');
}

export default { uploadImageFile };
