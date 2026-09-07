import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEXORA Control — Discord Server Manager",
  description: "NEXORA STUDIOS Discord server setup and management console.",
  icons: { icon: "/nexora-logo.svg", apple: "/nexora-logo.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
