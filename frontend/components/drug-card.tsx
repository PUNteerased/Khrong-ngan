"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Pill, QrCode, Info, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export interface DrugCardData {
  id: string
  name: string
  category?: string | null
  description?: string | null
  imageUrl?: string | null
  dosageNotes?: string | null
  warnings?: string | null
  slotId?: number | null
  quantity?: number | null
}

interface DrugCardProps {
  drug: DrugCardData
  onGetQR?: (drug: DrugCardData) => void
  loading?: boolean
  className?: string
}

export function DrugCard({ drug, onGetQR, loading, className }: DrugCardProps) {
  const t = useTranslations("DrugCard")
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  const hasStock = drug.slotId != null && (drug.quantity ?? 0) > 0

  if (loading) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="p-0">
          <div className="flex gap-3 p-3">
            <Skeleton className="h-20 w-20 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        "overflow-hidden border-primary/20 bg-gradient-to-br from-card to-primary/5",
        className
      )}
    >
      <CardContent className="p-0">
        <div className="flex gap-3 p-3">
          {/* Drug Image */}
          <div className="relative h-20 w-20 shrink-0 rounded-lg bg-muted overflow-hidden">
            {drug.imageUrl && !imageError ? (
              <>
                {!imageLoaded && (
                  <Skeleton className="absolute inset-0 rounded-lg" />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={drug.imageUrl}
                  alt={drug.name}
                  className={cn(
                    "h-full w-full object-cover transition-opacity",
                    imageLoaded ? "opacity-100" : "opacity-0"
                  )}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary/10">
                <Pill className="h-8 w-8 text-primary/50" />
              </div>
            )}
          </div>

          {/* Drug Info */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-foreground truncate">
                {drug.name}
              </h3>
              {drug.slotId != null && (
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {t("slot", { slot: drug.slotId })}
                </Badge>
              )}
            </div>

            {drug.category && (
              <p className="text-xs text-muted-foreground">{drug.category}</p>
            )}

            {drug.dosageNotes && (
              <p className="text-xs text-primary line-clamp-2">
                {drug.dosageNotes}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              {hasStock ? (
                <Button
                  size="sm"
                  onClick={() => onGetQR?.(drug)}
                  className="h-8 gap-1.5"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  {t("getQR")}
                </Button>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  {t("outOfStock")}
                </Badge>
              )}

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    {t("details")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Pill className="h-5 w-5 text-primary" />
                      {drug.name}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {drug.imageUrl && !imageError && (
                      <div className="rounded-lg overflow-hidden bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={drug.imageUrl}
                          alt={drug.name}
                          className="w-full h-40 object-cover"
                        />
                      </div>
                    )}

                    {drug.description && (
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-1">
                          {t("descriptionLabel")}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {drug.description}
                        </p>
                      </div>
                    )}

                    {drug.dosageNotes && (
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-1">
                          {t("dosageLabel")}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {drug.dosageNotes}
                        </p>
                      </div>
                    )}

                    {drug.warnings && (
                      <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <div>
                            <h4 className="text-sm font-medium text-destructive mb-1">
                              {t("warningsLabel")}
                            </h4>
                            <p className="text-sm text-destructive/80">
                              {drug.warnings}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {hasStock && (
                      <Button onClick={() => onGetQR?.(drug)} className="w-full">
                        <QrCode className="h-4 w-4 mr-2" />
                        {t("getQR")}
                      </Button>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Warning Footer */}
        {drug.warnings && (
          <div className="flex items-center gap-2 border-t border-destructive/20 bg-destructive/5 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
            <p className="text-xs text-destructive line-clamp-1">
              {drug.warnings}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function DrugCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-0">
        <div className="flex gap-3 p-3">
          <Skeleton className="h-20 w-20 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-full" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
