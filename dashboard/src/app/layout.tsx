import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { APP_NAME } from "@/lib/app";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: `Dashboard · ${APP_NAME}`, template: `%s · ${APP_NAME}` },
  description: "Run and monitor the Demo Store (demo.honebi.online) Playwright test suite.",
};

// Applies the saved theme and sidebar state before first paint so nothing flashes or jumps.
// Dark is the default theme; "system" follows the OS.
const themeScript = `try{var d=document.documentElement,t=localStorage.getItem('theme');if(t==='system')delete d.dataset.theme;else d.dataset.theme=t==='light'?'light':'dark';if(localStorage.getItem('sidebar')==='collapsed')d.dataset.sidebar='collapsed'}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-page font-sans text-ink">{children}</body>
    </html>
  );
}
