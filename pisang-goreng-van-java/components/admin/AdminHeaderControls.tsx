"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useLanguage } from "@/context/LanguageContext";
import { Moon, Sun, Languages } from "lucide-react";

export default function AdminHeaderControls() {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useLanguage();
  const [mounted, setMounted] = useState(false);

  // Menghindari Hydration Mismatch pada Next.js saat merender tema
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex items-center space-x-2">
      {/* Tombol Toggle Bahasa */}
      <button
        onClick={() => setLocale(locale === "id" ? "en" : "id")}
        className="p-2 text-gray-500 hover:text-brown-700 hover:bg-cream-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 rounded-full transition-colors"
        title={
          locale === "id" ? "Switch to English" : "Ganti ke Bahasa Indonesia"
        }
      >
        <Languages className="w-5 h-5" />
        <span className="sr-only">Toggle Language</span>
      </button>

      {/* Tombol Toggle Tema */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="p-2 text-gray-500 hover:text-brown-700 hover:bg-cream-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 rounded-full transition-colors"
        title={theme === "dark" ? "Mode Terang" : "Mode Gelap"}
      >
        {theme === "dark" ? (
          <Sun className="w-5 h-5" />
        ) : (
          <Moon className="w-5 h-5" />
        )}
        <span className="sr-only">Toggle Theme</span>
      </button>
    </div>
  );
}
