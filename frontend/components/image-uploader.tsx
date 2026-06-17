"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ImagePlus, Trash2, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { uploadImage } from "@/lib/upload-image"
import { isSupabaseConfigured } from "@/lib/supabase"

type Shape = "square" | "circle"

type Props = {
  value: string | null
  onChange: (url: string | null) => void
  folder: string
  shape?: Shape
  label?: string
  maxSizeMB?: number
  className?: string
  /** disable the component (e.g. while the outer form is saving) */
  disabled?: boolean
  /** size in pixels (width & height) — only matters for circle / square preview */
  size?: number
}

export function ImageUploader({
  value,
  onChange,
  folder,
  shape = "square",
  label,
  maxSizeMB = 5,
  className,
  disabled = false,
  size,
}: Props) {
  const t = useTranslations("ImageUploader")
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview)
    }
  }, [localPreview])

  const previewUrl = localPreview ?? value

  const handlePick = () => {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("invalidType"))
      return
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(t("tooLarge", { max: maxSizeMB }))
      return
    }
    if (!isSupabaseConfigured()) {
      toast.error(t("notConfigured"))
      return
    }

    const objectUrl = URL.createObjectURL(file)
    if (localPreview) URL.revokeObjectURL(localPreview)
    setLocalPreview(objectUrl)
    setUploading(true)

    try {
      const { url } = await uploadImage(file, folder)
      onChange(url)
      toast.success(t("uploadOk"))
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("uploadFail")
      toast.error(msg)
      setLocalPreview(null)
      URL.revokeObjectURL(objectUrl)
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = () => {
    if (localPreview) {
      URL.revokeObjectURL(localPreview)
      setLocalPreview(null)
    }
    onChange(null)
  }

  const box = shape === "circle" ? "rounded-full" : "rounded-xl"
  const dim = size ? { width: size, height: size } : undefined

  return (
    <div className={cn("flex items-start gap-4", className)}>
      <button
        type="button"
        onClick={handlePick}
        disabled={disabled || uploading}
        style={dim}
        className={cn(
          "relative flex items-center justify-center overflow-hidden border-2 border-dashed border-border bg-muted/40 transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60",
          box,
          !size && (shape === "circle" ? "h-24 w-24" : "h-32 w-32")
        )}
        aria-label={label ?? t("pick")}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={label ?? t("preview")}
            className={cn("h-full w-full object-cover", box)}
          />
        ) : (
          <div className="flex flex-col items-center gap-1 px-2 text-center text-xs text-muted-foreground">
            <ImagePlus className="h-6 w-6" aria-hidden />
            <span>{t("pickHint")}</span>
          </div>
        )}
        {uploading && (
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-background/70",
              box
            )}
          >
            <Spinner className="h-6 w-6" />
          </div>
        )}
      </button>

      <div className="flex flex-col gap-2">
        {label ? (
          <p className="text-sm font-medium text-foreground">{label}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {t("hint", { max: maxSizeMB })}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handlePick}
            disabled={disabled || uploading}
          >
            <Upload className="mr-1 h-4 w-4" />
            {value ? t("replace") : t("upload")}
          </Button>
          {(value || localPreview) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleRemove}
              disabled={disabled || uploading}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {t("remove")}
            </Button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (file) void handleFile(file)
        }}
      />
    </div>
  )
}
