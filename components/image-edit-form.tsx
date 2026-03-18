"use client"

import type React from "react"
import { useState, useRef } from "react"
import { fal } from "@fal-ai/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Loader2, Upload, Download, Eye } from "lucide-react"
import { BeforeAfterSlider } from "./before-after-slider"

fal.config({ proxyUrl: "/api/fal/proxy" })

const STONE_COLORS = [
  {
    value: "Blanc polaire",
    label: "Blanc polaire",
    color: "#E8E4DF",
    description: "white polar small rounded pebbles, very light almost white with slight cream tones",
  },
  {
    value: "Gris clair nuage",
    label: "Gris clair nuage",
    color: "#B0B5B8",
    description: "light grey cloud-colored mix of white and grey small rounded pebbles",
  },
  {
    value: "Gris anthracite",
    label: "Gris anthracite",
    color: "#5A5E62",
    description: "dark anthracite grey mix of dark grey and white small rounded pebbles",
  },
  {
    value: "Noir charbon",
    label: "Noir charbon",
    color: "#2C2C2C",
    description: "charcoal black small rounded pebbles, very dark almost black",
  },
  {
    value: "Beige crème",
    label: "Beige crème",
    color: "#D4C4A8",
    description: "cream beige small rounded pebbles, warm sand-like natural tone",
  },
  {
    value: "Rose corail",
    label: "Rose corail",
    color: "#C9A07A",
    description: "coral pink small rounded pebbles, warm pinkish-salmon natural stone",
  },
  {
    value: "Rouge de Vérone",
    label: "Rouge de Vérone",
    color: "#A0522D",
    description: "Verona red small rounded pebbles, warm terracotta reddish-brown natural stone",
  },
]

function buildPrompt(color: typeof STONE_COLORS[number]) {
  return `Edit this photo of a terrace or driveway to apply a realistic resin-bound gravel surface on the ground/floor area only.

CRITICAL RULES:
- ONLY modify the ground/floor surface (terrace, driveway, patio, pathway)
- DO NOT alter walls, garage doors, fences, roofs, sky, trees, furniture, or any other elements
- Preserve the exact same perspective, lighting, and shadows from the original photo
- The new surface must blend naturally with the existing lighting conditions

SURFACE DETAILS:
- Material: Resin-bound gravel finish — small tightly-packed rounded natural pebbles embedded in clear resin
- Stone color and texture: ${color.description}
- The pebbles should be small (3-6mm), tightly packed with minimal gaps
- The surface should look smooth and professionally installed
- The resin binder should be barely visible, letting the natural stone color dominate

LIGHTING:
- Match the sun direction and shadow angles from the original photo
- The gravel surface should show subtle shadow variations in any recessed areas
- Slight specular highlights on individual pebbles where direct sunlight hits

The goal is a photorealistic visualization helping a client see their terrace resurfaced with a ${color.value} stone-resin finish.`
}

export function ImageEditForm() {
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [processedImageData, setProcessedImageData] = useState<string | null>(null)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState(STONE_COLORS[0].value)
  const [showDemo, setShowDemo] = useState(false)

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
      setShowDemo(false)

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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!processedImageData) return

    setLoading(true)
    setError(null)
    setResultImage(null)

    const color = STONE_COLORS.find((c) => c.value === selectedColor) || STONE_COLORS[0]

    try {
      const base64 = processedImageData.split(",")[1]
      const byteArray = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const blob = new Blob([byteArray], { type: "image/jpeg" })
      const file = new File([blob], "terrace.jpg", { type: "image/jpeg" })

      console.log("Uploading image to Fal storage...")
      const imageUrl = await fal.storage.upload(file)

      console.log("Calling Nano Banana 2 edit...")
      const result = await fal.subscribe("fal-ai/nano-banana-2/edit", {
        input: {
          prompt: buildPrompt(color),
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

      const imgResponse = await fetch(outputUrl)
      const imgBlob = await imgResponse.blob()
      const blobUrl = URL.createObjectURL(imgBlob)
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

  const resetAll = () => {
    setImagePreview(null)
    setProcessedImageData(null)
    setResultImage(null)
    setError(null)
    setShowDemo(false)
  }

  const selectedColorObj = STONE_COLORS.find((c) => c.value === selectedColor)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">
        {/* Header */}
        <div className="text-center">
          <img src="/logo-resiluxai.png" alt="Logo ResiluxAI" className="mx-auto mb-1 w-28 h-28 object-contain" />
          {(processing || loading) && <GlowAnimation />}
          <p className="text-gray-500 text-sm">L'IA qui sublime votre terrasse en un clic</p>
        </div>

        {/* Demo mode */}
        {showDemo && (
          <div className="space-y-3">
            <Card className="p-4">
              <BeforeAfterSlider beforeImage="/demo-avant.jpg" afterImage="/demo-apres.png" />
            </Card>
            <Button onClick={() => setShowDemo(false)} variant="outline" className="w-full">
              Fermer la démo
            </Button>
          </div>
        )}

        {/* Result view */}
        {resultImage && imagePreview && !showDemo && (
          <div className="space-y-3">
            <Card className="p-4">
              <BeforeAfterSlider beforeImage={imagePreview} afterImage={resultImage} />
            </Card>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={resetAll} variant="outline" className="w-full">
                Nouvelle Photo
              </Button>
              <Button onClick={downloadImage} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Télécharger
              </Button>
            </div>
          </div>
        )}

        {/* Main form (visible when no result and no demo) */}
        {!resultImage && !showDemo && (
          <>
            {/* Image upload / preview */}
            <Card className="p-5">
              {!imagePreview ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Photo de votre terrasse
                  </label>
                  <input
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
                    onClick={() => fileInputRef.current?.click()}
                    disabled={processing}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    {processing ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                    {processing ? "Traitement..." : "Prendre ou choisir une photo"}
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="aspect-video w-full overflow-hidden rounded-lg bg-gray-100 mb-3">
                    <img src={imagePreview} alt="Original" className="w-full h-full object-cover" />
                  </div>
                  <Button onClick={resetAll} variant="outline" size="sm" className="w-full">
                    Changer de photo
                  </Button>
                </div>
              )}
            </Card>

            {/* Color selection - always visible */}
            <Card className="p-5">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Coloris du revêtement
              </label>
              <div className="grid grid-cols-4 gap-2">
                {STONE_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setSelectedColor(color.value)}
                    className={`p-2 rounded-lg border-2 transition-all ${
                      selectedColor === color.value
                        ? "border-orange-500 bg-orange-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-full mx-auto mb-1.5 border border-gray-200"
                      style={{ backgroundColor: color.color }}
                    />
                    <span className="text-[10px] leading-tight font-medium block text-center text-gray-700">
                      {color.label}
                    </span>
                  </button>
                ))}
              </div>

              {selectedColorObj && (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                  <div
                    className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
                    style={{ backgroundColor: selectedColorObj.color }}
                  />
                  <span>{selectedColorObj.label}</span>
                </div>
              )}
            </Card>

            {/* Submit button */}
            <Button
              onClick={handleSubmit}
              disabled={loading || !processedImageData}
              className="w-full h-12 text-base bg-orange-600 hover:bg-orange-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Traitement en cours...
                </>
              ) : (
                "Appliquer le revêtement"
              )}
            </Button>

            {/* Demo link */}
            {!imagePreview && (
              <button
                onClick={() => setShowDemo(true)}
                className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-orange-600 transition-colors py-2"
              >
                <Eye className="h-4 w-4" />
                Voir un exemple avant / après
              </button>
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <Card className="p-3 bg-red-50 border-red-200">
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
