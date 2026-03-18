import { NextResponse } from "next/server"

export async function GET() {
  try {
    const falKey = process.env.FAL_KEY

    if (!falKey) {
      return NextResponse.json(
        {
          error: "FAL_KEY not configured",
          hasKey: false,
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      )
    }

    // Test Fal AI connection
    const response = await fetch("https://queue.fal.run/fal-ai/nano-banana-2", {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: "test",
        num_images: 0,
      }),
    })

    return NextResponse.json({
      success: true,
      hasKey: true,
      model: "nano-banana-2",
      message: "Fal AI API key is configured",
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Connection error: " + error.message,
        hasKey: !!process.env.FAL_KEY,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
