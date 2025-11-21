// src/lib/uploadToR2.ts

export async function uploadFileToR2(
  file: File,
  userId: string,
  folder: string
) {
  // Tạo tên file an toàn
  const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
  const fileName = `${folder}/${userId}-${crypto.randomUUID()}-${safeName}`;

  // Convert file sang base64 (browser-compatible)
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  const params = new URLSearchParams({
    fileName,
    fileType: file.type || "application/octet-stream",
  });

  const res = await fetch(`/api/upload-to-r2?${params.toString()}`, {
    method: "POST",
    body: base64,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  return json.url as string;
}
