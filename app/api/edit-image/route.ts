import { type NextRequest, NextResponse } from "next/server"

// Configuration pour augmenter la limite de taille
export const maxDuration = 30
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    // Check if OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key is not configured" }, { status: 500 })
    }

    const { imageData, stoneColor } = await request.json()

    if (!imageData || !stoneColor) {
      return NextResponse.json({ error: "Image data and stone color are required" }, { status: 400 })
    }

    // Vérifier la taille de l'image base64
    const imageSizeInBytes = (imageData.length * 3) / 4 // Approximation de la taille en bytes
    const imageSizeInMB = imageSizeInBytes / (1024 * 1024)

    console.log(`Image size: ${imageSizeInMB.toFixed(2)}MB`)

    if (imageSizeInMB > 3) {
      return NextResponse.json(
        {
          error: `Image trop lourde: ${imageSizeInMB.toFixed(2)}MB. Veuillez réduire la qualité.`,
        },
        { status: 413 },
      )
    }

    // Create the detailed prompt with the selected stone color
    const prompt = `You are given a photo of a terrace (can be flat concrete, asphalt, or similar). Your task is to digitally overlay a realistic resin-bound gravel surface on the terrace floor only, without altering the walls, background, or perspective of the original photo.

The texture must simulate a resin and gravel finish, typical of modern outdoor terraces. The gravel should consist of small pebbles that are tightly packed together.

Use the following parameters:
• Stone color: ${stoneColor}

The resulting surface must reflect the correct lighting and shadows of the original image. Do not add furniture or additional elements. The rest of the terrace and the surrounding environment (walls, sky, trees) should remain untouched.

The goal is to help clients visualize what their terrace would look like once resurfaced with this specific stone-resin finish.`

    // Convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, "")
    const buffer = Buffer.from(base64Data, "base64")

    console.log(`Buffer size: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`)

    // Create FormData for the API request
    const apiFormData = new FormData()

    // Create a new File object from the buffer
    const processedFile = new File([buffer], "image.png", {
      type: "image/png",
    })

    apiFormData.append("image", processedFile)
    apiFormData.append("prompt", prompt)
    apiFormData.append("model", "gpt-image-1")
    apiFormData.append("n", "1")
    apiFormData.append("size", "1024x1024")

    console.log("Making API request to OpenAI with model gpt-image-1...")
    console.log("Stone color:", stoneColor)

    // Make a direct API call to OpenAI
    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: apiFormData,
    })

    console.log("API response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("API error response:", errorText)

      let errorMessage = "API request failed"
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.error?.message || `Image processing error: ${errorData.error?.type || "Unknown error"}`
      } catch {
        errorMessage = `API request failed with status ${response.status}: ${errorText}`
      }

      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    const result = await response.json()
    console.log("Full API response:", JSON.stringify(result, null, 2))

    // Extract the image URL (default format for image editing API)
    const imageUrl = result.data[0]?.url
    const imageB64 = result.data[0]?.b64_json

    if (!imageUrl && !imageB64) {
      console.error("No image URL or b64_json found in response:", result)
      return NextResponse.json({ error: "No image data returned from OpenAI" }, { status: 500 })
    }

    console.log("Image data received:", imageUrl ? "URL" : "Base64")

    // Return the image URL or convert base64 to data URL
    return NextResponse.json({
      imageUrl: imageUrl || `data:image/png;base64,${imageB64}`,
      apiResponse: {
        created: result.created,
        usage: result.usage || null,
        model: "gpt-image-1",
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
