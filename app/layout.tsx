import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

// Nonce-based CSP (see proxy.ts) requires dynamic rendering so Next can inject
// the per-request nonce into its script tags. This app is a client-rendered SPA
// that fetches its data at runtime, so forcing dynamic rendering has negligible
// cost while enabling a strict, no-'unsafe-inline' script policy.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Academy Manager · Bright Future Academy',
  description: 'Simple, calm academy management for tuition-centre owners and staff.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="antialiased font-sans">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
