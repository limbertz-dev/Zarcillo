import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "./components/sidebar";
import { HeaderBar } from "./components/header-bar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zarcillo · Wine Fermentation Monitor",
  description:
    "Monitoreo IoT en tiempo real de fermentación de vino — Tarija, Bolivia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
            <HeaderBar />
            <main className="flex-1 overflow-x-hidden px-4 pt-28 pb-6 sm:px-8 sm:pt-28 sm:pb-8">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
