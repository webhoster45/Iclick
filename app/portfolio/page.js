"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { IndexerGrpcAccountPortfolioApi } from "@injectivelabs/sdk-ts";
import { BigNumberInBase } from "@injectivelabs/utils";
import { ENDPOINTS, toInjAddress } from "@/lib/injective";
import { MARKETS } from "@/lib/markets";

const buildDenomMeta = () => {
  const map = new Map();
  Object.values(MARKETS).forEach((market) => {
    if (market.baseDenom) {
      map.set(market.baseDenom, {
        symbol: market.baseSymbol,
        decimals: market.baseDecimals,
      });
    }
    if (market.quoteDenom) {
      map.set(market.quoteDenom, {
        symbol: market.quoteSymbol,
        decimals: market.quoteDecimals,
      });
    }
  });
  map.set("inj", { symbol: "INJ", decimals: 18 });
  return map;
};

const formatAmount = (value, decimals = 6) => {
  if (!value) return "0";
  try {
    return new BigNumberInBase(value).shiftedBy(-decimals).toFormat(4);
  } catch {
    return value;
  }
};

export default function PortfolioPage() {
  const { login, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const activeWallet =
    wallets?.find((wallet) => wallet.walletClientType === "metamask") || wallets?.[0];

  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const denomMeta = useMemo(() => buildDenomMeta(), []);
  const walletAddress = activeWallet?.address;
  const injAddress = walletAddress ? toInjAddress(walletAddress) : "";

  useEffect(() => {
    let mounted = true;
    const portfolioApi = new IndexerGrpcAccountPortfolioApi(ENDPOINTS.indexer);

    async function loadPortfolio() {
      if (!injAddress) return;
      try {
        setLoading(true);
        setError("");
        const data = await portfolioApi.fetchAccountPortfolio(injAddress);
        if (mounted) setPortfolio(data);
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || "Failed to load portfolio");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPortfolio();
    return () => {
      mounted = false;
    };
  }, [injAddress]);

  const balances = portfolio?.bankBalancesList || [];
  const positions = portfolio?.positionsWithUpnlList || [];
  const subaccounts = portfolio?.subaccountsList || [];

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col selection:bg-primary selection:text-on-primary">
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
          <div className="text-xl font-bold tracking-tighter text-black dark:text-white">Iclick</div>
          <div className="hidden md:flex items-center gap-8 font-['Inter'] tracking-tight text-sm font-medium">
            <Link className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors duration-200" href="/markets">Markets</Link>
            <Link className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors duration-200" href="/">Trade</Link>
            <Link className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors duration-200" href="/alpha">Alpha</Link>
            <Link className="text-black dark:text-white font-semibold border-b border-black dark:border-white pb-1" href="/portfolio">Portfolio</Link>
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
            <span className="label-sm text-on-surface-variant tracking-[0.05em] uppercase font-bold text-xs">Portfolio</span>
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter text-primary mt-4">Your Injective Balance</h1>
            <p className="text-on-surface-variant text-lg mt-6 leading-relaxed">
              Live balances and open positions pulled from Injective testnet.
            </p>
          </div>
        </section>

        {!authenticated && (
          <div className="bg-surface-container-low rounded-2xl p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
            <h2 className="text-2xl font-bold tracking-tight mb-2">Connect your wallet</h2>
            <p className="text-on-surface-variant mb-6">Sign in with Privy to fetch your Injective portfolio.</p>
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
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-7 space-y-8">
              <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold tracking-tight">Wallet Balances</h2>
                  {loading && (
                    <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Loading...</span>
                  )}
                </div>

                {error && (
                  <div className="mb-6 p-4 rounded-xl bg-error-container text-on-error-container text-sm font-medium">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  {balances.map((balance) => {
                    const meta = denomMeta.get(balance.denom) || { symbol: balance.denom, decimals: 6 };
                    return (
                      <div
                        key={`${balance.denom}-${balance.amount}`}
                        className="flex items-center justify-between bg-surface-container-low p-4 rounded-xl"
                      >
                        <div>
                          <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Asset</div>
                          <div className="text-lg font-semibold text-primary">{meta.symbol}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Balance</div>
                          <div className="text-lg font-semibold text-primary">
                            {formatAmount(balance.amount, meta.decimals)}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {!loading && balances.length === 0 && !error && (
                    <div className="text-sm text-on-surface-variant">No balances found.</div>
                  )}
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
                <h2 className="text-2xl font-bold tracking-tight mb-6">Derivative Positions</h2>
                <div className="space-y-4">
                  {positions.map((item) => (
                    <div
                      key={`${item.position?.marketId}-${item.position?.subaccountId}`}
                      className="flex items-center justify-between bg-surface-container-low p-4 rounded-xl"
                    >
                      <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Market</div>
                        <div className="text-lg font-semibold text-primary">
                          {item.position?.ticker || item.position?.marketId}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">UPnL</div>
                        <div className="text-lg font-semibold text-primary">
                          {formatAmount(item.unrealizedPnl, 6)}
                        </div>
                      </div>
                    </div>
                  ))}

                  {!loading && positions.length === 0 && !error && (
                    <div className="text-sm text-on-surface-variant">No open positions.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-8">
              <div className="bg-primary text-on-primary p-8 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
                <h3 className="text-xl font-bold mb-2">Wallet Summary</h3>
                <p className="text-on-primary/70 text-sm mb-6">Connected account overview.</p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Wallet Address</span>
                    <span className="text-sm font-semibold">{walletAddress || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Balances</span>
                    <span className="text-sm font-semibold">{balances.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Subaccounts</span>
                    <span className="text-sm font-semibold">{subaccounts.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Open Positions</span>
                    <span className="text-sm font-semibold">{positions.length}</span>
                  </div>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-8">
                <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
                <div className="flex flex-col gap-3">
                  <Link
                    href="/markets"
                    className="w-full bg-primary text-on-primary py-3 rounded-full text-sm font-bold tracking-tight text-center"
                  >
                    Explore Markets
                  </Link>
                  <Link
                    href="/alpha"
                    className="w-full border border-outline-variant/40 text-primary py-3 rounded-full text-sm font-bold tracking-tight text-center"
                  >
                    Launch Alpha Link
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="mt-auto pt-12 border-t border-outline-variant/20 flex flex-col md:flex-row justify-between items-center gap-8 px-6 pb-12 max-w-screen-2xl mx-auto w-full">
        <div className="text-on-surface-variant text-sm font-medium tracking-tight">Built on Injective Testnet - Powered by Privy</div>
        <div className="flex gap-8 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          <a className="hover:text-primary transition-colors" href="#">Twitter</a>
          <a className="hover:text-primary transition-colors" href="#">Documentation</a>
          <a className="hover:text-primary transition-colors" href="#">Governance</a>
        </div>
      </footer>
    </div>
  );
}
