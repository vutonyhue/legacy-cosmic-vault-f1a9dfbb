export async function uploadFileToR2(file: File, userId: string, folder: string) {
  const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
  const filename = `${folder}/${userId}-${crypto.randomUUID()}-${safeName}`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("filename", filename);

  const res = await fetch("/api/upload-to-r2", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Upload failed: " + err);
  }

  const json = await res.json();
  return json.publicUrl as string;
}
