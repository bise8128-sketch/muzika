import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { MonitoringInit } from "@/components/UI/MonitoringInit";
import { ThemeProvider } from "@/context/ThemeContext";
import { ThemeAwareBackground } from "@/components/Visuals/ThemeAwareBackground";
import Script from "next/script";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: 'swap',
});

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
          <ThemeProvider>
            <MonitoringInit />
            <ThemeAwareBackground />
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
        {/* 
          Security fix (P0 #1): Replaced dangerouslySetInnerHTML inline script with
          next/script src= reference to avoid XSS risk from raw HTML injection.
          The external file public/sw-register.js contains the same SW registration logic.
        */}
        <Script src="/sw-register.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}

