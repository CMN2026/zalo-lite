"use client";

import type { ReactNode } from "react";
import Link from "next/link";

type AuthCardProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footerText: string;
  footerLink: string;
  footerLinkText: string;
};

export default function AuthCard({
  title,
  subtitle,
  children,
  footerText,
  footerLink,
  footerLinkText,
}: AuthCardProps) {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/70 bg-white/90 p-8 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.45)] backdrop-blur">
      <div className="mb-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-lg shadow-slate-900/20">
          ZL
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
      </div>

      {children}

      <div className="mt-6 text-center text-sm text-slate-500">
        {footerText}{" "}
        <Link href={footerLink} className="font-semibold text-slate-900 hover:underline">
          {footerLinkText}
        </Link>
      </div>
    </div>
  );
}