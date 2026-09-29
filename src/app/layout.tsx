import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const barlow = Barlow({
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  subsets: ["latin"],
});

const barlowCondensed = Barlow_Condensed({
  weight: ["500", "600", "700"],
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CREAW MERL Portal",
  description: "Monitoring, Evaluation, Research and Learning portal for CREAW.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
