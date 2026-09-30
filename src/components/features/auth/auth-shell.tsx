import type { ReactNode } from "react";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";

const PILLARS = [
  { name: "VAWG", focus: "Violence against women & girls", bar: "bg-[#E0822F]" },
  { name: "WEE", focus: "Economic empowerment", bar: "bg-[#F2B25C]" },
  { name: "SRHR", focus: "Sexual & reproductive health", bar: "bg-[#E8C07A]" },
  { name: "Skilling", focus: "Vocational training", bar: "bg-[#C98A5C]" },
  { name: "WROs", focus: "Women's rights orgs", bar: "bg-creaw-orange" },
];

/** The two-panel frame of every auth screen: the brand hero and the card holding `children`. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen grid-cols-1 bg-[#FDF6EC] font-sans text-creaw-ink min-[1040px]:grid-cols-2">
      <section className="relative order-2 flex flex-col justify-between gap-10 overflow-hidden bg-[#2E1C13] px-[clamp(28px,5vw,64px)] py-8 min-[1040px]:order-1 min-[1040px]:min-h-screen min-[1040px]:py-11">
        <div className="pointer-events-none absolute -top-[250px] -right-[230px] h-[440px] w-[440px] rounded-full border-[48px] border-[#F2B25C] opacity-90" />
        <div className="pointer-events-none absolute -top-[170px] -right-[150px] h-[300px] w-[300px] rounded-full border-2 border-[#F2B25C]/35" />
        <div className="pointer-events-none absolute -right-[90px] -bottom-[120px] h-60 w-60 rounded-full bg-creaw-orange opacity-[.28]" />
        <div className="relative self-start rounded-[14px] bg-white px-4 py-3">
          <Image
            src="/creaw-logo.png"
            alt="CREAW — Centre for Rights Education and Awareness"
            width={128}
            height={91}
            className="block h-auto w-32"
            priority
          />
        </div>
        <div className="relative z-10 flex flex-col gap-[22px]">
          <p className="font-heading text-sm font-bold tracking-[0.18em] text-[#F2B25C] uppercase">
            MERL Portal
          </p>
          {/* Each sentence stays on one line, so the size follows the panel's width. */}
          <h1 className="font-heading text-[clamp(26px,8.4vw,60px)] leading-[0.98] font-bold whitespace-nowrap text-[#FDF6EC] min-[1040px]:text-[clamp(40px,4vw,60px)]">
            <span className="block">Every woman counted.</span>{" "}
            <span className="block text-[#F2B25C]">Every outcome measured.</span>
          </h1>
          <p className="max-w-[470px] text-[17px] leading-[1.55] text-pretty text-[#D9C6B3]">
            Monitoring, evaluation, research and learning for CREAW&apos;s work on rights, safety
            and economic justice for women and girls across Kenya.
          </p>
        </div>
        <div className="relative z-10 flex max-w-[520px] flex-col gap-4">
          <p className="text-xs font-bold tracking-[0.14em] text-[#A38C78] uppercase">
            Five pillars, one evidence base
          </p>
          <ul className="grid grid-cols-5 gap-2">
            {PILLARS.map((pillar) => (
              <li key={pillar.name} className="flex flex-col gap-2">
                <span className={`h-1 rounded-sm ${pillar.bar}`} />
                <span className="font-heading text-[17px] leading-none font-bold text-[#FDF6EC]">
                  {pillar.name}
                </span>
                <span className="text-[11.5px] leading-[1.3] text-[#A38C78]">{pillar.focus}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative order-1 flex flex-col bg-[#FDF6EC] bg-[radial-gradient(circle_at_100%_0%,#FBE7CC_0,rgba(251,231,204,0)_42%),radial-gradient(circle_at_0%_100%,#F7E1D5_0,rgba(247,225,213,0)_38%)] min-[1040px]:order-2 min-[1040px]:min-h-screen">
        <div className="flex flex-1 items-center justify-center px-7 py-10">
          <div className="flex w-full max-w-[468px] flex-col gap-6 rounded-[20px] border border-t-4 border-[#F0E3D2] border-t-creaw-orange bg-white px-[clamp(22px,4vw,40px)] pt-9 pb-8 shadow-[0_30px_60px_-34px_rgba(90,50,25,.35),0_2px_6px_rgba(90,50,25,.04)]">
            {children}
          </div>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F0E3D2] px-8 py-5 text-[13px] text-creaw-faint">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={17} className="shrink-0 text-creaw-success" aria-hidden />
            Protected under the Kenya Data Protection Act, 2019
          </span>
          <a
            href="mailto:it@creaw.org"
            className="font-medium text-creaw-body hover:text-creaw-ink"
          >
            IT support
          </a>
        </footer>
      </section>
    </main>
  );
}
