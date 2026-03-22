"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth";

const normalizeMarket = (value) => {
  if (!value) return "";
  return value.trim().toLowerCase().replace(/\s+/g, "").replace("/", "_");
};

  const formatAddress = (address) => {
    if (!address) return "";
    const start = address.slice(0, 6);
    const end = address.slice(-4);
    return `${start}...${end}`;
  };

const buildAlphaLink = (base, market, side, amount) => {
  const normalizedMarket = normalizeMarket(market);
  const trimmedAmount = amount.trim();
  const params = new URLSearchParams();

  if (normalizedMarket) params.set("m", normalizedMarket);
  if (side) params.set("s", side);
  if (trimmedAmount) params.set("q", trimmedAmount);

  if ([...params.keys()].length === 0) {
    return `${base}/alpha?m=inj_usdc&s=buy&q=5`;
  }

  return `${base}/alpha?${params.toString()}`;
};

export default function Homepage() {
  const { login, logout, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const activeWallet =
    wallets?.find((wallet) => wallet.walletClientType === "metamask") || wallets?.[0];

  const [marketInput, setMarketInput] = useState("INJ/USDC");
  const [sideInput, setSideInput] = useState("buy");
  const [amountInput, setAmountInput] = useState("5");
  const [copied, setCopied] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [baseUrl, setBaseUrl] = useState("http://localhost:3000");

  const copyTimeoutRef = useRef(null);
  const walletAddress = authenticated && activeWallet ? activeWallet.address : "";

  const alphaLink = useMemo(
    () => buildAlphaLink(baseUrl, marketInput, sideInput, amountInput),
    [baseUrl, marketInput, sideInput, amountInput]
  );

  const storeAlphaLink = (link) => {
    if (typeof window === "undefined") return;
    try {
      const key = "iclick.alphaLinks";
      const existing = JSON.parse(window.localStorage.getItem(key) || "[]");
      const entry = { link, createdAt: new Date().toISOString() };
      const next = [entry, ...existing].slice(0, 50);
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch (error) {
      console.error("Failed to store alpha link", error);
    }
  };

  const handleCopy = async () => {
    if (!hasGenerated) return;
    try {
      await navigator.clipboard.writeText(alphaLink);
      setCopied(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch (error) {
      console.error("Copy failed", error);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
          <div className="text-xl font-bold tracking-tighter text-black dark:text-white">Iclick</div>
          <div className="hidden md:flex items-center gap-8 font-['Inter'] tracking-tight text-sm font-medium">
            <a className="text-black dark:text-white font-semibold border-b border-black dark:border-white pb-1" href="/markets">Markets</a>
            <a className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors duration-200" href="/">Trade</a>
            <a className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors duration-200" href="/alpha">Alpha</a>
            <a className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors duration-200" href="/history">History</a>
            <a className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors duration-200" href="/portfolio">Portfolio</a>
          </div>
          <div className="flex items-center gap-4">
            <button
              className="material-symbols-outlined p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-full transition-all active:scale-95"
              data-icon="notifications"
              type="button"
            >
              notifications
            </button>
            <button
              className="bg-primary text-on-primary px-6 py-3 rounded-full text-sm font-medium active:scale-95 transition-transform duration-150"
              onClick={authenticated ? logout : login}
              type="button"
            >
              {authenticated ? formatAddress(walletAddress) : "Connect Wallet"}
            </button>
          </div>
        </div>
        <div className="bg-neutral-100/50 dark:bg-neutral-900/50 h-[1px]"></div>
      </nav>

      <main className="pt-32 pb-24 px-6 max-w-screen-2xl mx-auto">
        <section className="mb-32 text-center md:text-left">
          <div className="max-w-4xl">
            <h1 className="text-7xl md:text-9xl font-extrabold tracking-tighter mb-8 text-primary leading-none">1-Click Alpha</h1>
            <p className="text-xl md:text-3xl text-on-surface-variant font-medium max-w-3xl leading-relaxed tracking-tight">
              Share an Alpha Link. Anyone who clicks it gets a pre-filled trade confirmation on Injective — no settings, no gas math.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7 bg-surface-container-low p-8 md:p-12 rounded-xl">
            <div className="flex items-center gap-2 mb-10">
              <span className="label-sm text-on-surface-variant tracking-[0.05em] uppercase font-bold text-xs">01 / The Tool</span>
              <h2 className="text-3xl font-bold tracking-tight">Create Your Alpha Link</h2>
            </div>
            <div className="space-y-10">
              <div className="space-y-3">
                <label className="block label-sm text-on-surface-variant font-bold text-[10px] uppercase tracking-widest">Market</label>
                <div className="relative">
                  <input
                    className="w-full bg-surface-container-high border-none p-5 rounded-lg text-lg focus:ring-0 focus:bg-surface-container-high transition-all"
                    placeholder="e.g., INJ/USDC"
                    type="text"
                    value={marketInput}
                    onChange={(event) => setMarketInput(event.target.value)}
                  />
                  <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-outline" data-icon="search">search</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="block label-sm text-on-surface-variant font-bold text-[10px] uppercase tracking-widest">Side</label>
                  <div className="flex bg-surface-container-high p-1.5 rounded-full">
                    <button
                      className={`flex-1 py-3 px-6 rounded-full text-sm font-bold tracking-tight ${
                        sideInput === "buy"
                          ? "bg-surface-container-lowest shadow-sm"
                          : "text-on-surface-variant hover:text-primary transition-colors"
                      }`}
                      onClick={() => setSideInput("buy")}
                      type="button"
                    >
                      Buy
                    </button>
                    <button
                      className={`flex-1 py-3 px-6 rounded-full text-sm font-bold tracking-tight ${
                        sideInput === "sell"
                          ? "bg-surface-container-lowest shadow-sm"
                          : "text-on-surface-variant hover:text-primary transition-colors"
                      }`}
                      onClick={() => setSideInput("sell")}
                      type="button"
                    >
                      Sell
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block label-sm text-on-surface-variant font-bold text-[10px] uppercase tracking-widest">Amount</label>
                  <div className="relative">
                    <input
                      className="w-full bg-surface-container-high border-none p-4 rounded-lg text-lg focus:ring-0 transition-all"
                      placeholder="e.g., 5 INJ"
                      type="text"
                      value={amountInput}
                      onChange={(event) => setAmountInput(event.target.value)}
                    />
                    <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-outline" data-icon="toll">toll</span>
                  </div>
                </div>
              </div>
              <button
                className="w-full bg-primary text-on-primary py-5 rounded-full text-lg font-bold tracking-tight hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                type="button"
                onClick={() => {
                  setHasGenerated(true);
                  storeAlphaLink(alphaLink);
                }}
              >
                <span>Generate Alpha Link</span>
                <span className="material-symbols-outlined" data-icon="arrow_forward">arrow_forward</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-6">
            {hasGenerated && (
              <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.04)] ring-1 ring-outline-variant/20">
                <span className="label-sm text-on-surface-variant tracking-[0.05em] uppercase font-bold text-[10px] block mb-6">Generated Link</span>
                <div className="p-6 bg-surface-container-low rounded-lg font-mono text-sm break-all text-on-surface-variant mb-8 border border-outline-variant/10">
                  {alphaLink}
                </div>
                <button
                  className="flex items-center gap-2 text-primary font-bold tracking-tight hover:opacity-70 transition-opacity"
                  onClick={handleCopy}
                  type="button"
                >
                  <span className="material-symbols-outlined" data-icon="content_copy">content_copy</span>
                  <span>{copied ? "Copied" : "Copy Link"}</span>
                </button>
              </div>
            )}
            <div className="bg-primary text-on-primary p-8 rounded-xl overflow-hidden relative">
              <div className="relative z-10">
                <h3 className="text-xl font-bold mb-2">Alpha Stream</h3>
                <p className="text-on-primary/60 text-sm leading-relaxed mb-6">Real-time links shared by top traders in the community.</p>
                <div className="flex items-center gap-4 bg-white/10 p-4 rounded-lg backdrop-blur-md">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="material-symbols-outlined" data-icon="person">person</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold opacity-60">TOP TRADER</div>
                    <div className="text-sm font-medium">shared a 100 INJ Buy Link</div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
            </div>
          </div>
        </section>

        <section className="mt-48">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <div className="max-w-xl">
              <span className="label-sm text-on-surface-variant tracking-[0.05em] uppercase font-bold text-xs mb-4 block">Process</span>
              <h2 className="text-5xl font-extrabold tracking-tighter">How it Works</h2>
            </div>
            <div className="text-on-surface-variant font-medium tracking-tight">Simple. Efficient. Permissionless.</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-1 px-1 bg-outline-variant/20 rounded-2xl overflow-hidden">
            <div className="bg-background p-10 group">
              <div className="text-primary-fixed-dim font-bold text-5xl mb-12 opacity-20 group-hover:opacity-100 transition-opacity">01</div>
              <h3 className="text-xl font-bold mb-4">Connect Privy Wallet</h3>
              <p className="text-on-surface-variant leading-relaxed">Secure, social-login enabled wallet connection powered by Privy infrastructure.</p>
            </div>
            <div className="bg-background p-10 group">
              <div className="text-primary-fixed-dim font-bold text-5xl mb-12 opacity-20 group-hover:opacity-100 transition-opacity">02</div>
              <h3 className="text-xl font-bold mb-4">Set your trade parameters</h3>
              <p className="text-on-surface-variant leading-relaxed">Choose your market, side, and quantity. We handle the routing and slippage logic.</p>
            </div>
            <div className="bg-background p-10 group">
              <div className="text-primary-fixed-dim font-bold text-5xl mb-12 opacity-20 group-hover:opacity-100 transition-opacity">03</div>
              <h3 className="text-xl font-bold mb-4">Share with community</h3>
              <p className="text-on-surface-variant leading-relaxed">One link to rule them all. Your community just clicks and confirms. No friction.</p>
            </div>
          </div>
        </section>

        <footer className="mt-48 pt-12 border-t border-outline-variant/20 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-on-surface-variant text-sm font-medium tracking-tight">
            Built on Injective Testnet · Powered by Privy
          </div>
          <div className="flex gap-8 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            <a className="hover:text-primary transition-colors" href="#">Twitter</a>
            <a className="hover:text-primary transition-colors" href="#">Documentation</a>
            <a className="hover:text-primary transition-colors" href="#">Governance</a>
          </div>
        </footer>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center h-16 px-4 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-t border-neutral-100 dark:border-neutral-900 z-50 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.04)]">
        <a className="flex flex-col items-center justify-center text-black dark:text-white" href="#">
          <span className="material-symbols-outlined" data-icon="leaderboard">leaderboard</span>
          <span className="font-['Inter'] text-[10px] uppercase tracking-widest font-bold">Markets</span>
        </a>
        <a className="flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-600" href="#">
          <span className="material-symbols-outlined" data-icon="swap_horiz">swap_horiz</span>
          <span className="font-['Inter'] text-[10px] uppercase tracking-widest font-bold">Trade</span>
        </a>
        <a className="flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-600" href="#">
          <span className="material-symbols-outlined" data-icon="auto_awesome">auto_awesome</span>
          <span className="font-['Inter'] text-[10px] uppercase tracking-widest font-bold">Alpha</span>
        </a>
        <a className="flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-600" href="/history">
          <span className="material-symbols-outlined" data-icon="history">history</span>
          <span className="font-['Inter'] text-[10px] uppercase tracking-widest font-bold">History</span>
        </a>
        <a className="flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-600" href="#">
          <span className="material-symbols-outlined" data-icon="account_balance_wallet">account_balance_wallet</span>
          <span className="font-['Inter'] text-[10px] uppercase tracking-widest font-bold">Portfolio</span>
        </a>
      </nav>
    </>
  );
}

