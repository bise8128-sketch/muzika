import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { MonitoringInit } from "@/components/UI/MonitoringInit";
import { ThemeProvider } from "@/context/ThemeContext";
import { AudioProvider } from "@/context/AudioProvider";
import { ThemeAwareBackground } from "@/components/Visuals/ThemeAwareBackground";
import Script from "next/script";
import { SerwistProvider } from "@/app/serwist";
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
        <SerwistProvider swUrl="/sw.js">
          <NextIntlClientProvider messages={messages}>
            <ThemeProvider>
              <AudioProvider>
                <MonitoringInit />
                <ThemeAwareBackground />
                {children}
              </AudioProvider>
            </ThemeProvider>
          </NextIntlClientProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}

