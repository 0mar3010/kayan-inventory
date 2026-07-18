import type { Metadata } from "next";
import { Poppins, Inter, Cairo } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-poppins",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "كيان — المخزون",
  description: "نظام إدارة مخزون كيان الداخلي — مطابقة المخزن مع شوبيفاي ومراجعة المطابقات",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${poppins.variable} ${inter.variable} ${cairo.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-kayan-bg font-ar text-kayan-ink">{children}</body>
    </html>
  );
}
