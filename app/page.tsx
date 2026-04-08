"use client";

/**
 * Central Park — app/page.tsx
 *
 * Demo dashboard: shows two apps after vault unlock.
 *   - 'core' vault: theme preference (persisted via AES-GCM)
 *   - 'notes' vault: freeform text note (persisted via AES-GCM)
 *
 * Each app's data is lazily fetched and encrypted independently.
 */

import { useEffect, useState, useCallback } from "react";
import { useVault } from "@/store/useVault";
import { AuthForm } from "@/components/AuthForm";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CoreData {
  createdAt: string;
  theme: "dark" | "midnight" | "slate";
  accentColor: string;
}

interface NotesData {
  content: string;
  savedAt: string;
}

// ─── Theme tokens ─────────────────────────────────────────────────────────────

const THEMES = {
  dark: {
    label: "Dark",
    bg: "#080b0f",
    surface: "rgba(255,255,255,0.03)",
    accent: "#6ee7b7",
    accentBg: "rgba(16,185,129,0.12)",
    accentBorder: "rgba(16,185,129,0.25)",
  },
  midnight: {
    label: "Midnight",
    bg: "#06060f",
    surface: "rgba(99,102,241,0.04)",
    accent: "#a5b4fc",
    accentBg: "rgba(99,102,241,0.12)",
    accentBorder: "rgba(99,102,241,0.25)",
  },
  slate: {
    label: "Slate",
    bg: "#0a0c10",
    surface: "rgba(148,163,184,0.04)",
    accent: "#94a3b8",
    accentBg: "rgba(148,163,184,0.08)",
    accentBorder: "rgba(148,163,184,0.20)",
  },
} as const;

type ThemeName = keyof typeof THEMES;

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
      <div
          className={`rounded-2xl border border-white/[0.07] ${className}`}
          style={{
            background: "rgba(255,255,255,0.025)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.03) inset, 0 8px 32px rgba(0,0,0,0.3)",
          }}
      >
        {children}
      </div>
  );
}

function AppLabel({ children }: { children: React.ReactNode }) {
  return (
      <span
          className="text-[10px] uppercase tracking-widest text-white/30"
          style={{ fontFamily: "'DM Mono', 'Fira Code', monospace" }}
      >
      {children}
    </span>
  );
}

function SaveIndicator({ saving, saved }: { saving: boolean; saved: boolean }) {
  if (saving) {
    return (
        <span className="text-[10px] text-white/30 flex items-center gap-1.5">
        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Encrypting…
      </span>
    );
  }
  if (saved) {
    return <span className="text-[10px] text-emerald-400/50">✓ Saved</span>;
  }
  return null;
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function Dashboard() {
  const { userId, getAppData, saveAppData, lock } = useVault();

  const [activeApp, setActiveApp] = useState<"core" | "notes">("core");
  const [coreData, setCoreData] = useState<CoreData | null>(null);
  const [notesData, setNotesData] = useState<NotesData | null>(null);
  const [noteText, setNoteText] = useState("");
  const [currentTheme, setCurrentTheme] = useState<ThemeName>("dark");
  const [loading, setLoading] = useState(true);
  const [savingCore, setSavingCore] = useState(false);
  const [savedCore, setSavedCore] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savedNote, setSavedNote] = useState(false);

  const theme = THEMES[currentTheme];

  // Load core on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      const core = await getAppData<CoreData>("core");
      if (core) {
        setCoreData(core);
        setCurrentTheme((core.theme as ThemeName) ?? "dark");
      }
      setLoading(false);
    })();
  }, [getAppData]);

  // Load notes lazily when tab is activated
  useEffect(() => {
    if (activeApp !== "notes" || notesData !== null) return;
    (async () => {
      const notes = await getAppData<NotesData>("notes");
      if (notes) {
        setNotesData(notes);
        setNoteText(notes.content ?? "");
      } else {
        setNotesData({ content: "", savedAt: "" });
      }
    })();
  }, [activeApp, notesData, getAppData]);

  const handleThemeChange = useCallback(
      async (name: ThemeName) => {
        setCurrentTheme(name);
        setSavingCore(true);
        setSavedCore(false);
        const next: CoreData = {
          ...(coreData ?? { createdAt: new Date().toISOString() }),
          theme: name,
          accentColor: THEMES[name].accent,
        };
        setCoreData(next);
        await saveAppData("core", next);
        setSavingCore(false);
        setSavedCore(true);
        setTimeout(() => setSavedCore(false), 2000);
      },
      [coreData, saveAppData]
  );

  // Debounce note saves
  useEffect(() => {
    if (notesData === null) return;
    const timer = setTimeout(async () => {
      if (noteText === (notesData?.content ?? "")) return;
      setSavingNote(true);
      setSavedNote(false);
      const next: NotesData = { content: noteText, savedAt: new Date().toISOString() };
      await saveAppData("notes", next);
      setNotesData(next);
      setSavingNote(false);
      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 2000);
    }, 1200);
    return () => clearTimeout(timer);
  }, [noteText, notesData, saveAppData]);

  if (loading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#080b0f]">
          <div className="text-white/20 text-sm flex items-center gap-3" style={{ fontFamily: "'DM Mono', monospace" }}>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Decrypting vault…
          </div>
        </div>
    );
  }

  return (
      <div
          className="min-h-screen transition-colors duration-700"
          style={{ background: THEMES[currentTheme].bg }}
      >
        {/* Ambient glow */}
        <div
            aria-hidden
            className="pointer-events-none fixed inset-0 transition-all duration-700"
            style={{
              background: `radial-gradient(ellipse 50% 40% at 50% 0%, ${theme.accentBg} 0%, transparent 70%)`,
            }}
        />

        {/* Layout */}
        <div className="relative max-w-3xl mx-auto px-4 py-8 min-h-screen flex flex-col gap-6">

          {/* Header */}
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center border"
                  style={{ background: theme.accentBg, borderColor: theme.accentBorder }}
              >
                <svg className="w-4 h-4" style={{ color: theme.accent }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <div className="text-white/80 text-sm font-medium tracking-wide">Central Park</div>
                <div className="text-white/25 text-[10px]" style={{ fontFamily: "'DM Mono', monospace" }}>
                  {userId}
                </div>
              </div>
            </div>

            <button
                onClick={lock}
                className="text-white/25 text-[11px] hover:text-white/50 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5"
                style={{ fontFamily: "'DM Mono', monospace" }}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Lock
            </button>
          </header>

          {/* App tabs */}
          <div className="flex gap-1.5">
            {(["core", "notes"] as const).map((appId) => (
                <button
                    key={appId}
                    onClick={() => setActiveApp(appId)}
                    className="px-4 py-2 rounded-xl text-xs transition-all"
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      background: activeApp === appId ? theme.accentBg : "transparent",
                      border: `1px solid ${activeApp === appId ? theme.accentBorder : "rgba(255,255,255,0.06)"}`,
                      color: activeApp === appId ? theme.accent : "rgba(255,255,255,0.35)",
                    }}
                >
                  {appId === "core" ? "⚙ System" : "✎ Notes"}
                </button>
            ))}
          </div>

          {/* ── Core app ──────────────────────────────────────────────── */}
          {activeApp === "core" && (
              <GlassCard className="p-6 flex-1">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <AppLabel>app_id: core</AppLabel>
                    <h2 className="text-white/80 font-medium text-sm mt-1">System Preferences</h2>
                  </div>
                  <SaveIndicator saving={savingCore} saved={savedCore} />
                </div>

                <div className="space-y-6">
                  {/* Theme picker */}
                  <div>
                    <p className="text-white/35 text-xs mb-3 tracking-wide">Theme</p>
                    <div className="flex gap-3">
                      {(Object.entries(THEMES) as [ThemeName, typeof THEMES[ThemeName]][]).map(([name, t]) => (
                          <button
                              key={name}
                              onClick={() => handleThemeChange(name)}
                              className="flex-1 py-3 rounded-xl border text-xs transition-all relative overflow-hidden"
                              style={{
                                background: currentTheme === name ? t.accentBg : "rgba(255,255,255,0.02)",
                                borderColor: currentTheme === name ? t.accentBorder : "rgba(255,255,255,0.06)",
                                color: currentTheme === name ? t.accent : "rgba(255,255,255,0.3)",
                                fontFamily: "'DM Mono', monospace",
                              }}
                          >
                      <span
                          className="block w-3 h-3 rounded-full mx-auto mb-2"
                          style={{ background: t.accent, opacity: currentTheme === name ? 1 : 0.4 }}
                      />
                            {t.label}
                          </button>
                      ))}
                    </div>
                  </div>

                  {/* Vault info */}
                  {coreData && (
                      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                        <p className="text-white/20 text-[10px] uppercase tracking-widest mb-3" style={{ fontFamily: "'DM Mono', monospace" }}>
                          Vault metadata
                        </p>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-white/25 text-xs">Created</span>
                            <span className="text-white/50 text-xs" style={{ fontFamily: "'DM Mono', monospace" }}>
                        {new Date(coreData.createdAt).toLocaleDateString()}
                      </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/25 text-xs">Encryption</span>
                            <span className="text-white/50 text-xs" style={{ fontFamily: "'DM Mono', monospace" }}>
                        AES-GCM-256
                      </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/25 text-xs">KDF</span>
                            <span className="text-white/50 text-xs" style={{ fontFamily: "'DM Mono', monospace" }}>
                        PBKDF2 / 300k
                      </span>
                          </div>
                        </div>
                      </div>
                  )}
                </div>
              </GlassCard>
          )}

          {/* ── Notes app ─────────────────────────────────────────────── */}
          {activeApp === "notes" && (
              <GlassCard className="p-6 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <AppLabel>app_id: notes</AppLabel>
                    <h2 className="text-white/80 font-medium text-sm mt-1">Encrypted Note</h2>
                  </div>
                  <SaveIndicator saving={savingNote} saved={savedNote} />
                </div>

                {notesData === null ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-white/20 text-sm flex items-center gap-2" style={{ fontFamily: "'DM Mono', monospace" }}>
                        <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Loading…
                      </div>
                    </div>
                ) : (
                    <>
                <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Start typing… your note is encrypted before it leaves this device."
                    className="flex-1 min-h-[280px] w-full resize-none bg-transparent text-white/70 text-sm leading-relaxed placeholder-white/15 outline-none"
                    style={{ fontFamily: "'DM Mono', 'Fira Code', monospace" }}
                />
                      <div className="mt-4 pt-4 border-t border-white/[0.05] flex items-center justify-between">
                  <span className="text-white/15 text-[10px]" style={{ fontFamily: "'DM Mono', monospace" }}>
                    {noteText.length} chars
                  </span>
                        {notesData.savedAt && (
                            <span className="text-white/15 text-[10px]" style={{ fontFamily: "'DM Mono', monospace" }}>
                      last saved {new Date(notesData.savedAt).toLocaleTimeString()}
                    </span>
                        )}
                      </div>
                    </>
                )}
              </GlassCard>
          )}

          {/* Footer */}
          <footer className="text-center text-white/10 text-[10px] tracking-wider" style={{ fontFamily: "'DM Mono', monospace" }}>
            data encrypted client-side · server sees only ciphertext
          </footer>
        </div>
      </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const { status } = useVault();
  return status === "unlocked" ? <Dashboard /> : <AuthForm />;
}