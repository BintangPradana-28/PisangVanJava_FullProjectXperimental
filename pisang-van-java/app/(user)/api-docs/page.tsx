'use client'

import dynamic from 'next/dynamic'
import 'swagger-ui-react/swagger-ui.css'

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false })

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-white py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-6 text-center">
          Pisang Van Java — API Documentation
        </h1>
        <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <SwaggerUI url="/api/openapi" />
        </div>
      </div>
    </div>
  )
}
