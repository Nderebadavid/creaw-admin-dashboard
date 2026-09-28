"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  HandCoins,
  ShieldCheck,
  Sprout,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: Users, label: "Members" },
  { icon: HandCoins, label: "Contributions & loans" },
  { icon: BarChart3, label: "Reports" },
  { icon: ShieldCheck, label: "Secure" },
];

interface Particle {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  opacity: number;
}

// Same falling-particle effect as rental-v1-app's login screen, tinted with
// this app's primary color token instead of a hardcoded emerald. Randomized
// only after mount -- Math.random() during render would differ between the
// server and client pass and desync hydration.
function FallingParticles() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const randomize = () => {
      setParticles(
        Array.from({ length: 40 }, (_, i) => ({
          id: i,
          left: Math.random() * 100,
          delay: Math.random() * 20,
          duration: 15 + Math.random() * 20,
          size: 4 + Math.random() * 3,
          opacity: 0.1 + Math.random() * 0.3,
        }))
      );
    };
    randomize();
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-primary"
          style={{
            left: `${particle.left}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            opacity: particle.opacity,
            animation: `auth-fall ${particle.duration}s linear ${particle.delay}s infinite`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes auth-fall {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: var(--particle-opacity, 0.2);
          }
          90% {
            opacity: var(--particle-opacity, 0.2);
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

// Shared frame for auth pages (currently just /login -- vsla-identity-service
// has no public signup endpoint, so there's no /signup to share this with
// yet): dark branded split-screen, independent of the app's light/dark toggle
// (the "dark" class pins the green tokens to their dark-mode values for
// contrast against this fixed dark backdrop).
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="dark relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <FallingParticles />

      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="absolute top-20 left-20 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute right-20 bottom-20 h-80 w-80 rounded-full bg-slate-500/10 blur-3xl" />
      <div className="absolute top-1/2 left-1/3 h-72 w-72 rounded-full bg-slate-600/10 blur-3xl" />

      <div className="relative z-10 flex min-h-screen">
        {/* Branding -- desktop only */}
        <div className="hidden flex-col justify-between p-12 lg:flex lg:w-1/2 xl:p-16">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/90">
              <Sprout className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">VSLA App</h1>
              <p className="text-xs text-slate-500">
                Village Savings &amp; Loan Management
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-3xl leading-tight font-semibold text-white/90 xl:text-4xl">
                Run your savings group
                <span className="block text-primary/80">with confidence</span>
              </h2>
              <p className="max-w-sm text-base text-slate-400">
                Track members, contributions and loans in one place, built for
                how village groups actually operate.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {FEATURES.map((feature) => (
                <div
                  key={feature.label}
                  className="flex items-center gap-1.5 rounded-full border border-white/5 bg-white/5 px-3 py-1.5 text-xs text-slate-400"
                >
                  <feature.icon className="h-3.5 w-3.5 text-primary/70" />
                  <span>{feature.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Spacer to balance the flex layout where stats used to sit */}
          <div aria-hidden className="h-6" />
        </div>

        {/* Form card */}
        <div className="flex w-full items-center justify-center p-6 sm:p-10 lg:w-1/2">
          <div className="w-full max-w-sm">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-md sm:p-8">
              <Link
                href="/"
                className="mb-6 flex items-center justify-center gap-2 lg:hidden"
              >
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/90">
                  <Sprout className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-lg font-semibold text-white/90">
                  VSLA App
                </span>
              </Link>

              <div className="mb-6 text-center lg:text-left">
                <h2 className="text-xl font-semibold text-white/90">{title}</h2>
                <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
              </div>

              {children}
            </div>

            {footer && (
              <p
                className={cn(
                  "mt-4 text-center text-xs text-slate-500",
                  "[&_a]:text-primary/80 [&_a]:transition-colors [&_a]:hover:text-primary"
                )}
              >
                {footer}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
