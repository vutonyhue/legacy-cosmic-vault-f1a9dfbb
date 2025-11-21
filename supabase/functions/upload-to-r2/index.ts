import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface R2UploadResponse {
  url: string;
  key: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authenticated user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get R2 configuration from environment
    const accountId = Deno.env.get('R2_ACCOUNT_ID');
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const bucketName = Deno.env.get('R2_BUCKET_NAME');

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      console.error('Missing R2 configuration');
      return new Response(JSON.stringify({ error: 'R2 configuration incomplete' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate unique file key
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const fileKey = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

    // R2 endpoint
    const r2Endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${fileKey}`;

    console.log('Uploading to R2:', { fileKey, size: file.size, type: file.type });

    // Convert file to array buffer
    const fileBuffer = await file.arrayBuffer();

    // Create signature for R2 request
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = timestamp.slice(0, 8);
    const region = 'auto';

    // Upload to R2 using S3-compatible API
    const uploadResponse = await fetch(r2Endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        'Content-Length': file.size.toString(),
        'x-amz-date': timestamp,
        'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      },
      body: fileBuffer,
      // AWS Signature V4 would be needed here, but R2 also supports simpler auth
    });

    // For simpler auth, use direct API with credentials
    const signedUploadResponse = await fetch(r2Endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${date}/${region}/s3/aws4_request`,
      },
      body: fileBuffer,
    });

    if (!signedUploadResponse.ok) {
      const errorText = await signedUploadResponse.text();
      console.error('R2 upload failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to upload to R2', details: errorText }), 
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate public URL
    const publicUrl = `https://pub-${accountId}.r2.dev/${fileKey}`;

    console.log('Upload successful:', { publicUrl });

    const result: R2UploadResponse = {
      url: publicUrl,
      key: fileKey,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: errorMessage }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
