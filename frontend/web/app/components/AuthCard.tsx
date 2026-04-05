"use client";
import Link from "next/link";

export default function AuthCard({
  title,
  subtitle,
  children,
  footerText,
  footerLink,
  footerLinkText,
}: any) {
  return (
    <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-md">
      <div className="text-center mb-6">
        <div className="w-12 h-12 mx-auto bg-blue-500 rounded-xl flex items-center justify-center text-white text-xl">
          +
        </div>
        <h1 className="text-2xl font-bold mt-4">{title}</h1>
        <p className="text-gray-500 text-sm">{subtitle}</p>
      </div>

      {children}

      <div className="mt-6 text-center text-sm">
        {footerText}
        {footerLink ? (
          <Link href={footerLink} className="text-blue-600 font-medium">
            {footerLinkText}
          </Link>
        ) : (
          footerLinkText && (
            <span className="text-gray-600 font-medium"> {footerLinkText}</span>
          )
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button className="flex-1 bg-gray-100 py-2 rounded-lg">Google</button>
        <button className="flex-1 bg-gray-100 py-2 rounded-lg">Facebook</button>
      </div>
    </div>
  );
}
