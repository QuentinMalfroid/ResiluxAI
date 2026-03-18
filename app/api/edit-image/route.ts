import { type NextRequest, NextResponse } from "next/server"
import { fal } from "@fal-ai/client"

// Configuration pour augmenter la limite de taille
export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    // Check if Fal AI API key is set
    const falKey = process.env.FAL_KEY
    if (!falKey) {
      return NextResponse.json({ error: "Fal AI API key is not configured" }, { status: 500 })
    }

    // Configure fal client
    fal.config({ credentials: falKey })

    const { imageData, stoneColor } = await request.json()

    if (!imageData || !stoneColor) {
      return NextResponse.json({ error: "Image data and stone color are required" }, { status: 400 })
    }

    // Vérifier la taille de l'image base64
    const imageSizeInBytes = (imageData.length * 3) / 4
    const imageSizeInMB = imageSizeInBytes / (1024 * 1024)

    console.log(`Image size: ${imageSizeInMB.toFixed(2)}MB`)

    if (imageSizeInMB > 10) {
      return NextResponse.json(
        {
          error: `Image trop lourde: ${imageSizeInMB.toFixed(2)}MB. Veuillez réduire la qualité.`,
        },
        { status: 413 },
      )
    }

    // Create the detailed prompt with the selected stone color
    const prompt = `Edit this photo of a terrace to apply a realistic resin-bound gravel surface on the terrace floor only.

IMPORTANT RULES:
- ONLY modify the terrace floor/ground surface
- DO NOT alter walls, background, sky, trees, furniture, or any other elements
- Preserve the exact same perspective, lighting, and shadows from the original photo
- The new surface must blend naturally with the existing lighting conditions

SURFACE DETAILS:
- Material: Resin-bound gravel finish (small tightly-packed pebbles embedded in resin)
- Stone color: ${stoneColor}
- Texture: Natural, slightly irregular pebble pattern typical of modern outdoor terraces
- Finish: Smooth, professional installation look

The goal is a photorealistic visualization of a terrace resurfaced with ${stoneColor} stone-resin finish.`

    // Upload the image to Fal storage
    console.log("Uploading image to Fal storage...")
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, "")
    const buffer = Buffer.from(base64Data, "base64")
    const blob = new Blob([buffer], { type: "image/jpeg" })
    const imageUrl = await fal.storage.upload(new File([blob], "terrace.jpg", { type: "image/jpeg" }))

    console.log("Image uploaded, calling Nano Banana 2 edit endpoint...")
    console.log("Stone color:", stoneColor)

    // Call Nano Banana 2 edit endpoint
    const result = await fal.subscribe("fal-ai/nano-banana-2/edit", {
      input: {
        prompt,
        image_urls: [imageUrl],
        aspect_ratio: "1:1",
        output_format: "png",
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs?.forEach((log) => console.log("[Fal]", log.message))
        }
      },
    })

    console.log("Fal AI response received")

    const outputImage = (result.data as any)?.images?.[0]?.url
    if (!outputImage) {
      console.error("No image in response:", result)
      return NextResponse.json({ error: "No image data returned from Fal AI" }, { status: 500 })
    }

    console.log("Image generated successfully")

    return NextResponse.json({
      imageUrl: outputImage,
      apiResponse: {
        model: "nano-banana-2",
        stoneColor: stoneColor,
      },
    })
  } catch (error: any) {
    console.error("Error editing image:", error)
    return NextResponse.json(
      { error: error.message || "An error occurred while processing the image" },
      { status: 500 },
    )
  }
}
