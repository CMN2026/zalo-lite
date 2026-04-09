import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#ffffff_0%,_#f5f7ff_30%,_#e8eefc_58%,_#d9e2f5_100%)] text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}