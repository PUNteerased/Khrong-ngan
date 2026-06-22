"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ImageUploader } from "@/components/image-uploader"
import type { DrugDto } from "@/lib/api"
import { createDrug, patchDrug, ApiError } from "@/lib/api"
import { toast } from "sonner"

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  drug: DrugDto | null
  onSaved: () => void
}

export function AdminDrugDialog({ open, onOpenChange, drug, onSaved }: Props) {
  const t = useTranslations("Admin")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [slotId, setSlotId] = useState("")
  const [quantity, setQuantity] = useState("0")
  const [category, setCategory] = useState("")
  const [dosageNotes, setDosageNotes] = useState("")
  const [warnings, setWarnings] = useState("")
  const [ingredientsText, setIngredientsText] = useState("")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState("")
  const [priceCents, setPriceCents] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (drug) {
      setName(drug.name)
      setDescription(drug.description)
      setSlotId(drug.slotId)
      setQuantity(String(drug.quantity))
      setCategory(drug.category ?? "")
      setDosageNotes(drug.dosageNotes ?? "")
      setWarnings(drug.warnings ?? "")
      setIngredientsText(drug.ingredientsText ?? "")
      setImageUrl(drug.imageUrl ?? null)
      setExpiresAt(
        drug.expiresAt ? drug.expiresAt.slice(0, 10) : ""
      )
      setPriceCents(
        drug.priceCents != null ? String(drug.priceCents) : ""
      )
    } else {
      setName("")
      setDescription("")
      setSlotId("")
      setQuantity("0")
      setCategory("")
      setDosageNotes("")
      setWarnings("")
      setIngredientsText("")
      setImageUrl(null)
      setExpiresAt("")
      setPriceCents("")
    }
  }, [open, drug])

  const handleSave = async () => {
    if (!name.trim() || !description.trim() || !slotId.trim()) return
    setSaving(true)
    try {
      const q = Math.max(0, parseInt(quantity, 10) || 0)
      const pc =
        priceCents.trim() === ""
          ? null
          : Math.max(0, parseInt(priceCents, 10) || 0)
      const exp = expiresAt.trim() ? `${expiresAt.trim()}T12:00:00.000Z` : null
      if (drug) {
        await patchDrug(drug.id, {
          name: name.trim(),
          description: description.trim(),
          slotId: slotId.trim(),
          quantity: q,
          category: category.trim() || null,
          dosageNotes: dosageNotes.trim() || null,
          warnings: warnings.trim() || null,
          ingredientsText: ingredientsText.trim(),
          imageUrl: imageUrl ?? null,
          expiresAt: exp,
          priceCents: pc,
        })
      } else {
        await createDrug({
          name: name.trim(),
          description: description.trim(),
          slotId: slotId.trim(),
          quantity: q,
          category: category.trim() || null,
          dosageNotes: dosageNotes.trim() || null,
          warnings: warnings.trim() || null,
          ingredientsText: ingredientsText.trim(),
          imageUrl: imageUrl ?? null,
          expiresAt: exp,
          priceCents: pc,
        })
      }
      onOpenChange(false)
      onSaved()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("loadFail"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {drug ? t("drugEdit") : t("drugAdd")} — {t("drugFormTitle")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("drugFormTitle")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>{t("drugImage")}</Label>
            <ImageUploader
              folder="drugs"
              shape="square"
              value={imageUrl}
              onChange={setImageUrl}
              disabled={saving}
              label={t("drugImage")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adm-d-name">{t("colName")}</Label>
            <Input
              id="adm-d-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adm-d-slot">{t("colSlot")}</Label>
            <Input
              id="adm-d-slot"
              value={slotId}
              onChange={(e) => setSlotId(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adm-d-qty">{t("colQty")}</Label>
            <Input
              id="adm-d-qty"
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adm-d-desc">{t("description")}</Label>
            <Textarea
              id="adm-d-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adm-d-cat">{t("category")}</Label>
            <Input
              id="adm-d-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adm-d-dose">{t("dosageNotes")}</Label>
            <Textarea
              id="adm-d-dose"
              rows={2}
              value={dosageNotes}
              onChange={(e) => setDosageNotes(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adm-d-warn">{t("warnings")}</Label>
            <Textarea
              id="adm-d-warn"
              rows={2}
              value={warnings}
              onChange={(e) => setWarnings(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adm-d-ing">{t("ingredients")}</Label>
            <Textarea
              id="adm-d-ing"
              rows={2}
              placeholder="paracetamol,acetaminophen"
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("ingredientsHint")}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="adm-d-exp">{t("expiresAt")}</Label>
            <Input
              id="adm-d-exp"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adm-d-price">{t("priceCents")}</Label>
            <Input
              id="adm-d-price"
              type="number"
              min={0}
              value={priceCents}
              onChange={(e) => setPriceCents(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" disabled={saving} onClick={() => void handleSave()}>
            {saving ? "…" : t("saveDrug")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
