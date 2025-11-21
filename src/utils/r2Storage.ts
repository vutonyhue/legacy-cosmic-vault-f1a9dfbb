import { supabase } from "@/integrations/supabase/client";

export interface UploadResult {
  fileName: string;
  publicUrl: string;
  fileType: string;
}

/**
 * Upload file to Cloudflare R2 storage
 * @param file - File to upload
 * @param fileType - Type of file (image or video)
 * @returns Upload result with fileName and publicUrl
 */
export async function uploadToR2(
  file: File,
  fileType: 'image' | 'video'
): Promise<UploadResult> {
  try {
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileType', fileType);

    // Call edge function to upload to R2
    const { data, error } = await supabase.functions.invoke('r2-upload', {
      body: formData,
    });

    if (error) {
      console.error('R2 upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    if (!data || !data.fileName || !data.publicUrl) {
      throw new Error('Invalid response from upload service');
    }

    return {
      fileName: data.fileName,
      publicUrl: data.publicUrl,
      fileType: data.fileType,
    };
  } catch (error) {
    console.error('Error uploading to R2:', error);
    throw error;
  }
}

/**
 * Get public URL for a file in R2
 * @param fileName - File name in R2 bucket
 * @returns Public URL
 */
export async function getR2Url(fileName: string): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('r2-get-url', {
      body: { fileName },
    });

    if (error) {
      console.error('Error getting R2 URL:', error);
      throw new Error(`Failed to get URL: ${error.message}`);
    }

    if (!data || !data.publicUrl) {
      throw new Error('Invalid response from URL service');
    }

    return data.publicUrl;
  } catch (error) {
    console.error('Error getting R2 URL:', error);
    throw error;
  }
}

/**
 * Delete file from R2 storage
 * Note: This requires implementing a delete edge function
 * @param fileName - File name to delete
 */
export async function deleteFromR2(fileName: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('r2-delete', {
      body: { fileName },
    });

    if (error) {
      console.error('R2 delete error:', error);
      throw new Error(`Delete failed: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting from R2:', error);
    throw error;
  }
}
