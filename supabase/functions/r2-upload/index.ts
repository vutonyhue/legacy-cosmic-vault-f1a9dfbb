import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256Hex(message: Uint8Array | string): Promise<string> {
  const encoder = new TextEncoder();
  const data = typeof message === "string" ? encoder.encode(message) : message;
  const hashBuffer = await crypto.subtle.digest("SHA-256", data.buffer as ArrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    (key instanceof Uint8Array ? key : new Uint8Array(key)) as any,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
}

function toUint8Array(buffer: ArrayBuffer): Uint8Array {
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

async function signR2Request(params: {
  method: string;
  url: URL;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  payloadHash: string;
  contentType: string;
}): Promise<{ headers: Record<string, string> }>
{
  const { method, url, region, service, accessKeyId, secretAccessKey, payloadHash, contentType } = params;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDD'T'HHMMSS'Z'
  const dateStamp = amzDate.substring(0, 8);

  const host = url.host;

  const canonicalUri = url.pathname || "/";
  const canonicalQuerystring = ""; // no query params

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-acl:public-read\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = "content-type;host;x-amz-acl;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = await hmacSha256(new TextEncoder().encode("AWS4" + secretAccessKey), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "aws4_request");

  const signature = await sha256Hex(
    toUint8Array(
      await hmacSha256(kSigning, stringToSign),
    ),
  );

  const authorizationHeader =
    `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    headers: {
      "Content-Type": contentType,
      "x-amz-acl": "public-read",
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorizationHeader,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authenticated user id from JWT (Edge Function already validates the token)
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    let userId: string | null = null;

    try {
      const payload = JSON.parse(atob(token.split(".")[1] || ""));
      userId =
        (payload.sub as string | undefined) ??
        (payload.user_id as string | undefined) ??
        (payload.id as string | undefined) ??
        null;
    } catch (e) {
      console.error("Failed to decode JWT in r2-upload:", e);
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get R2 credentials from environment
    const accountId = Deno.env.get("R2_ACCOUNT_ID");
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const bucketName = Deno.env.get("R2_BUCKET_NAME");

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      console.error("Missing R2 configuration", { accountId: !!accountId, bucketName: !!bucketName });
      return new Response(JSON.stringify({ error: "R2 credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/${crypto.randomUUID()}.${fileExt}`;

    // Build R2 URL and payload
    const bucketHost = `${bucketName}.${accountId}.r2.cloudflarestorage.com`;
    const url = new URL(`https://${bucketHost}/${fileName}`);

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const contentType = file.type || "application/octet-stream";
    const payloadHash = await sha256Hex(uint8Array);

    const { headers: signedHeaders } = await signR2Request({
      method: "PUT",
      url,
      region: "auto",
      service: "s3",
      accessKeyId,
      secretAccessKey,
      payloadHash,
      contentType,
    });

    const putResponse = await fetch(url.toString(), {
      method: "PUT",
      headers: signedHeaders,
      body: uint8Array,
    });

    if (!putResponse.ok) {
      const errorText = await putResponse.text();
      console.error("R2 PUT failed", putResponse.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to upload to R2" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const publicUrl = `https://${bucketHost}/${fileName}`;

    console.log("File uploaded successfully to R2:", fileName);

    return new Response(
      JSON.stringify({
        fileName,
        publicUrl,
        fileType: file.type.startsWith("image/") ? "image" : "video",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in r2-upload:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
