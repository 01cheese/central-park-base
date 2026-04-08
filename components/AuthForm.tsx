"use client";

/**
 * Central Park — components/AuthForm.tsx
 *
 * Vault ID + Master Password form.
 * Handles three states automatically:
 *   1. Existing vault  → unlock
 *   2. New user        → prompt for confirmation, then create vault
 *   3. Wrong password  → show error
 */

import { useState, useTransition, type FormEvent } from "react";
import { useVault } from "@/store/useVault";

type FormMode = "enter" | "confirm_new" | "confirm_password";

export function AuthForm() {
    const { unlock, createVault } = useVault();

    const [userId, setUserId] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [mode, setMode] = useState<FormMode>("enter");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const isCreating = mode === "confirm_password";

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        if (!userId.trim() || !password.trim()) {
            setErrorMsg("Vault ID and password are required.");
            return;
        }

        if (isCreating) {
            if (password !== confirmPassword) {
                setErrorMsg("Passwords don't match.");
                return;
            }
            startTransition(async () => {
                try {
                    await createVault(userId.trim(), password);
                } catch {
                    setErrorMsg("Failed to create vault. Try a different Vault ID.");
                }
            });
            return;
        }

        startTransition(async () => {
            try {
                const result = await unlock(userId.trim(), password);
                if (result === "new_user") {
                    setMode("confirm_new");
                } else if (result === "wrong_key") {
                    setErrorMsg("Incorrect password for this Vault ID.");
                }
            } catch {
                setErrorMsg("Something went wrong. Please try again.");
            }
        });
    };

    const handleConfirmNew = () => {
        setMode("confirm_password");
        setErrorMsg(null);
    };

    const handleBack = () => {
        setMode("enter");
        setConfirmPassword("");
        setErrorMsg(null);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#080b0f] relative overflow-hidden">
            {/* Background ambient glow */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(16,185,129,0.08) 0%, transparent 70%), " +
                        "radial-gradient(ellipse 40% 40% at 80% 80%, rgba(99,102,241,0.06) 0%, transparent 60%)",
                }}
            />

            {/* Noise texture overlay */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                }}
            />

            <div className="relative w-full max-w-sm mx-4">
                {/* Logo / wordmark */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2.5 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <span
                            className="text-white font-semibold tracking-[0.2em] text-sm uppercase"
                            style={{ fontFamily: "'DM Mono', 'Fira Code', monospace" }}
                        >
              Central Park
            </span>
                    </div>
                    <p className="text-white/30 text-xs tracking-wider uppercase" style={{ fontFamily: "'DM Mono', monospace" }}>
                        Zero-Knowledge Vault
                    </p>
                </div>

                {/* Glass card */}
                <div
                    className="rounded-2xl border border-white/[0.08] p-8"
                    style={{
                        background: "rgba(255,255,255,0.03)",
                        backdropFilter: "blur(20px)",
                        boxShadow: "0 0 0 1px rgba(255,255,255,0.03) inset, 0 24px 48px rgba(0,0,0,0.4)",
                    }}
                >
                    {/* ── Confirm new vault prompt ── */}
                    {mode === "confirm_new" && (
                        <div className="text-center">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
                                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                </svg>
                            </div>
                            <h2 className="text-white/90 font-medium mb-2 text-sm tracking-wide">
                                No vault found
                            </h2>
                            <p className="text-white/40 text-xs leading-relaxed mb-6">
                                Vault ID{" "}
                                <code className="text-emerald-400/70 bg-emerald-400/5 px-1.5 py-0.5 rounded font-mono">
                                    {userId}
                                </code>{" "}
                                doesnt exist yet. Create a new vault with this ID?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleBack}
                                    className="flex-1 py-2.5 rounded-xl text-xs text-white/40 border border-white/[0.06] hover:text-white/60 hover:border-white/10 transition-all"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleConfirmNew}
                                    className="flex-1 py-2.5 rounded-xl text-xs text-emerald-300 border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/15 transition-all"
                                >
                                    Create vault
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Login / Create form ── */}
                    {mode !== "confirm_new" && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-white/40 text-[10px] uppercase tracking-widest mb-2" style={{ fontFamily: "'DM Mono', monospace" }}>
                                    Vault ID
                                </label>
                                <input
                                    type="text"
                                    value={userId}
                                    onChange={(e) => setUserId(e.target.value)}
                                    placeholder="your-unique-id"
                                    autoComplete="username"
                                    spellCheck={false}
                                    disabled={isPending}
                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white/80 text-sm placeholder-white/20 outline-none focus:border-emerald-500/40 focus:bg-white/[0.06] transition-all disabled:opacity-50"
                                    style={{ fontFamily: "'DM Mono', monospace" }}
                                />
                            </div>

                            <div>
                                <label className="block text-white/40 text-[10px] uppercase tracking-widest mb-2" style={{ fontFamily: "'DM Mono', monospace" }}>
                                    Master Password
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    autoComplete={isCreating ? "new-password" : "current-password"}
                                    disabled={isPending}
                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white/80 text-sm placeholder-white/20 outline-none focus:border-emerald-500/40 focus:bg-white/[0.06] transition-all disabled:opacity-50"
                                />
                            </div>

                            {isCreating && (
                                <div>
                                    <label className="block text-white/40 text-[10px] uppercase tracking-widest mb-2" style={{ fontFamily: "'DM Mono', monospace" }}>
                                        Confirm Password
                                    </label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••••••"
                                        autoComplete="new-password"
                                        disabled={isPending}
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white/80 text-sm placeholder-white/20 outline-none focus:border-emerald-500/40 focus:bg-white/[0.06] transition-all disabled:opacity-50"
                                    />
                                </div>
                            )}

                            {errorMsg && (
                                <p className="text-red-400/80 text-xs py-2 px-3 rounded-lg bg-red-400/5 border border-red-400/10">
                                    {errorMsg}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={isPending}
                                className="w-full py-3 rounded-xl text-sm font-medium tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                                style={{
                                    background: isPending
                                        ? "rgba(16,185,129,0.1)"
                                        : "linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(5,150,105,0.2) 100%)",
                                    border: "1px solid rgba(16,185,129,0.25)",
                                    color: isPending ? "rgba(110,231,183,0.5)" : "rgba(110,231,183,0.9)",
                                    boxShadow: isPending ? "none" : "0 0 20px rgba(16,185,129,0.08)",
                                }}
                            >
                                {isPending ? (
                                    <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                                        {isCreating ? "Creating vault…" : "Deriving keys…"}
                  </span>
                                ) : isCreating ? (
                                    "Create Vault"
                                ) : (
                                    "Unlock"
                                )}
                            </button>

                            {isCreating && (
                                <button
                                    type="button"
                                    onClick={handleBack}
                                    className="w-full py-2 text-white/25 text-xs hover:text-white/40 transition-colors"
                                >
                                    ← Back
                                </button>
                            )}
                        </form>
                    )}
                </div>

                {/* Footer note */}
                <p className="text-center text-white/15 text-[10px] mt-6 tracking-wide leading-relaxed" style={{ fontFamily: "'DM Mono', monospace" }}>
                    Your password never leaves this device.
                    <br />
                    Keys are derived in-browser via PBKDF2 + AES-GCM.
                </p>
            </div>
        </div>
    );
}