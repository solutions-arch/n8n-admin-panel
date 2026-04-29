// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import Sidebar from './components/Sidebar'

export const metadata: Metadata = {
  title: 'n8n Admin Panel',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}