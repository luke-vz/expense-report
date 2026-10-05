import { NextRequest, NextResponse } from "next/server";
import { readPhoto } from "@/lib/photos";

// GET /api/photos/receipts/<uuid>.jpg — protected by the auth middleware like all of /api
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const body = await readPhoto(key.join("/"));
  if (!body) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  return new NextResponse(body as BodyInit, {
    headers: {
      "Content-Type": "image/jpeg",
      // Keys are random and photos never change; "private" keeps shared caches out
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
