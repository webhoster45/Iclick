"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { IndexerGrpcSpotApi } from "@injectivelabs/sdk-ts";
import { ENDPOINTS, toInjAddress } from "@/lib/injective";

const formatNumber = (value, decimals = 4) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return number.toLocaleString(undefined, { maximumFractionDigits: decimals });
};

export default function HistoryPage() {
  const { login, authenticated } = usePrivy();
  const { wallets } = useWallets();

  const [trades, setTrades] = useState([]);
  const [alphaLinks, setAlphaLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const walletAddress = wallets?.[0]?.address;
  const injAddress = walletAddress ? toInjAddress(walletAddress) : "";

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = JSON.parse(window.localStorage.getItem("iclick.alphaLinks") || "[]");
      setAlphaLinks(stored);
    } catch (err) {
      console.error("Failed to load alpha links", err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const spotApi = new IndexerGrpcSpotApi(ENDPOINTS.indexer);

    async function loadTrades() {
      if (!injAddress) return;
      try {
        setLoading(true);
        setError("");
        const response = await spotApi.fetchTrades({
          accountAddress: injAddress,
          pagination: { limit: 20 },
        });
        if (!mounted) return;
        setTrades(response?.trades || []);
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || "Failed to load trade history");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadTrades();
    return () => {
      mounted = false;
    };
  }, [injAddress]);

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col selection:bg-primary selection:text-on-primary">
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
          <div className="text-xl font-bold tracking-tighter text-black dark:text-white">Iclick</div>
          <div className="hidden md:flex items-center gap-8 font-['Inter'] tracking-tight text-sm font-medium">
            <Link className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors duration-200" href="/markets">Markets</Link>
            <Link className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors duration-200" href="/">Trade</Link>
            <Link className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors duration-200" href="/alpha">Alpha</Link>
            <Link className="text-black dark:text-white font-semibold border-b border-black dark:border-white pb-1" href="/history">History</Link>
            <Link className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors duration-200" href="/portfolio">Portfolio</Link>
          </div>
          <div className="flex items-center gap-4">
            <button
              className="bg-primary text-on-primary px-6 py-3 rounded-full text-sm font-medium active:scale-95 transition-transform duration-150"
              onClick={authenticated ? undefined : login}
              type="button"
            >
              {authenticated ? "Wallet Connected" : "Connect Wallet"}
            </button>
          </div>
        </div>
        <div className="bg-neutral-100/50 dark:bg-neutral-900/50 h-[1px]"></div>
      </nav>

      <main className="pt-32 pb-24 px-6 max-w-screen-2xl mx-auto w-full">
        <section className="mb-16">
          <div className="max-w-3xl">
            <span className="label-sm text-on-surface-variant tracking-[0.05em] uppercase font-bold text-xs">History</span>
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter text-primary mt-4">Recent Trades</h1>
            <p className="text-on-surface-variant text-lg mt-6 leading-relaxed">
              Your latest Injective spot trades pulled from the indexer.
            </p>
          </div>
        </section>

        {!authenticated && (
          <div className="bg-surface-container-low rounded-2xl p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
            <h2 className="text-2xl font-bold tracking-tight mb-2">Connect your wallet</h2>
            <p className="text-on-surface-variant mb-6">Sign in with Privy to fetch your trade history.</p>
            <button
              className="bg-primary text-on-primary px-8 py-3 rounded-full text-sm font-bold tracking-tight hover:opacity-90 transition-opacity"
              onClick={login}
              type="button"
            >
              Connect Wallet
            </button>
          </div>
        )}

        {authenticated && (
          <>
            <section className="bg-surface-container-low rounded-2xl p-6 md:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.05)] mb-10">
              <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Alpha Links</h2>
                  <p className="text-on-surface-variant text-sm">Links generated from the homepage.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {alphaLinks.map((entry) => (
                  <div
                    key={entry.createdAt + entry.link}
                    className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  >
                    <div className="font-mono text-xs break-all text-on-surface-variant">{entry.link}</div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                      <Link
                        href={entry.link}
                        className="bg-primary text-on-primary px-4 py-2 rounded-full text-xs font-bold tracking-tight"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                ))}

                {alphaLinks.length === 0 && (
                  <div className="text-center text-on-surface-variant py-12">
                    No alpha links generated yet.
                  </div>
                )}
              </div>
            </section>

            <section className="bg-surface-container-low rounded-2xl p-6 md:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Trade History</h2>
                  <p className="text-on-surface-variant text-sm">Latest 20 spot trades for your wallet.</p>
                </div>
                {loading && (
                  <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Loading...</span>
                )}
              </div>

              {error && (
                <div className="mb-6 p-4 rounded-xl bg-error-container text-on-error-container text-sm font-medium">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {trades.map((trade) => (
                  <div
                    key={trade.tradeId}
                    className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6"
                  >
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Market</div>
                      <div className="text-2xl font-bold tracking-tight text-primary">{trade.marketId}</div>
                      <div className="text-sm text-on-surface-variant mt-1">Side: {trade.tradeExecutionType}</div>
                    </div>

                    <div className="flex flex-wrap gap-6">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Price</div>
                        <div className="text-lg font-semibold text-primary">{formatNumber(trade.price)}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Quantity</div>
                        <div className="text-lg font-semibold text-primary">{formatNumber(trade.quantity)}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Fee</div>
                        <div className="text-lg font-semibold text-primary">{formatNumber(trade.fee)}</div>
                      </div>
                    </div>
                  </div>
                ))}

                {!loading && trades.length === 0 && !error && (
                  <div className="text-center text-on-surface-variant py-12">
                    No trades found yet.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="mt-auto pt-12 border-t border-outline-variant/20 flex flex-col md:flex-row justify-between items-center gap-8 px-6 pb-12 max-w-screen-2xl mx-auto w-full">
        <div className="text-on-surface-variant text-sm font-medium tracking-tight">Built on Injective Testnet · Powered by Privy</div>
        <div className="flex gap-8 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          <a className="hover:text-primary transition-colors" href="#">Twitter</a>
          <a className="hover:text-primary transition-colors" href="#">Documentation</a>
          <a className="hover:text-primary transition-colors" href="#">Governance</a>
        </div>
      </footer>
    </div>
  );
}
