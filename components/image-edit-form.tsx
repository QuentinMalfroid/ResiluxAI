"use client"

import type React from "react"
import { useState, useRef } from "react"
import { fal } from "@fal-ai/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Loader2, Upload, Download } from "lucide-react"
import { BeforeAfterSlider } from "./before-after-slider"

// Configure fal client to use our server proxy (hides API key)
fal.config({ proxyUrl: "/api/fal/proxy" })

const STONE_COLORS = [
  { value: "Light Grey", label: "Gris Clair", color: "#D1D5DB" },
  { value: "Dark Grey", label: "Gris Foncé", color: "#6B7280" },
  { value: "Beige", label: "Beige", color: "#D2B48C" },
]

function buildPrompt(stoneColor: string) {
  return `Edit this photo of a terrace to apply a realistic resin-bound gravel surface on the terrace floor only.

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
}

export function ImageEditForm() {
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [processedImageData, setProcessedImageData] = useState<string | null>(null)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState("Light Grey")

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const processImageForAPI = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const img = new Image()

      img.onload = () => {
        const maxSize = 1024
        let width = img.width
        let height = img.height

        if (width > maxSize || height > maxSize) {
          const scale = Math.min(maxSize / width, maxSize / height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }

        canvas.width = width
        canvas.height = height

        if (ctx) {
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = "high"
          ctx.drawImage(img, 0, 0, width, height)

          const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
          const sizeInMB = ((dataUrl.length * 3) / 4) / (1024 * 1024)
          console.log(`Image: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${sizeInMB.toFixed(2)}MB (${width}x${height})`)
          resolve(dataUrl)
        } else {
          reject(new Error("Failed to get canvas context"))
        }
      }

      img.onerror = () => reject(new Error("Failed to load image"))

      const reader = new FileReader()
      reader.onload = () => { img.src = reader.result as string }
      reader.onerror = () => reject(new Error("Failed to read file"))
      reader.readAsDataURL(file)
    })
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        setError("L'image doit faire moins de 20MB.")
        return
      }

      if (!file.type.includes("png") && !file.type.includes("jpeg") && !file.type.includes("jpg")) {
        setError("Veuillez uploader une image PNG ou JPEG.")
        return
      }

      setError(null)
      setResultImage(null)
      setProcessing(true)
      setImage(file)

      try {
        const reader = new FileReader()
        reader.onload = () => setImagePreview(reader.result as string)
        reader.readAsDataURL(file)

        const processedData = await processImageForAPI(file)
        setProcessedImageData(processedData)
      } catch (err: any) {
        setError("Erreur lors du traitement de l'image: " + err.message)
      } finally {
        setProcessing(false)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!processedImageData) return

    setLoading(true)
    setError(null)
    setResultImage(null)

    try {
      // Upload image to Fal storage first
      const base64 = processedImageData.split(",")[1]
      const byteArray = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const blob = new Blob([byteArray], { type: "image/jpeg" })
      const file = new File([blob], "terrace.jpg", { type: "image/jpeg" })

      console.log("Uploading image to Fal storage...")
      const imageUrl = await fal.storage.upload(file)
      console.log("Image uploaded:", imageUrl)

      // Call Nano Banana 2 edit endpoint via proxy
      console.log("Calling Nano Banana 2 edit...")
      const result = await fal.subscribe("fal-ai/nano-banana-2/edit", {
        input: {
          prompt: buildPrompt(selectedColor),
          image_urls: [imageUrl],
          output_format: "png",
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            console.log("Processing...")
          }
        },
      })

      const outputUrl = (result.data as any)?.images?.[0]?.url
      if (!outputUrl) {
        throw new Error("Aucune image retournée par Fal AI")
      }

      console.log("Image generated, fetching for display...")
      // Fetch the image and convert to blob URL to avoid CORS issues in <img>
      const imgResponse = await fetch(outputUrl)
      const imgBlob = await imgResponse.blob()
      const blobUrl = URL.createObjectURL(imgBlob)

      console.log("Image ready for display")
      setResultImage(blobUrl)
    } catch (err: any) {
      console.error("Error:", err)
      setError(err.message || "Une erreur s'est produite lors du traitement de l'image")
    } finally {
      setLoading(false)
    }
  }

  const downloadImage = () => {
    if (resultImage) {
      const link = document.createElement("a")
      link.href = resultImage
      link.download = "terrasse-revetement.png"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const resetImages = () => {
    setImage(null)
    setImagePreview(null)
    setProcessedImageData(null)
    setResultImage(null)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <img src="/logo-resiluxai.png" alt="Logo ResiluxAI" className="mx-auto mb-2 w-32 h-32 object-contain" />
          {(processing || loading) && <GlowAnimation />}
          <p className="text-gray-600 text-base font-medium">L'IA qui sublime votre terrasse en un clic</p>
        </div>

        {!imagePreview ? (
          <Card className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-2">
                  Photo de votre terrasse
                </label>
                <div className="relative">
                  <input
                    id="image"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleImageChange}
                    disabled={processing}
                    className="hidden"
                    capture="environment"
                    ref={fileInputRef}
                  />
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    disabled={processing}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <Upload className="h-5 w-5" />
                    Prendre une photo ou Choisir une photo
                  </Button>
                  {processing && (
                    <Loader2 className="absolute right-3 top-3 h-5 w-5 text-blue-600 animate-spin" />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Couleur des cailloux</label>
                <div className="grid grid-cols-3 gap-3">
                  {STONE_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setSelectedColor(color.value)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        selectedColor === color.value
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-full mx-auto mb-2 border"
                        style={{ backgroundColor: color.color }}
                      />
                      <span className="text-xs font-medium">{color.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </form>
          </Card>
        ) : (
          <div className="space-y-4">
            {!resultImage ? (
              <Card className="p-4">
                <div className="aspect-square w-full overflow-hidden rounded-lg bg-gray-100 mb-4">
                  <img src={imagePreview || "/placeholder.svg"} alt="Original" className="w-full h-full object-cover" />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Couleur sélectionnée:</span>
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-4 h-4 rounded-full border"
                        style={{
                          backgroundColor: STONE_COLORS.find((c) => c.value === selectedColor)?.color,
                        }}
                      />
                      <span className="text-sm">{STONE_COLORS.find((c) => c.value === selectedColor)?.label}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button onClick={resetImages} variant="outline" className="w-full">
                      Changer
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading || !processedImageData} className="w-full">
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Traitement...
                        </>
                      ) : (
                        "Appliquer"
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                <BeforeAfterSlider beforeImage={imagePreview} afterImage={resultImage} />

                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={resetImages} variant="outline" className="w-full">
                    Nouvelle Photo
                  </Button>
                  <Button onClick={downloadImage} className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Télécharger
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="text-red-600 text-sm text-center">{error}</div>
          </Card>
        )}
      </div>
    </div>
  )
}

function GlowAnimation() {
  return (
    <div className="relative flex justify-center">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-8">
        <span className="block w-full h-full rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-blue-500 blur-2xl opacity-70 animate-glow" />
      </div>
    </div>
  )
}
