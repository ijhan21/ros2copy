"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = storedTheme === "dark" || (!storedTheme && prefersDark);
    
    setIsDark(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  if (!mounted) {
    return (
      <button
        aria-label="화면 모드 전환"
        className="min-h-[36px] px-3 text-xs font-medium border border-[#E4E4E7] dark:border-[#2E2E36] rounded-[8px] bg-[#FFFFFF] dark:bg-[#1A1A1E] text-[#52525B] dark:text-[#A1A1AA]"
      >
        화면 모드
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label="화면 모드 전환"
      className="min-h-[36px] px-3 text-xs font-medium border border-[#E4E4E7] dark:border-[#2E2E36] rounded-[8px] bg-[#FFFFFF] dark:bg-[#1A1A1E] text-[#52525B] dark:text-[#D1D5DB] hover:bg-[#F4F4F5] dark:hover:bg-[#26262E] transition-colors"
    >
      {isDark ? "밝은 화면" : "어두운 화면"}
    </button>
  );
}
