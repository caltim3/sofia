import './globals.css'

export const metadata = {
  title: 'Sofia — Knowledge System',
  description: 'AI-powered second brain and knowledge management system',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
