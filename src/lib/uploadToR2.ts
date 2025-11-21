// src/lib/uploadToR2.ts

export async function uploadFileToR2(
  file: File,
  userId: string,
  folder: string
) {
  // Tạo tên file an toàn
  const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
  const filename = `${folder}/${userId}-${crypto.randomUUID()}-${safeName}`;

  const params = new URLSearchParams({
    filename,
    contentType: file.type || "application/octet-stream",
  });

  const res = await fetch(`/api/upload-to-r2?${params.toString()}`, {
    method: "POST",
    body: file, // gửi RAW file, không dùng FormData
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  return json.publicUrl as string;
}
