"use client";

/**
 * Central Park — store/useVault.ts
 *
 * Global Zustand store. Holds the authenticated session in-memory only.
 * Nothing here is persisted to localStorage — intentional ZK design.
 *
 * Flow:
 *   unlock(userId, password) → derives keys → loads 'core' vault → sets isUnlocked
 *   getAppData(appId)        → fetch + decrypt from Supabase on demand
 *   saveAppData(appId, data) → encrypt + upsert to Supabase
 *   lock()                   → clear everything from memory
 */

import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { deriveKeys, encryptPayload, decryptPayload, type DerivedKeys } from "@/lib/crypto";

// ─── Types ───────────────────────────────────────────────────────────────────

export type VaultStatus = "idle" | "deriving" | "unlocked" | "error";

interface VaultState {
    // Session
    status: VaultStatus;
    error: string | null;
    userId: string | null;

    // Keys — in memory only, never serialized
    _keys: DerivedKeys | null;

    // Per-app data cache (decrypted, in memory)
    _cache: Record<string, unknown>;

    // ─── Actions ───────────────────────────────────────────────────────────────

    /**
     * Attempt to unlock the vault. Returns:
     *   "unlocked"     — existing vault found and unlocked
     *   "new_user"     — no vault found for this userId, caller should offer signup
     *   "wrong_key"    — vault exists but password is incorrect
     */
    unlock: (
        userId: string,
        password: string
    ) => Promise<"unlocked" | "new_user" | "wrong_key">;

    /**
     * Create the initial 'core' vault for a brand-new user.
     * Only call this after unlock() returns "new_user".
     */
    createVault: (userId: string, password: string) => Promise<void>;

    /**
     * Fetch and decrypt app data. Returns cached value if already loaded.
     * Returns null if the app vault doesn't exist yet.
     */
    getAppData: <T = unknown>(appId: string) => Promise<T | null>;

    /**
     * Encrypt and upsert app data to Supabase.
     * Creates the app vault row if it doesn't exist.
     */
    saveAppData: <T = unknown>(appId: string, data: T) => Promise<void>;

    /** Clear all keys and data from memory. */
    lock: () => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useVault = create<VaultState>((set, get) => ({
    status: "idle",
    error: null,
    userId: null,
    _keys: null,
    _cache: {},

    // ─── unlock ──────────────────────────────────────────────────────────────

    unlock: async (userId, password) => {
        set({ status: "deriving", error: null });

        try {
            const keys = await deriveKeys(password, userId);

            // Look up the core vault by (user_id, auth_key)
            const { data, error } = await supabase
                .from("vaults")
                .select("encrypted_payload")
                .eq("user_id", userId)
                .eq("app_id", "core")
                .eq("auth_key", keys.authKeyHash)
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                // Check if the userId exists at all (wrong password vs new user)
                const { data: exists } = await supabase
                    .from("vaults")
                    .select("user_id")
                    .eq("user_id", userId)
                    .eq("app_id", "core")
                    .maybeSingle();

                set({ status: "idle" });
                return exists ? "wrong_key" : "new_user";
            }

            // Decrypt the core payload
            const coreData = await decryptPayload(data.encrypted_payload, keys.encKey);

            set({
                status: "unlocked",
                userId,
                _keys: keys,
                _cache: { core: coreData },
            });

            return "unlocked";
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            set({ status: "error", error: message });
            throw err;
        }
    },

    // ─── createVault ─────────────────────────────────────────────────────────

    createVault: async (userId, password) => {
        set({ status: "deriving", error: null });

        try {
            const keys = await deriveKeys(password, userId);

            const defaultCore = {
                createdAt: new Date().toISOString(),
                theme: "dark",
                accentColor: "#6ee7b7",
            };

            const encrypted = await encryptPayload(defaultCore, keys.encKey);

            const { error } = await supabase.from("vaults").insert({
                user_id: userId,
                app_id: "core",
                auth_key: keys.authKeyHash,
                encrypted_payload: encrypted,
            });

            if (error) throw error;

            set({
                status: "unlocked",
                userId,
                _keys: keys,
                _cache: { core: defaultCore },
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            set({ status: "error", error: message });
            throw err;
        }
    },

    // ─── getAppData ──────────────────────────────────────────────────────────

    getAppData: async <T = unknown>(appId: string): Promise<T | null> => {
        const { userId, _keys, _cache } = get();
        if (!userId || !_keys) throw new Error("Vault is locked");

        // Return from cache if available
        if (appId in _cache) return _cache[appId] as T;

        const { data, error } = await supabase
            .from("vaults")
            .select("encrypted_payload")
            .eq("user_id", userId)
            .eq("app_id", appId)
            .eq("auth_key", _keys.authKeyHash)
            .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        const decrypted = await decryptPayload<T>(data.encrypted_payload, _keys.encKey);

        // Update cache
        set((state) => ({ _cache: { ...state._cache, [appId]: decrypted } }));

        return decrypted;
    },

    // ─── saveAppData ─────────────────────────────────────────────────────────

    saveAppData: async <T = unknown>(appId: string, data: T): Promise<void> => {
        const { userId, _keys } = get();
        if (!userId || !_keys) throw new Error("Vault is locked");

        const encrypted = await encryptPayload(data, _keys.encKey);

        const { error } = await supabase.from("vaults").upsert(
            {
                user_id: userId,
                app_id: appId,
                auth_key: _keys.authKeyHash,
                encrypted_payload: encrypted,
            },
            { onConflict: "user_id,app_id" }
        );

        if (error) throw error;

        // Update cache
        set((state) => ({ _cache: { ...state._cache, [appId]: data } }));
    },

    // ─── lock ────────────────────────────────────────────────────────────────

    lock: () => {
        set({
            status: "idle",
            error: null,
            userId: null,
            _keys: null,
            _cache: {},
        });
    },
}));