import { ImageResponse } from 'next/og'
import { type NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    // Parse parameters
    const title = searchParams.get('title') || 'Pisang Goreng'
    const price = searchParams.get('price') || ''
    const desc = searchParams.get('desc') || 'Heritage Premium F&B'

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            backgroundColor: '#1a0f0a',
            backgroundImage: 'linear-gradient(135deg, #1a0f0a 0%, #3D1C02 100%)',
            padding: '80px',
            fontFamily: 'sans-serif',
            color: 'white'
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px'
            }}
          >
            <div
              style={{
                width: '50px',
                height: '50px',
                backgroundColor: '#D4802A',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px'
              }}
            >
              🍌
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <span style={{ fontSize: '24px', fontWeight: 'bold', letterSpacing: '1px' }}>
                Van Java
              </span>
              <span style={{ fontSize: '12px', color: '#a1a1aa', textTransform: 'uppercase' }}>
                Premium Heritage
              </span>
            </div>
          </div>

          {/* Product details */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginTop: '20px',
              maxWidth: '800px'
            }}
          >
            {/* Title */}
            <h1
              style={{
                fontSize: '64px',
                fontWeight: 'bold',
                margin: '0 0 16px 0',
                lineHeight: '1.1',
                color: 'white'
              }}
            >
              {title}
            </h1>

            {/* Description */}
            <p
              style={{
                fontSize: '24px',
                color: '#d4d4d8',
                margin: '0 0 40px 0',
                lineHeight: '1.4'
              }}
            >
              {desc}
            </p>

            {/* Price Badge */}
            {price && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#D4802A',
                  color: '#1a0f0a',
                  padding: '12px 32px',
                  borderRadius: '6px',
                  fontSize: '28px',
                  fontWeight: 'bold',
                  alignSelf: 'flex-start'
                }}
              >
                {price}
              </div>
            )}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630
      }
    )
  } catch (e: any) {
    console.error('Failed to generate OG image', e)
    return new Response('Failed to generate image', { status: 500 })
  }
}
