import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CAIP Python Trainer | USAII Certification Prep",
  description: "Interactive Python learning platform for USAII CAIP certification. Master Python basics, data structures, algorithms, and more.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans bg-brand-dark text-white antialiased">
        {children}
      </body>
    </html>
  );
}
