"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { getMarket, MARKETS } from "@/lib/markets";
import { toInjAddress, buildSubaccountId, getBestPrice, getLastTradePrice, buildMarketOrderMsg, broadcastEip712, fetchSpotMarketBySlug } from "@/lib/injective";

const formatAddress = (address) => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const EVM_CHAIN_ID = Number.parseInt(process.env.NEXT_PUBLIC_EVM_CHAIN_ID || "", 10) || 1439;
const EVM_CHAIN_ID_HEX = `0x${EVM_CHAIN_ID.toString(16)}`;
const INJECTIVE_EVM_PARAMS = {
  chainId: EVM_CHAIN_ID_HEX,
  chainName: "Injective EVM Testnet",
  nativeCurrency: {
    name: "INJ",
    symbol: "INJ",
    decimals: 18,
  },
  rpcUrls: ["https://k8s.testnet.json-rpc.injective.network/"],
  blockExplorerUrls: ["https://testnet.blockscout.injective.network/blocks"],
};

const ensureInjectiveEvmNetwork = async (provider) => {
  if (!provider?.request) return;
  const current = await provider.request({ method: "eth_chainId" });
  if (current === EVM_CHAIN_ID_HEX) return;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: EVM_CHAIN_ID_HEX }],
    });
  } catch (err) {
    if (err?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [INJECTIVE_EVM_PARAMS],
      });
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: EVM_CHAIN_ID_HEX }],
      });
      return;
    }
    throw err;
  }
};

export default function AlphaPage() {
  const searchParams = useSearchParams();
  const { login, authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const [selectedWalletAddress, setSelectedWalletAddress] = useState("");
  const activeWallet =
    wallets?.find((wallet) => wallet.address === selectedWalletAddress) || wallets?.[0];

  const slug = searchParams.get("m");
  const side = searchParams.get("s");
  const amount = searchParams.get("q");

  const [price, setPrice] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [priceSource, setPriceSource] = useState("orderbook");
  const [manualPrice, setManualPrice] = useState("");
  const [priceRetrying, setPriceRetrying] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [showInjectiveAddress, setShowInjectiveAddress] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);

  const normalizeSlug = (value) => {
    if (!value) return "";
    return value.toLowerCase().replace(/\s+/g, "").replace("/", "_").replace("-", "_");
  };

  const [resolvedMarket, setResolvedMarket] = useState(null);
  const [isResolvingMarket, setIsResolvingMarket] = useState(false);

  const market = useMemo(() => resolvedMarket, [resolvedMarket]);

  const normalizedSide = side ? side.toLowerCase() : "";
  const isValidMarketId = (value) => /^0x[0-9a-fA-F]{64}$/.test(value || "");

  useEffect(() => {
    let active = true;

    async function resolveMarket() {
      const normalized = normalizeSlug(slug);
      if (!normalized) {
        if (active) setResolvedMarket(null);
        return;
      }

      if (active) setIsResolvingMarket(true);
      const local = getMarket(normalized);
      try {
        const remote = await fetchSpotMarketBySlug(slug);
        if (!active) return;

        if (remote) {
          const [baseSymbol, quoteSymbol] = (remote.ticker || '').split('/');
          setResolvedMarket({
            marketId: remote.marketId,
            baseDenom: remote.baseDenom,
            quoteDenom: remote.quoteDenom,
            baseSymbol: baseSymbol || remote.baseToken?.symbol || local?.baseSymbol || 'BASE',
            quoteSymbol: quoteSymbol || remote.quoteToken?.symbol || local?.quoteSymbol || 'QUOTE',
            baseDecimals: remote.baseToken?.decimals ?? local?.baseDecimals ?? 18,
            quoteDecimals: remote.quoteToken?.decimals ?? local?.quoteDecimals ?? 6,
            minPriceTickSize: remote.minPriceTickSize?.toString?.() ?? local?.minPriceTickSize,
            minQuantityTickSize: remote.minQuantityTickSize?.toString?.() ?? local?.minQuantityTickSize,
          });
          if (active) setIsResolvingMarket(false);
          return;
        }

        if (local) {
          setResolvedMarket(local);
          if (active) setIsResolvingMarket(false);
          return;
        }

        setResolvedMarket(null);
        if (active) setIsResolvingMarket(false);
      } catch {
        if (!active) return;
        setResolvedMarket(local || null);
        if (active) setIsResolvingMarket(false);
      }
    }

    resolveMarket();
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!wallets?.length) {
      setSelectedWalletAddress("");
      return;
    }
    setSelectedWalletAddress((current) => current || wallets[0].address);
  }, [wallets]);

  useEffect(() => {
    if (!isValidMarketId(market?.marketId) || !normalizedSide) return;
    getBestPrice(market.marketId, normalizedSide)
      .then(async (value) => {
        if (value) {
          setPrice(value);
          setPriceSource("orderbook");
          return;
        }
        const fallback = await getLastTradePrice(market.marketId);
        setPrice(fallback ?? null);
        setPriceSource(fallback ? "last_trade" : "none");
      })
      .catch(async () => {
        try {
          const fallback = await getLastTradePrice(market.marketId);
          setPrice(fallback ?? null);
          setPriceSource(fallback ? "last_trade" : "none");
        } catch {
          setPrice(null);
          setPriceSource("none");
        }
      });
  }, [market?.marketId, normalizedSide]);

  const handleLastTradeRetry = async () => {
    if (!isValidMarketId(market?.marketId)) return;
    try {
      setPriceRetrying(true);
      const fallback = await getLastTradePrice(market.marketId);
      setPrice(fallback ?? null);
      setPriceSource(fallback ? "last_trade" : "none");
    } finally {
      setPriceRetrying(false);
    }
  };

  const totalCost = useMemo(() => {
    const effectivePrice = price || (manualPrice ? Number(manualPrice) : null);
    if (!effectivePrice || !amount) return "...";
    const numeric = Number(amount);
    if (!Number.isFinite(numeric)) return "...";
    return (numeric * effectivePrice).toFixed(2);
  }, [price, manualPrice, amount]);

  async function handleConfirm() {
    setError("");
    setStatus("loading");

    try {
      if (!isValidMarketId(market?.marketId)) {
        setError("Invalid market link. Please regenerate the Alpha link.");
        setStatus("error");
        return;
      }
      if (!normalizedSide) {
        setError("Invalid side. Use buy or sell in the Alpha link.");
        setStatus("error");
        return;
      }
      const numericAmount = parseFloat(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        setError("Invalid amount. Please use a positive number in the Alpha link.");
        setStatus("error");
        return;
      }

      if (!authenticated || !activeWallet) {
        await login();
        setStatus("idle");
        return;
      }

      const wallet = activeWallet;
      const provider = await wallet.getEthereumProvider();
      try {
        await ensureInjectiveEvmNetwork(provider);
        const chainIdHex = await provider.request({ method: "eth_chainId" });
        if (chainIdHex !== EVM_CHAIN_ID_HEX) {
          setError(`Please switch your wallet to Injective EVM Testnet (chainId ${EVM_CHAIN_ID}).`);
          setStatus("error");
          return;
        }
      } catch (err) {
        setError("Please switch your wallet to Injective EVM Testnet (chainId 1439) and try again.");
        setStatus("error");
        return;
      }
      let evmAddress = wallet.address;
      try {
        const accounts = await provider.request({ method: "eth_requestAccounts" });
        if (Array.isArray(accounts) && accounts[0]) {
          evmAddress = accounts[0];
        }
      } catch {
        // If provider doesn't expose accounts, fall back to wallet address.
      }
      const injectiveAddress = toInjAddress(evmAddress);
      const subaccountId = buildSubaccountId(evmAddress);
      const activeChainIdHex = await provider.request({ method: "eth_chainId" });
      setDebugInfo({
        evmAddress,
        injectiveAddress,
        subaccountId,
        chainIdHex: activeChainIdHex,
        expectedChainIdHex: EVM_CHAIN_ID_HEX,
      });

      let livePrice = await getBestPrice(market.marketId, normalizedSide);
      if (!livePrice) {
        livePrice = await getLastTradePrice(market.marketId);
      }
      if (!livePrice && manualPrice) {
        const numericManual = Number(manualPrice);
        if (Number.isFinite(numericManual) && numericManual > 0) {
          livePrice = numericManual;
          setPriceSource("manual");
        }
      }
      if (!livePrice) {
        setError("Orderbook is empty and no recent trades were found. Enter a manual price to continue.");
        setStatus("error");
        return;
      }

      const msg = await buildMarketOrderMsg({
        marketId: market.marketId,
        side: normalizedSide,
        amount: numericAmount,
        price: livePrice,
        injectiveAddress,
        subaccountId,
        market,
      });

      const response = await broadcastEip712({
        msgs: [msg],
        injectiveAddress,
        ethereumAddress: evmAddress,
        provider,
      });

      setTxHash(response.txHash);
      setStatus("success");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Transaction failed");
      setStatus("error");
    }
  }

  if (!ready) return null;

  if (slug && side && amount && isResolvingMarket) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface font-['Inter']">
        <div className="bg-surface-container-lowest p-10 rounded-xl shadow-[0_40px_100px_rgba(0,0,0,0.04)] text-center">
          <p className="text-on-surface-variant font-bold text-sm tracking-widest uppercase">Loading Market</p>
        </div>
      </div>
    );
  }

  if (!slug || !side || !amount || !market || !isValidMarketId(market?.marketId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface font-['Inter']">
        <div className="bg-surface-container-lowest p-10 rounded-xl shadow-[0_40px_100px_rgba(0,0,0,0.04)] text-center">
          <p className="text-on-surface-variant font-bold text-sm tracking-widest uppercase">Invalid Alpha Link</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface font-['Inter']">
        <div className="bg-surface-container-lowest p-10 rounded-xl shadow-[0_40px_100px_rgba(0,0,0,0.04)] text-center max-w-md">
          <p className="text-on-surface-variant font-bold text-xs tracking-widest uppercase">Wallet Required</p>
          <h2 className="text-2xl font-bold tracking-tight text-primary mt-4">Connect to Continue</h2>
          <p className="text-on-surface-variant text-sm mt-3">
            This alpha link executes a real trade on Injective testnet. Connect your wallet to proceed.
          </p>
          <button
            className="mt-6 bg-primary text-on-primary px-6 py-3 rounded-full text-sm font-bold tracking-tight hover:opacity-90 transition-opacity"
            onClick={login}
            type="button"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  const authenticatedWallet = activeWallet;
  const evmAddress = authenticatedWallet?.address || "Not Connected";
  const injAddress = authenticatedWallet ? toInjAddress(authenticatedWallet.address) : "Not Connected";
  const displayAddress = showInjectiveAddress ? injAddress : evmAddress;
  const shortAddress = displayAddress !== "Not Connected" ? formatAddress(displayAddress) : "Not connected";
  const showWalletSwitcher = authenticated && wallets?.length > 1;

  const handleCopyAddress = async () => {
    if (!displayAddress || displayAddress === "Not Connected") return;
    try {
      await navigator.clipboard.writeText(displayAddress);
      setAddressCopied(true);
      setTimeout(() => setAddressCopied(false), 1500);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  return (
    <div className="bg-surface text-on-background min-h-screen flex flex-col">
      <header className="fixed top-0 w-full z-50 bg-white dark:bg-neutral-950">
        <div className="flex justify-between items-center h-16 px-6 md:px-12 w-full max-w-screen-2xl mx-auto">
          <div className="text-xl font-bold tracking-tighter text-black dark:text-white">Iclick</div>
          <nav className="hidden md:flex items-center space-x-8">
            <Link className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors font-['Inter'] tracking-tight text-sm font-medium" href="/markets">Markets</Link>
            <Link className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors font-['Inter'] tracking-tight text-sm font-medium" href="/">Trade</Link>
            <Link className="text-black dark:text-white font-semibold border-b-2 border-black dark:border-white pb-1 font-['Inter'] tracking-tight text-sm font-medium" href="/alpha">Alpha</Link>
            <Link className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors font-['Inter'] tracking-tight text-sm font-medium" href="/history">History</Link>
            <Link className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors font-['Inter'] tracking-tight text-sm font-medium" href="/portfolio">Portfolio</Link>
          </nav>
          <div className="flex items-center space-x-4"></div>
        </div>
        <div className="bg-neutral-100 dark:bg-neutral-900 h-[1px]"></div>
      </header>

      <main className="flex-grow flex items-center justify-center px-6 pt-24 pb-32">
        <div className="w-full max-w-lg">
          <div className="bg-surface-container-lowest rounded-xl shadow-[0_40px_100px_rgba(0,0,0,0.04)] overflow-hidden border border-outline-variant/10">
            {status === "success" ? (
              <div className="p-10 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-primary text-3xl">check</span>
                </div>
                <h2 className="text-2xl font-bold text-primary mb-2 tracking-tight">Order Confirmed</h2>
                <p className="text-sm text-on-surface-variant mb-6 font-medium">
                  Transaction successfully broadcasted to Injective Testnet.
                </p>
                <a
                  href={`https://testnet.explorer.injective.network/transaction/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary font-semibold text-sm hover:underline"
                >
                  View on Explorer
                </a>
              </div>
            ) : (
              <>
                <div className="p-10 pb-6">
                  <div className="flex flex-col space-y-1 mb-8">
                    <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-on-surface-variant font-label">Alpha Selection</span>
                    <div className="flex justify-between items-end">
                      <h1 className="text-4xl font-bold tracking-tight text-primary font-headline">
                        {market.baseSymbol} / {market.quoteSymbol}
                      </h1>
                      <div className="bg-primary text-white px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">
                        {side} {amount} {market.baseSymbol}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-px bg-surface-container-high rounded-xl overflow-hidden mb-10">
                    <div className="bg-surface-container-lowest p-6 flex flex-col space-y-2">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant font-label">Quantity</span>
                      <div className="flex items-baseline space-x-1">
                        <span className="text-2xl font-semibold tracking-tight text-primary">{amount}</span>
                        <span className="text-sm font-medium text-on-surface-variant">{market.baseSymbol}</span>
                      </div>
                    </div>
                    <div className="bg-surface-container-lowest p-6 flex flex-col space-y-2">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant font-label">Est. Cost</span>
                      <div className="flex items-baseline space-x-1">
                        <span className="text-2xl font-semibold tracking-tight text-primary">{totalCost}</span>
                        <span className="text-sm font-medium text-on-surface-variant">{market.quoteSymbol}</span>
                      </div>
                      {priceSource === "last_trade" && (
                        <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mt-2">
                          Fallback to last trade price
                        </div>
                      )}
                      {priceSource === "manual" && (
                        <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mt-2">
                          Manual price override
                        </div>
                      )}
                      {priceSource === "none" && (
                        <div className="mt-4">
                          <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
                            Manual Price
                          </label>
                          <input
                            className="w-full bg-surface-container-high border-none p-3 rounded-lg text-sm focus:ring-0"
                            placeholder="Enter price"
                            type="number"
                            min="0"
                            step="0.0001"
                            value={manualPrice}
                            onChange={(event) => setManualPrice(event.target.value)}
                          />
                          <div className="flex items-center justify-between mt-3">
                            <p className="text-[10px] text-on-surface-variant">
                              Orderbook is empty. Provide a manual price to proceed.
                            </p>
                            <button
                              className="text-[10px] font-bold tracking-widest uppercase text-primary"
                              type="button"
                              onClick={handleLastTradeRetry}
                              disabled={priceRetrying}
                            >
                              {priceRetrying ? "Checking..." : "Use Last Trade"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex justify-between items-center group">
                      <span className="text-xs font-medium text-on-surface-variant">Order Type</span>
                      <span className="text-sm font-semibold text-primary">Market Order</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-on-surface-variant">Network</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                        <span className="text-sm font-semibold text-primary">Injective Testnet</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-on-surface-variant">Slippage</span>
                      <span className="text-sm font-semibold text-primary">Max 1%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-surface-container-low px-10 py-5 flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <span className="material-symbols-outlined text-on-surface-variant text-sm" data-icon="account_balance_wallet">
                      account_balance_wallet
                    </span>
                    <span className="text-[11px] font-mono tracking-tight text-on-surface-variant">
                      {authenticated ? shortAddress : "Wallet not connected"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {showWalletSwitcher && (
                      <select
                        className="text-[10px] uppercase tracking-widest text-on-surface-variant bg-surface-container-high rounded-full px-2 py-1"
                        value={selectedWalletAddress}
                        onChange={(event) => setSelectedWalletAddress(event.target.value)}
                        aria-label="Select wallet"
                      >
                      {wallets.map((wallet, index) => (
                          <option key={wallet.address || wallet.walletClientType || index} value={wallet.address}>
                            {formatAddress(wallet.address)} {wallet.walletClientType ? `(${wallet.walletClientType})` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      className="material-symbols-outlined text-primary text-sm"
                      type="button"
                      onClick={handleCopyAddress}
                      disabled={!authenticated}
                      aria-label="Copy address"
                    >
                      {addressCopied ? "check" : "content_copy"}
                    </button>
                    <button
                      className="text-[9px] font-bold tracking-widest text-primary uppercase border border-outline-variant/40 rounded-full px-2 py-1"
                      type="button"
                      onClick={() => setShowInjectiveAddress((prev) => !prev)}
                      disabled={!authenticated}
                    >
                      {showInjectiveAddress ? "Show 0x" : "Show inj"}
                    </button>
                    <span className="text-[9px] font-bold tracking-widest text-primary uppercase">
                      {authenticated ? "Connected" : "Click to Connect"}
                    </span>
                  </div>
                </div>

                <div className="p-10 pt-6">
                  <button
                    onClick={authenticated ? handleConfirm : login}
                    disabled={status === "loading"}
                    className="w-full bg-primary hover:bg-primary-container text-on-primary-fixed py-5 rounded-full font-semibold tracking-tight transition-all duration-300 flex justify-center items-center space-x-2 group"
                    type="button"
                  >
                    {status === "loading" ? (
                      <div className="w-5 h-5 border-2 border-white rounded-full animate-spin border-t-transparent" />
                    ) : (
                      <>
                        <span>{authenticated ? "Confirm Order" : "Connect to Execute"}</span>
                        <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform" data-icon="arrow_forward">
                          arrow_forward
                        </span>
                      </>
                    )}
                  </button>
                  {error && (
                    <div className="mt-4 text-center">
                      <p className="text-error text-[10px] font-bold tracking-widest uppercase">{error}</p>
                      {error.includes("Wallet not initialized") && (
                        <div className="mt-3 text-[10px] text-on-surface-variant">
                          Fund this Injective address and do one small transaction to register the pubkey:
                          <div className="mt-2 font-mono text-[10px] break-all">{injAddress}</div>
                        </div>
                      )}
                      {error.includes("Unauthorized") && debugInfo && (
                        <div className="mt-4 text-[10px] text-on-surface-variant text-left space-y-2">
                          <div className="font-bold uppercase tracking-widest text-[9px]">Debug Info</div>
                          <div className="font-mono break-all">EVM: {debugInfo.evmAddress}</div>
                          <div className="font-mono break-all">inj: {debugInfo.injectiveAddress}</div>
                          <div className="font-mono break-all">Subaccount: {debugInfo.subaccountId}</div>
                          <div className="font-mono">Chain: {debugInfo.chainIdHex} (expected {debugInfo.expectedChainIdHex})</div>
                          <div className="text-[9px] uppercase tracking-widest">
                            If these don’t match the wallet you funded, disconnect and reconnect the right wallet.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-center mt-6 text-[10px] text-on-surface-variant/60 font-medium tracking-wide">
                    By confirming, you agree to our Protocol Terms of Service.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 py-3 md:hidden bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl border-t border-neutral-100 dark:border-neutral-900 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-50">
        <Link className="flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-600 hover:scale-110 transition-transform" href="/">
          <span className="material-symbols-outlined" data-icon="grid_view">grid_view</span>
          <span className="font-['Inter'] text-[10px] uppercase tracking-widest font-bold mt-1">Home</span>
        </Link>
        <Link className="flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-600 hover:scale-110 transition-transform" href="/">
          <span className="material-symbols-outlined" data-icon="swap_vert">swap_vert</span>
          <span className="font-['Inter'] text-[10px] uppercase tracking-widest font-bold mt-1">Trade</span>
        </Link>
        <Link className="flex flex-col items-center justify-center text-black dark:text-white bg-neutral-100 dark:bg-neutral-800 rounded-full w-12 h-12 hover:scale-110 transition-transform" href="/alpha">
          <span className="material-symbols-outlined" data-icon="account_balance">account_balance</span>
        </Link>
        <Link className="flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-600 hover:scale-110 transition-transform" href="/portfolio">
          <span className="material-symbols-outlined" data-icon="settings">settings</span>
          <span className="font-['Inter'] text-[10px] uppercase tracking-widest font-bold mt-1">Settings</span>
        </Link>
      </nav>

      <footer className="w-full py-8 mt-auto flex flex-col md:flex-row justify-between items-center px-6 md:px-12 bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800">
        <div className="font-['Inter'] text-xs tracking-wide uppercase text-neutral-400 dark:text-neutral-500 mb-4 md:mb-0">
          (c) 2024 Iclick Architect. Secure Wallet: {authenticatedWallet ? shortAddress : "0x...7a2b"}
        </div>
        <div className="flex space-x-8">
          <a className="font-['Inter'] text-xs tracking-wide uppercase text-neutral-400 dark:text-neutral-500 hover:text-black dark:hover:text-white transition-colors" href="#">Status</a>
          <a className="font-['Inter'] text-xs tracking-wide uppercase text-neutral-400 dark:text-neutral-500 hover:text-black dark:hover:text-white transition-colors" href="#">Security</a>
          <a className="font-['Inter'] text-xs tracking-wide uppercase text-neutral-400 dark:text-neutral-500 hover:text-black dark:hover:text-white transition-colors" href="#">Terms</a>
        </div>
      </footer>
    </div>
  );
}
