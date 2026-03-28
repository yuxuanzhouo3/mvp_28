/**
 * Account Manager
 * 多账号 localStorage 持久化存储
 * 支持在 Median/GoNative WebView 中跨 App 重启保留登录状态
 */

export interface StoredAccount {
    id: string;            // Supabase user ID
    email: string;
    name: string;
    avatar: string;
    accessToken: string;
    refreshToken: string;
    savedAt: number;       // ms timestamp when saved
    lastActiveAt: number;  // ms timestamp when last used
}

const STORAGE_KEY = "morngpt-stored-accounts";

// ─── Read helpers ─────────────────────────────────────────────

/** Return all stored accounts (newest-active first) */
export function getStoredAccounts(): StoredAccount[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const accounts: StoredAccount[] = JSON.parse(raw);
        // Sort by lastActiveAt descending so the most-recent is first
        return accounts.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    } catch {
        return [];
    }
}

/** Return the most recently active account, or null */
export function getLastActiveAccount(): StoredAccount | null {
    const accounts = getStoredAccounts();
    return accounts.length > 0 ? accounts[0] : null;
}

/** Find account by id */
export function getAccountById(id: string): StoredAccount | null {
    return getStoredAccounts().find((a) => a.id === id) ?? null;
}

// ─── Write helpers ────────────────────────────────────────────

function persist(accounts: StoredAccount[]): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    } catch (e) {
        console.error("[AccountManager] persist failed:", e);
    }
}

/**
 * Save / update an account.
 * If an account with the same id already exists it is updated in-place;
 * otherwise it is appended. The account is automatically set as active.
 */
export function saveAccount(account: Omit<StoredAccount, "savedAt" | "lastActiveAt"> & { savedAt?: number; lastActiveAt?: number }): void {
    const now = Date.now();
    const full: StoredAccount = {
        ...account,
        savedAt: account.savedAt ?? now,
        lastActiveAt: now,
    };

    const accounts = getStoredAccounts();
    const idx = accounts.findIndex((a) => a.id === full.id);
    if (idx >= 0) {
        // Update existing — keep original savedAt, refresh tokens & lastActiveAt
        accounts[idx] = { ...accounts[idx], ...full, savedAt: accounts[idx].savedAt };
    } else {
        accounts.push(full);
    }
    persist(accounts);
    console.log(`✅ [AccountManager] Saved account: ${full.email} (${full.id})`);
}

/** Mark an account as the active one (update lastActiveAt) */
export function setActiveAccount(id: string): void {
    const accounts = getStoredAccounts();
    const target = accounts.find((a) => a.id === id);
    if (target) {
        target.lastActiveAt = Date.now();
        persist(accounts);
        console.log(`🔄 [AccountManager] Active account set: ${target.email}`);
    }
}

/** Remove a specific account by id */
export function removeAccount(id: string): void {
    const accounts = getStoredAccounts().filter((a) => a.id !== id);
    persist(accounts);
    console.log(`🗑️ [AccountManager] Removed account: ${id}`);
}

/** Clear all stored accounts */
export function clearAllAccounts(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
    console.log("🗑️ [AccountManager] All accounts cleared");
}
