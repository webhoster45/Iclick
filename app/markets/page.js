"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IndexerGrpcSpotApi } from "@injectivelabs/sdk-ts";
import { ENDPOINTS } from "@/lib/injective";

const formatNumber = (value, options = {}) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  const { maximumFractionDigits = 4 } = options;
  return number.toLocaleString(undefined, { maximumFractionDigits });
};

const isValidMarketId = (value) => /^0x[0-9a-fA-F]{64}$/.test(value || "");

export default function MarketsPage() {
  const [markets, setMarkets] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const spotApi = new IndexerGrpcSpotApi(ENDPOINTS.indexer);

    async function loadMarkets() {
      try {
        setLoading(true);
        setError("");
        const fetchedMarkets = await spotApi.fetchMarkets();
        if (!mounted) return;

        const topMarkets = fetchedMarkets.filter((market) => isValidMarketId(market.marketId)).slice(0, 12);
        setMarkets(topMarkets);

        const orderbooks = await Promise.all(
          topMarkets.map(async (market) => {
            try {
              if (!isValidMarketId(market.marketId)) {
                return { marketId: market.marketId, bestBid: null, bestAsk: null };
              }
              const orderbook = await spotApi.fetchOrderbookV2(market.marketId);
              const bids = orderbook?.orderbookV2?.bids || [];
              const asks = orderbook?.orderbookV2?.asks || [];
              return {
                marketId: market.marketId,
                bestBid: bids.length ? bids[0]?.price : null,
                bestAsk: asks.length ? asks[0]?.price : null,
              };
            } catch {
              return { marketId: market.marketId, bestBid: null, bestAsk: null };
            }
          })
        );

        if (!mounted) return;
        const nextQuotes = orderbooks.reduce((acc, quote) => {
          acc[quote.marketId] = quote;
          return acc;
        }, {});
        setQuotes(nextQuotes);
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || "Failed to load markets");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadMarkets();
    return () => {
      mounted = false;
    };
  }, []);

  const rows = useMemo(() => {
    return markets.map((market) => {
      const quote = quotes[market.marketId] || {};
      return {
        ...market,
        bestBid: quote.bestBid,
        bestAsk: quote.bestAsk,
      };
    });
  }, [markets, quotes]);

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col selection:bg-primary selection:text-on-primary">
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
          <div className="text-xl font-bold tracking-tighter text-black dark:text-white">Iclick</div>
          <div className="hidden md:flex items-center gap-8 font-['Inter'] tracking-tight text-sm font-medium">
            <Link className="text-black dark:text-white font-semibold border-b border-black dark:border-white pb-1" href="/markets">Markets</Link>
            <Link className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors duration-200" href="/">Trade</Link>
            <Link className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors duration-200" href="/alpha">Alpha</Link>
            <Link className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors duration-200" href="/portfolio">Portfolio</Link>
          </div>
          <div className="flex items-center gap-4">
            <button
              className="material-symbols-outlined p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-full transition-all active:scale-95"
              data-icon="notifications"
              type="button"
            >
              notifications
            </button>
            <Link
              className="bg-primary text-on-primary px-6 py-3 rounded-full text-sm font-medium active:scale-95 transition-transform duration-150"
              href="/"
            >
              Back to Home
            </Link>
          </div>
        </div>
        <div className="bg-neutral-100/50 dark:bg-neutral-900/50 h-[1px]"></div>
      </nav>

      <main className="pt-32 pb-24 px-6 max-w-screen-2xl mx-auto w-full">
        <section className="mb-20">
          <div className="max-w-3xl">
            <span className="label-sm text-on-surface-variant tracking-[0.05em] uppercase font-bold text-xs">Live Markets</span>
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter text-primary mt-4">Spot Markets Overview</h1>
            <p className="text-on-surface-variant text-lg mt-6 leading-relaxed">
              Real-time orderbook snapshots from Injective testnet. Prices update on refresh.
            </p>
          </div>
        </section>

        <section className="bg-surface-container-low rounded-2xl p-6 md:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Market List</h2>
              <p className="text-on-surface-variant text-sm">Best bid/ask pulled from the Injective orderbook.</p>
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
            {rows.map((market) => (
              <div
                key={market.marketId}
                className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6"
              >
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Ticker</div>
                  <div className="text-2xl font-bold tracking-tight text-primary">{market.ticker}</div>
                  <div className="text-sm text-on-surface-variant mt-1">Status: {market.marketStatus}</div>
                </div>

                <div className="flex flex-wrap gap-6">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Best Bid</div>
                    <div className="text-lg font-semibold text-primary">
                      {market.bestBid ? formatNumber(market.bestBid) : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Best Ask</div>
                    <div className="text-lg font-semibold text-primary">
                      {market.bestAsk ? formatNumber(market.bestAsk) : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Maker / Taker</div>
                    <div className="text-sm font-semibold text-on-surface-variant">
                      {formatNumber(market.makerFeeRate, { maximumFractionDigits: 6 })} / {formatNumber(market.takerFeeRate, { maximumFractionDigits: 6 })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Min Notional</div>
                    <div className="text-sm font-semibold text-on-surface-variant">
                      {formatNumber(market.minNotional, { maximumFractionDigits: 4 })}
                    </div>
                  </div>
                </div>

                <Link
                  href={`/alpha?m=${market.ticker?.toLowerCase().replace("/", "_")}&s=buy&q=1`}
                  className="bg-primary text-on-primary px-5 py-2 rounded-full text-sm font-bold tracking-tight hover:opacity-90 transition-opacity"
                >
                  Open Alpha
                </Link>
              </div>
            ))}

            {!loading && rows.length === 0 && !error && (
              <div className="text-center text-on-surface-variant py-12">
                No markets found. Try refreshing the page.
              </div>
            )}
          </div>
        </section>
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
