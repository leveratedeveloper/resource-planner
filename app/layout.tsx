import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/components/ui/toast";
import { getSession } from "@/lib/auth/session";

const geistSans = localFont({
  src: "../public/fonts/geist/geist-latin.woff2",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "../public/fonts/geist/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Resource Planner",
  description: "Resource planning and scheduling application",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const initialSession = session
    ? {
        user: session.user,
        employee: session.employee,
        access: session.access,
      }
    : null;

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider cacheOwnerKey={initialSession?.employee.uuid ?? null}>
          <AuthProvider initialSession={initialSession} hasResolvedInitialSession>
            {children}
            <ToastProvider />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
