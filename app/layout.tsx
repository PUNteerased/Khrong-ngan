import type { Metadata, Viewport } from 'next'
import { Prompt } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AppShell } from '@/components/app-shell'
import './globals.css'

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-prompt",
})

export const metadata: Metadata = {
  title: 'LaneYa - วิเคราะห์ยาจากอาการ',
  description: 'แอปวิเคราะห์อาการและแนะนำยาด้วย AI พร้อมระบบจ่ายยาอัตโนมัติ',
  generator: 'LaneYa',
  icons: {
    icon: [{ url: '/logoya_bg.png', type: 'image/png' }],
    apple: '/logoya_bg.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#1a365d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th" className="bg-background">
      <body className={`${prompt.variable} font-sans antialiased`}>
        <AppShell>{children}</AppShell>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
