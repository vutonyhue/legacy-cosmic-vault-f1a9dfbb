// 🚨 BẮT BUỘC: Dùng Node.js runtime để AWS SDK chạy được
export const config = {
  runtime: "nodejs",
};

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fileName, fileType } = req.query;
    const file = req.body;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Validate environment variables
    const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
    const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
    const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
    const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
    const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_BASE_URL) {
      console.error("Missing R2 environment variables:", {
        hasAccountId: !!R2_ACCOUNT_ID,
        hasAccessKey: !!R2_ACCESS_KEY_ID,
        hasSecretKey: !!R2_SECRET_ACCESS_KEY,
        hasBucketName: !!R2_BUCKET_NAME,
        hasPublicUrl: !!R2_PUBLIC_BASE_URL
      });
      return res.status(500).json({ error: "Server configuration error - missing R2 credentials" });
    }

    const client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const upload = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
      Body: Buffer.from(file, "base64"),
      ContentType: fileType,
    });

    await client.send(upload);

    const publicUrl = `${R2_PUBLIC_BASE_URL}/${fileName}`;

    return res.status(200).json({ url: publicUrl });

  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Upload failed", details: err.message });
  }
}
