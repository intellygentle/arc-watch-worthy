// frontend/src/app/layout.tsx

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from 'react-hot-toast';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arc-Watch-Worthy | Pay Only for What's Worthy",
  description: "Web3 video streaming with granular nanopayments. Unlock content in 5-second chunks. Your money only follows content that earns it.",
  keywords: ["web3", "video streaming", "nanopayments", "circle", "arc testnet", "pay-per-view"],
  authors: [{ name: "Arc-Watch-Worthy" }],
  openGraph: {
    title: "Arc-Watch-Worthy",
    description: "Pay only for content that proves worthy. Granular nanopayments for video streaming.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#1F1A31]">
        {children}
        <Toaster
          position="bottom-left"
          toastOptions={{
            style: {
              background: '#2D2440',
              color: '#FFFFFF',
              border: '1px solid #3D3458',
            },
            success: {
              iconTheme: {
                primary: '#22C55E',
                secondary: '#FFFFFF',
              },
            },
            error: {
              iconTheme: {
                primary: '#EF4444',
                secondary: '#FFFFFF',
              },
            },
          }}
        />
      </body>
    </html>
  );
}