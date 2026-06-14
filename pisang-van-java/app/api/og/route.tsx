import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

// @vercel/og (Satori) requires inline styles to compile JSX elements into an SVG image.
// External CSS files, CSS modules, and global styles are NOT supported/loaded in the isolated Edge Runtime.
// Consequently, inline styles are a strict structural constraint for this route.
// nosonar

export const runtime = 'edge'

const styles = {
  container: {
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
  } as React.CSSProperties,
  logoWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px'
  } as React.CSSProperties,
  logoBadge: {
    width: '50px',
    height: '50px',
    backgroundColor: '#D4802A',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px'
  } as React.CSSProperties,
  logoTextWrapper: {
    display: 'flex',
    flexDirection: 'column'
  } as React.CSSProperties,
  logoTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    letterSpacing: '1px'
  } as React.CSSProperties,
  logoSubtitle: {
    fontSize: '12px',
    color: '#a1a1aa',
    textTransform: 'uppercase'
  } as React.CSSProperties,
  detailsWrapper: {
    display: 'flex',
    flexDirection: 'column',
    marginTop: '20px',
    maxWidth: '800px'
  } as React.CSSProperties,
  title: {
    fontSize: '64px',
    fontWeight: 'bold',
    margin: '0 0 16px 0',
    lineHeight: 1.1,
    color: 'white'
  } as React.CSSProperties,
  desc: {
    fontSize: '24px',
    color: '#d4d4d8',
    margin: '0 0 40px 0',
    lineHeight: 1.4
  } as React.CSSProperties,
  priceBadge: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#D4802A',
    color: '#1a0f0a',
    padding: '12px 32px',
    borderRadius: '6px',
    fontSize: '28px',
    fontWeight: 'bold',
    alignSelf: 'flex-start'
  } as React.CSSProperties
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    // Parse parameters
    const title = searchParams.get('title') || 'Pisang Goreng'
    const price = searchParams.get('price') || ''
    const desc = searchParams.get('desc') || 'Heritage Premium F&B'

    return new ImageResponse(
      <div style={styles.container}>
        {/* Logo */}
        <div style={styles.logoWrapper}>
          <div style={styles.logoBadge}>🍌</div>
          <div style={styles.logoTextWrapper}>
            <span style={styles.logoTitle}>Van Java</span>
            <span style={styles.logoSubtitle}>Premium Heritage</span>
          </div>
        </div>

        {/* Product details */}
        <div style={styles.detailsWrapper}>
          {/* Title */}
          <h1 style={styles.title}>{title}</h1>

          {/* Description */}
          <p style={styles.desc}>{desc}</p>

          {/* Price Badge */}
          {price && <div style={styles.priceBadge}>{price}</div>}
        </div>
      </div>,
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
