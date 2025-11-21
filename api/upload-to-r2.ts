import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const config = {
  runtime: "edge",
};

export default async function handler(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const filename = form.get("filename") as string | null;

    if (!file || !filename) {
      return new Response(JSON.stringify({ error: "Missing file or filename" }), {
        status: 400,
      });
    }

    const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
    const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
    const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
    const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
    const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL!;

    const client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: filename,
        Body: buffer,
        ContentType: file.type,
      })
    );

    const publicUrl = `${R2_PUBLIC_BASE_URL}/${filename}`;

    return new Response(JSON.stringify({ publicUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
