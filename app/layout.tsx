import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Patchline — Expense Heist",
  description:
    "A live adaptive spend-policy red team: seven attacks per round, denial-driven adaptation, and validated rule hardening.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
