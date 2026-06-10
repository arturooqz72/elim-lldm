import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface B2AuthResponse {
  apiUrl: string;
  authorizationToken: string;
  accountId: string;
  message?: string;
  code?: string;
}

interface B2Bucket {
  bucketId: string;
  bucketName: string;
}

interface B2ListBucketsResponse {
  buckets?: B2Bucket[];
  message?: string;
  code?: string;
}

interface B2UploadUrlResponse {
  uploadUrl: string;
  authorizationToken: string;
  message?: string;
  code?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const keyId = process.env.B2_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;
  const bucketName = process.env.B2_BUCKET_NAME;
  const endpoint = process.env.B2_ENDPOINT;
  const publicBaseUrl = process.env.B2_PUBLIC_BASE_URL;

  if (!keyId || !applicationKey || !bucketName) {
    return NextResponse.json(
      { error: "Faltan variables de entorno de Backblaze en Vercel." },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    fileName?: string;
  };
  const { fileName } = body;

  if (!fileName || typeof fileName !== "string") {
    return NextResponse.json({ error: "Falta fileName válido." }, { status: 400 });
  }

  const cleanFileName = fileName.trim().replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-");

  if (!cleanFileName) {
    return NextResponse.json({ error: "fileName no es válido." }, { status: 400 });
  }

  const finalFileName = `videos/${user.id}/${Date.now()}-${cleanFileName}`;

  const authString = Buffer.from(`${keyId}:${applicationKey}`).toString("base64");

  try {
    const authResponse = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
      method: "GET",
      headers: { Authorization: `Basic ${authString}` },
    });

    const authData = (await authResponse.json()) as B2AuthResponse;

    if (!authResponse.ok) {
      return NextResponse.json(
        { error: authData?.message || authData?.code || "No se pudo autorizar con Backblaze." },
        { status: 500 }
      );
    }

    const listBucketsResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_list_buckets`, {
      method: "POST",
      headers: {
        Authorization: authData.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accountId: authData.accountId, bucketName }),
    });

    const listBucketsData = (await listBucketsResponse.json()) as B2ListBucketsResponse;

    if (!listBucketsResponse.ok) {
      return NextResponse.json(
        { error: listBucketsData?.message || listBucketsData?.code || "No se pudo obtener el bucket." },
        { status: 500 }
      );
    }

    const bucket = listBucketsData?.buckets?.find((b) => b.bucketName === bucketName);

    if (!bucket?.bucketId) {
      return NextResponse.json({ error: `No se encontró el bucket ${bucketName}.` }, { status: 500 });
    }

    const uploadUrlResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_upload_url`, {
      method: "POST",
      headers: {
        Authorization: authData.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bucketId: bucket.bucketId }),
    });

    const uploadUrlData = (await uploadUrlResponse.json()) as B2UploadUrlResponse;

    if (!uploadUrlResponse.ok) {
      return NextResponse.json(
        { error: uploadUrlData?.message || uploadUrlData?.code || "No se pudo obtener upload URL." },
        { status: 500 }
      );
    }

    let publicUrl: string | null = null;

    if (publicBaseUrl) {
      publicUrl = `${publicBaseUrl.replace(/\/+$/, "")}/${finalFileName}`;
    } else if (endpoint) {
      publicUrl = `${endpoint.replace(/\/+$/, "")}/file/${bucketName}/${finalFileName}`;
    }

    return NextResponse.json({
      uploadUrl: uploadUrlData.uploadUrl,
      authorizationToken: uploadUrlData.authorizationToken,
      fileName: finalFileName,
      publicUrl,
    });
  } catch (error) {
    console.error("B2 upload init error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno preparando subida a Backblaze." },
      { status: 500 }
    );
  }
}
