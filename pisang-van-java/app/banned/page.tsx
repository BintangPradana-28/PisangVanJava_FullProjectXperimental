import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function BannedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-neutral-100 p-4">
      <div className="max-w-md w-full bg-neutral-800 rounded-2xl p-8 shadow-xl text-center border border-red-900/50">
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold mb-4 text-white">Akses Ditolak</h1>
        <p className="text-neutral-400 mb-8 leading-relaxed">
          Akun Anda telah ditangguhkan karena melanggar ketentuan layanan kami atau terdeteksi adanya aktivitas yang mencurigakan. 
          Jika Anda merasa ini adalah sebuah kesalahan, silakan hubungi tim dukungan kami.
        </p>
        
        <div className="flex flex-col gap-3">
          <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
            <Link href="/kontak">
              Hubungi Support
            </Link>
          </Button>
          <Button asChild variant="ghost" className="w-full text-neutral-400 hover:text-white hover:bg-neutral-700">
            <Link href="/">
              Kembali ke Beranda
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
