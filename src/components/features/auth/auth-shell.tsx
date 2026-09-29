import type { ReactNode } from "react";
import Image from "next/image";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col bg-[#F7F4F0] font-sans text-[#221C18] lg:flex-row">
      <section className="relative flex min-h-[400px] flex-1 flex-col justify-between gap-10 overflow-hidden bg-[#FDF3E3] px-7 py-8 sm:px-12 lg:min-h-screen lg:py-12">
        <div className="pointer-events-none absolute -right-48 -bottom-48 h-[520px] w-[520px] rounded-full border-[56px] border-[#F7E0BF]" />
        <Image
          src="/creaw-logo.png"
          alt="CREAW — Centre for Rights Education and Awareness"
          width={170}
          height={112}
          className="relative h-auto w-[170px] mix-blend-multiply"
          priority
        />
        <div className="relative max-w-[480px] space-y-5">
          <p className="font-heading text-sm font-bold tracking-[0.16em] text-[#B4552E] uppercase">
            MERL Portal
          </p>
          <h1 className="font-heading text-4xl leading-[1.02] font-bold text-[#3A2418] sm:text-5xl">
            Evidence for every woman and girl we serve.
          </h1>
          <p className="text-[17px] leading-relaxed text-[#6B5A4C]">
            Monitoring, evaluation, research and learning across all five CREAW pillars, from field
            capture on mobile to donor reporting.
          </p>
          <div className="flex flex-wrap gap-2">
            {["VAWG", "WEE", "SRHR", "Leadership", "WROs"].map((pillar) => (
              <span
                key={pillar}
                className="rounded-full border border-[#F0DFC8] bg-white px-3 py-1.5 text-sm font-semibold text-[#4A413A]"
              >
                {pillar}
              </span>
            ))}
          </div>
          <Image
            src="/login-wvl.png"
            alt="Women Voice and Leadership illustration"
            width={739}
            height={415}
            className="w-full rounded-xl border border-[#F0DFC8] object-cover"
          />
        </div>
        <p className="relative text-xs text-[#8A7564]">
          © 2026 Centre for Rights Education and Awareness
        </p>
      </section>
      <section className="flex flex-1 items-center justify-center bg-white px-7 py-12 sm:px-12">
        <div className="w-full max-w-[420px] space-y-6">
          <div className="space-y-1.5">
            <h2 className="font-heading text-[34px] font-bold">{title}</h2>
            <p className="text-[15px] text-[#8A8078]">{subtitle}</p>
          </div>
          {children}
          {footer}
        </div>
      </section>
    </main>
  );
}
