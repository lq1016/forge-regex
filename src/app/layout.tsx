import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forge Regex — AI-Powered Regex Builder",
  description:
    "Describe your pattern in plain English. Forge Regex writes the regular expression for you, with real-time testing and clear explanations.",
  openGraph: {
    title: "Forge Regex — AI-Powered Regex Builder",
    description:
      "Stop debugging regex. Describe your pattern and get working regular expressions instantly.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
