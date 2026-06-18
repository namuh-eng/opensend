import { PosthogProvider } from "@/components/observability/posthog-provider";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Opensend",
  description: "Email API for developers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <PosthogProvider>{children}</PosthogProvider>
      </body>
    </html>
  );
}
