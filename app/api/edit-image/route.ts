// This route is no longer used - Fal AI calls are made directly from the client
// via the proxy at /api/fal/proxy
import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    { error: "This endpoint is deprecated. Use the Fal AI proxy instead." },
    { status: 410 },
  )
}
