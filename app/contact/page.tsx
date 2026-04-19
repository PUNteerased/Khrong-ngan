"use client"

import { useState } from "react"
import {
  Phone,
  AlertTriangle,
  Send,
  MapPin,
  Mail,
  Users,
  Upload,
  Box,
  QrCode,
  Bot,
  Lightbulb,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const issueCategories = [
  { value: "dispenser", label: "ตู้ไม่จ่ายยา / ยาติดขัด", icon: Box },
  { value: "qr", label: "สแกน QR Code ไม่ผ่าน", icon: QrCode },
  { value: "ai", label: "แชทบอท AI มีปัญหา / ประเมินผลผิดพลาด", icon: Bot },
  { value: "other", label: "อื่นๆ (เสนอแนะ)", icon: Lightbulb },
]

export default function ContactPage() {
  const [formData, setFormData] = useState({
    category: "",
    description: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Contact form:", formData)
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-background pb-8">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Emergency Contact */}
        <a href="tel:1669">
          <Card className="bg-destructive/10 border-destructive/30 hover:bg-destructive/20 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-destructive/20">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">
                    อาการรุนแรง หรือเจ็บป่วยฉุกเฉิน
                  </p>
                  <p className="text-sm text-muted-foreground">
                    โทรสายด่วน 1669
                  </p>
                </div>
                <Phone className="h-6 w-6 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </a>

        {/* Issue Report Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              แจ้งปัญหาการใช้งาน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>หมวดหมู่ปัญหา</FieldLabel>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกหมวดหมู่ปัญหา" />
                    </SelectTrigger>
                    <SelectContent>
                      {issueCategories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center gap-2">
                            <cat.icon className="h-4 w-4" />
                            {cat.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>รายละเอียด</FieldLabel>
                  <Textarea
                    placeholder="อธิบายปัญหาที่พบ..."
                    rows={4}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </Field>
              </FieldGroup>

              <Button variant="outline" type="button" className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                แนบรูปภาพ (ไม่บังคับ)
              </Button>

              <Button type="submit" className="w-full" size="lg">
                <Send className="h-4 w-4 mr-2" />
                ส่งข้อความแจ้งปัญหา
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Developer Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              ข้อมูลติดต่อทีมผู้จัดทำ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">สถานที่ตั้งตู้จ่ายยา</p>
                <p className="text-sm text-muted-foreground">
                  ตู้ต้นแบบตั้งอยู่ที่: หน้าห้องพยาบาล อาคาร 1
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">อีเมลผู้ดูแลระบบ</p>
                <p className="text-sm text-muted-foreground">
                  laneya@school.ac.th
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">ทีมผู้จัดทำโครงงาน</p>
                <p className="text-sm text-muted-foreground">
                  โครงงานคอมพิวเตอร์ โรงเรียน LaneYa School
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
