// app/api/upload/route.ts

import crypto from 'node:crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/src/auth'
import { cloudinary } from '@/src/lib/cloudinary'

const MAX_MB = 2

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    // 1. ABSOLUTE QUARANTINE: Size Limit Enforcement (Max 2MB)
    const MAX_BYTES = MAX_MB * 1024 * 1024
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Maksimal ukuran file 2MB' },
        { status: 400 }
      )
    }

    // 2. ABSOLUTE QUARANTINE: Magic Bytes Validation (No MIME Spoofing)
    const buffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(buffer)

    // Check signatures (Hex Headers)
    const isJPEG =
      uint8Array.length >= 3 &&
      uint8Array[0] === 0xff &&
      uint8Array[1] === 0xd8 &&
      uint8Array[2] === 0xff
    const isPNG =
      uint8Array.length >= 8 &&
      uint8Array[0] === 0x89 &&
      uint8Array[1] === 0x50 &&
      uint8Array[2] === 0x4e &&
      uint8Array[3] === 0x47
    const isWEBP =
      uint8Array.length >= 12 &&
      uint8Array[8] === 0x57 &&
      uint8Array[9] === 0x45 &&
      uint8Array[10] === 0x42 &&
      uint8Array[11] === 0x50

    if (!isJPEG && !isPNG && !isWEBP) {
      return NextResponse.json(
        {
          success: false,
          error: 'File ditolak: Signature gambar tidak valid (Hanya JPG/PNG/WEBP murni).'
        },
        { status: 400 }
      )
    }

    // 3. CRYPTOGRAPHIC NAMING: avoid predictable timestamps
    // Extract strictly validated extension
    let ext = 'jpg'
    if (isPNG) ext = 'png'
    else if (isWEBP) ext = 'webp'

    const safeName = `img_${crypto.randomUUID()}.${ext}`

    const isAdmin = session.user?.role === 'ADMIN' || session.user?.role === 'SUPER_ADMIN'
    const folder = isAdmin ? 'menu-images' : 'user-uploads'

    // 4. CLOUDINARY SECURE UPLOAD
    const uploadResult = (await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: safeName.split('.')[0], // strictly validated cryptographic name without extension
          resource_type: 'image'
        },
        (error, result) => {
          if (error) {
            console.error('[CLOUDINARY_UPLOAD_ERR]', error.message)
            reject(error)
          } else {
            resolve(result)
          }
        }
      )
      uploadStream.end(Buffer.from(buffer))
    })) as any

    return NextResponse.json(
      { success: true, data: { url: uploadResult.secure_url } },
      { status: 201 }
    )
  } catch (e: unknown) {
    console.error('[UPLOAD_CRITICAL_ERR]', e instanceof Error ? e.message : 'Unknown Error')
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
