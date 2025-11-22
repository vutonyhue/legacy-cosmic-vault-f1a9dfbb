// src/lib/uploadToR2.ts
import { supabase } from '@/integrations/supabase/client';

export async function uploadFileToR2(
  file: File,
  userId: string,
  folder: string
) {
  // Tạo tên file an toàn
  const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
  const fileName = `${folder}/${userId}-${crypto.randomUUID()}-${safeName}`;

  // Bước 1: Lấy presigned URL từ edge function
  const { data, error } = await supabase.functions.invoke('generate-r2-presigned-url', {
    body: {
      fileName,
      fileType: file.type || "application/octet-stream",
    },
  });

  if (error || !data) {
    console.error('Failed to get presigned URL:', error);
    throw new Error('Failed to get upload URL');
  }

  const { presignedUrl, publicUrl } = data;

  // Bước 2: Upload trực tiếp lên R2 qua presigned URL
  const uploadRes = await fetch(presignedUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    console.error('R2 upload failed:', uploadRes.status, text);
    throw new Error(`Upload failed: ${uploadRes.status} ${text}`);
  }

  // Trả về public URL
  return publicUrl;
}
