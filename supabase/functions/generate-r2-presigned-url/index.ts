import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.637.0";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.637.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Get R2 credentials from environment
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

    const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

    console.log('Generating presigned URL for:', { fileName, fileType, bucket: R2_BUCKET_NAME });

    // Create S3 client
    const client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    // Create command for PUT operation
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
      ContentType: fileType,
    });

    // Generate presigned URL (valid for 1 hour)
    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
    const publicUrl = `${R2_PUBLIC_BASE_URL}/${fileName}`;

    console.log('Presigned URL generated successfully for:', fileName);

    return new Response(
      JSON.stringify({ 
        presignedUrl,
        publicUrl 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error generating presigned URL:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to generate presigned URL', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
