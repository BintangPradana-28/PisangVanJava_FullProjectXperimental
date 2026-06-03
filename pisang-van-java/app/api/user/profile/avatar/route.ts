import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/features/auth/authOptions";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

// Check environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!session || !userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ success: false, message: "File tidak ditemukan" }, { status: 400 });
    }

    // Validasi ukuran
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ success: false, message: "Ukuran maksimal 2MB" }, { status: 400 });
    }

    // Validasi tipe (optional tapi disarankan)
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ success: false, message: "Format file tidak didukung" }, { status: 400 });
    }

    const ext = file.name.split(".").pop();
    const fileName = `${userId}-${uuidv4()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("avatars") // Asumsi bucket bernama 'avatars' sudah ada di Supabase
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Supabase Storage Error:", uploadError);
      return NextResponse.json({ success: false, message: "Gagal mengunggah ke penyimpanan." }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

    const publicUrl = publicUrlData.publicUrl;

    // Simpan ke DB
    await prisma.user.update({
      where: { id: userId },
      data: { image: publicUrl },
    });

    return NextResponse.json({ success: true, data: { url: publicUrl } });
  } catch (error) {
    console.error("POST /api/user/profile/avatar Error:", error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}
