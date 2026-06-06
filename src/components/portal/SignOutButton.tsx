"use client";
import { signOut } from "next-auth/react";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className={className ?? "font-fun font-600 text-slate-500 hover:text-coral"}
    >
      Sign out
    </button>
  );
}
