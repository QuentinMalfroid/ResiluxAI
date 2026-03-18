"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Loader2, Upload, Download } from "lucide-react"
import { BeforeAfterSlider } from "./before-after-slider"

const STONE_COLORS = [
  { value: "Light Grey", label: "Gris Clair", color: "#D1D5DB" },
  { value: "Dark Grey", label: "Gris Foncé", color: "#6B7280" },
  { value: "Beige", label: "Beige", color: "#D2B48C" },
]

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

        // Scale down if needed while preserving aspect ratio
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

          if (sizeInMB > 8) {
            reject(new Error(`Image encore trop lourde après compression: ${sizeInMB.toFixed(2)}MB`))
          } else {
            resolve(dataUrl)
          }
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
      // Validate file size (increased limit since we compress)
      if (file.size > 20 * 1024 * 1024) {
        setError("L'image doit faire moins de 20MB.")
        return
      }

      // Accept both PNG and JPEG (we'll convert to JPEG for better compression)
      if (!file.type.includes("png") && !file.type.includes("jpeg") && !file.type.includes("jpg")) {
        setError("Veuillez uploader une image PNG ou JPEG.")
        return
      }

      setError(null)
      setResultImage(null)
      setProcessing(true)
      setImage(file)

      console.log(`Image originale: ${(file.size / 1024 / 1024).toFixed(2)}MB`)

      try {
        // Process image for preview
        const reader = new FileReader()
        reader.onload = () => {
          setImagePreview(reader.result as string)
        }
        reader.readAsDataURL(file)

        // Process image for API
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
      const response = await fetch("/api/edit-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageData: processedImageData,
          stoneColor: selectedColor,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Une erreur s'est produite")
      }

      const result = await response.json()
      setResultImage(result.imageUrl)
    } catch (err: any) {
      setError(err.message || "Une erreur s'est produite lors du traitement de l'image")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const downloadImage = () => {
    if (resultImage) {
      if (resultImage.startsWith("data:")) {
        // Base64 image
        const link = document.createElement("a")
        link.href = resultImage
        link.download = "terrasse-revetement.png"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        // URL image
        window.open(resultImage, "_blank")
      }
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
          {processing && <GlowAnimation />}
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

<style jsx global>{`
  @keyframes glow {
    0% { filter: blur(16px) brightness(1.1); opacity: 0.7; }
    50% { filter: blur(24px) brightness(1.5); opacity: 1; }
    100% { filter: blur(16px) brightness(1.1); opacity: 0.7; }
  }
  .animate-glow {
    animation: glow 2s infinite linear;
  }
`}</style>
