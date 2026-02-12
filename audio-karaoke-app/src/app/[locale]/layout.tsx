import type { Metadata, Viewport } from "next";
// import { Inter } from "next/font/google";
import "../globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

// const inter = Inter({
//   subsets: ["latin"],
//   variable: "--font-inter",
// });

const inter = { variable: "font-inter" }; // Mock variable for compatibility


export const metadata: Metadata = {
  title: "DaorsKaraoke | Premium AI Karaoke Experience",
  description: "Experience the future of karaoke with our AI-powered separation and real-time effects. Perfect your performance with precision and style.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as typeof routing.locales[number])) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <body
        className={`${inter.variable} font-sans antialiased bg-background text-foreground`}
      >
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js')})}`
          }}
        />
      </body>
    </html>
  );
}
