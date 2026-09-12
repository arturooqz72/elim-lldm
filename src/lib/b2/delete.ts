import "server-only";

interface B2AuthResponse {
  apiUrl: string;
  authorizationToken: string;
  accountId: string;
  message?: string;
  code?: string;
}

interface B2Bucket {
  bucketId: string;
  bucketName: string;
}

interface B2ListBucketsResponse {
  buckets?: B2Bucket[];
  message?: string;
  code?: string;
}

interface B2FileNameEntry {
  fileId: string;
  fileName: string;
}

interface B2ListFileNamesResponse {
  files?: B2FileNameEntry[];
  message?: string;
  code?: string;
}

interface B2DeleteResponse {
  message?: string;
  code?: string;
}

/**
 * Borra un archivo de Backblaze B2 por su nombre completo (path dentro del
 * bucket), usando la API nativa de B2 — mismo patrón que ya usan las rutas
 * de subida (api/*\/b2-upload). Usado por el cron de purga de grabaciones.
 */
export async function deleteB2File(fileName: string): Promise<void> {
  const keyId = process.env.B2_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;
  const bucketName = process.env.B2_BUCKET_NAME;

  if (!keyId || !applicationKey || !bucketName) {
    throw new Error("Faltan variables de entorno de Backblaze en Vercel.");
  }

  const authString = Buffer.from(`${keyId}:${applicationKey}`).toString("base64");

  const authResponse = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    method: "GET",
    headers: { Authorization: `Basic ${authString}` },
  });
  const authData = (await authResponse.json()) as B2AuthResponse;
  if (!authResponse.ok) {
    throw new Error(authData?.message || authData?.code || "No se pudo autorizar con Backblaze.");
  }

  const listBucketsResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_list_buckets`, {
    method: "POST",
    headers: { Authorization: authData.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ accountId: authData.accountId, bucketName }),
  });
  const listBucketsData = (await listBucketsResponse.json()) as B2ListBucketsResponse;
  if (!listBucketsResponse.ok) {
    throw new Error(listBucketsData?.message || listBucketsData?.code || "No se pudo obtener el bucket.");
  }

  const bucket = listBucketsData?.buckets?.find((b) => b.bucketName === bucketName);
  if (!bucket?.bucketId) {
    throw new Error(`No se encontró el bucket ${bucketName}.`);
  }

  const listFilesResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_list_file_names`, {
    method: "POST",
    headers: { Authorization: authData.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId: bucket.bucketId, startFileName: fileName, maxFileCount: 1 }),
  });
  const listFilesData = (await listFilesResponse.json()) as B2ListFileNamesResponse;
  if (!listFilesResponse.ok) {
    throw new Error(listFilesData?.message || listFilesData?.code || "No se pudo buscar el archivo.");
  }

  const file = listFilesData?.files?.find((f) => f.fileName === fileName);
  if (!file) {
    // Ya no existe (borrado a mano, o dos corridas del cron se cruzaron) — no es un error.
    return;
  }

  const deleteResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_delete_file_version`, {
    method: "POST",
    headers: { Authorization: authData.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.fileName, fileId: file.fileId }),
  });
  const deleteData = (await deleteResponse.json()) as B2DeleteResponse;
  if (!deleteResponse.ok) {
    throw new Error(deleteData?.message || deleteData?.code || "No se pudo borrar el archivo.");
  }
}
