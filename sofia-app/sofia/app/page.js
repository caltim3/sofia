'use client'

import dynamic from 'next/dynamic'

const App = dynamic(() => import('@/components/App'), { ssr: false,
  loading: () => (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f5f0', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2.5em', color: '#1a1a2e' }}>Sofia</div>
        <div style={{ color: '#8a8478', fontSize: '0.9em', marginTop: 4 }}>Loading...</div>
      </div>
    </div>
  )
})

export default function Home() {
  return <App />
}
