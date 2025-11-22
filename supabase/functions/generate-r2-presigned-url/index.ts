const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const encoder = new TextEncoder();

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(message: string): Promise<string> {
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hash);
}

async function hmacSha256(key: ArrayBuffer | string, data: string): Promise<ArrayBuffer> {
  const keyData = typeof key === 'string' ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

async function getSigningKey(secretKey: string, dateStamp: string, region: string, service: string) {
  const kDate = await hmacSha256('AWS4' + secretKey, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  return kSigning;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileName, fileType } = await req.json();

    if (!fileName || !fileType) {
      return new Response(
        JSON.stringify({ error: 'fileName and fileType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID');
    const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID');
    const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME');
    const R2_PUBLIC_BASE_URL = Deno.env.get('R2_PUBLIC_BASE_URL');

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_BASE_URL) {
      console.error('Missing R2 environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error - missing R2 credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const region = 'auto';
    const service = 's3';
    const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const endpoint = `https://${host}`;

    console.log('Generating presigned URL for:', { fileName, fileType, bucket: R2_BUCKET_NAME });

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
    const dateStamp = amzDate.slice(0, 8); // YYYYMMDD

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

    const method = 'PUT';
    const keyPath = `${R2_BUCKET_NAME}/${fileName}`;
    const canonicalUri = `/${encodeURI(keyPath)}`;

    const expiresIn = 60 * 60; // 1 hour

    const queryParams: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${R2_ACCESS_KEY_ID}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresIn),
      'X-Amz-SignedHeaders': 'host',
    };

    const sortedKeys = Object.keys(queryParams).sort();
    const canonicalQueryString = sortedKeys
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');

    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = 'host';
    const payloadHash = 'UNSIGNED-PAYLOAD';

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const hashedCanonicalRequest = await sha256Hex(canonicalRequest);

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      hashedCanonicalRequest,
    ].join('\n');

    const signingKey = await getSigningKey(R2_SECRET_ACCESS_KEY, dateStamp, region, service);
    const signature = bufferToHex(await hmacSha256(signingKey, stringToSign));

    const presignedUrl = `${endpoint}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
    const publicUrl = `${R2_PUBLIC_BASE_URL}/${fileName}`;

    console.log('Presigned URL generated successfully for:', fileName);

    return new Response(
      JSON.stringify({ presignedUrl, publicUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error generating presigned URL:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to generate presigned URL', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
