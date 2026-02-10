import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Plant Care Tracker",
  description: "Track your houseplant care schedules",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-gray-50">
          {/* Navigation */}
          <nav className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16 items-center">
                <div className="flex items-center space-x-8">
                  <Link href="/" className="text-xl font-bold text-green-600">
                    🪴 Plant Care
                  </Link>
                  <div className="hidden md:flex space-x-4">
                    <Link
                      href="/"
                      className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/plants"
                      className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium"
                    >
                      My Plants
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
