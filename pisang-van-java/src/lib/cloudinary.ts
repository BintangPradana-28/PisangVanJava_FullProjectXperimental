import { v2 as cloudinary } from 'cloudinary'
import { env } from '@/src/env'

if (env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    // Replace these hardcoded ones with env vars if needed later
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'demo',
    api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || '1234567890',
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  })
}

export { cloudinary }
