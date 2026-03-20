import {
  ChainGrpcAuthApi,
  ChainGrpcTendermintApi,
  TxGrpcApi,
  createTransaction,
  createWeb3Extension,
  createTxRawEIP712,
  getEip712TypedData,
  IndexerGrpcSpotApi,
  MsgCreateSpotMarketOrder,
  spotPriceToChainPriceToFixed,
  spotQuantityToChainQuantityToFixed,
  getInjectiveAddress,
  SIGN_EIP712,
  hexToBuff,
} from '@injectivelabs/sdk-ts';
import { Network, getNetworkEndpoints } from '@injectivelabs/networks';
import { BigNumberInBase } from '@injectivelabs/utils';

export const OrderType = {
  Buy: 1,
  Sell: 2,
  StopBuy: 3,
  StopSell: 4,
  TakeBuy: 5,
  TakeSell: 6,
};

export const NETWORK = Network.TestnetSentry;
export const ENDPOINTS = getNetworkEndpoints(NETWORK);
export const DEFAULT_GAS = 200000;

/**
 * Custom lightweight EIP712 Broadcaster
 */
export async function broadcastEip712({ msgs, injectiveAddress, ethereumAddress, provider }) {
  const chainId = 'injective-888';
  let ethereumChainId = 1;
  try {
    const chainIdHex = await provider.request({ method: 'eth_chainId' });
    if (typeof chainIdHex === 'string') {
      ethereumChainId = parseInt(chainIdHex, 16);
    }
  } catch {
    // Fallback to mainnet if chain id cannot be detected
    ethereumChainId = 1;
  }

  const authApi = new ChainGrpcAuthApi(ENDPOINTS.grpc);
  const { baseAccount } = await authApi.fetchAccount(injectiveAddress);

  const tendermintApi = new ChainGrpcTendermintApi(ENDPOINTS.grpc);
  const latestBlock = await tendermintApi.fetchLatestBlock();
  const latestHeight = latestBlock.header.height;
  const timeoutHeight = new BigNumberInBase(latestHeight).plus(100);

  const stdFee = {
    amount: [{ amount: '2000000000000000', denom: 'inj' }],
    gas: DEFAULT_GAS.toString(),
  };

  const eip712TypedData = getEip712TypedData({
    msgs: Array.isArray(msgs) ? msgs : [msgs],
    fee: stdFee,
    tx: {
      memo: '',
      accountNumber: baseAccount.accountNumber.toString(),
      sequence: baseAccount.sequence.toString(),
      timeoutHeight: timeoutHeight.toFixed(),
      chainId,
    },
    ethereumChainId,
  });

  const signature = await provider.request({
    method: 'eth_signTypedData_v4',
    params: [ethereumAddress, JSON.stringify(eip712TypedData)],
  });

  const { txRaw } = createTransaction({
    message: msgs,
    memo: '',
    signMode: SIGN_EIP712,
    fee: stdFee,
    pubKey: baseAccount.pubKey.key,
    sequence: baseAccount.sequence,
    timeoutHeight: timeoutHeight.toNumber(),
    accountNumber: baseAccount.accountNumber,
    chainId,
  });

  const web3Extension = createWeb3Extension({ ethereumChainId });
  const txRawEip712 = createTxRawEIP712(txRaw, web3Extension);
  txRawEip712.signatures = [hexToBuff(signature)];

  const txApi = new TxGrpcApi(ENDPOINTS.grpc);
  const response = await txApi.broadcast(txRawEip712);

  if (response.code !== 0) {
    throw new Error(response.rawLog || 'Transaction failed');
  }

  return response;
}

// 1% slippage (safe minimum for spot market order)
const SLIPPAGE = 0.01;

/**
 * Derive native inj... address from an EVM 0x... address
 */
export function toInjAddress(evmAddress) {
  return getInjectiveAddress(evmAddress);
}

/**
 * Fetch best price for a given market and side from the Injective Indexer
 */
export async function getBestPrice(marketId, side) {
  if (!marketId || !/^0x[0-9a-fA-F]{64}$/.test(marketId)) {
    throw new Error('Invalid market id');
  }
  const indexer = new IndexerGrpcSpotApi(ENDPOINTS.indexer);
  const orderbook = await indexer.fetchOrderbookV2(marketId);

  if (side === 'buy') {
    // Best ask (lowest offer we can buy at)
    const asks = orderbook?.orderbookV2?.asks || [];
    if (!asks.length) return null;
    return parseFloat(asks[0].price);
  } else {
    // Best bid (highest bid we can sell to)
    const bids = orderbook?.orderbookV2?.bids || [];
    if (!bids.length) return null;
    return parseFloat(bids[0].price);
  }
}

/**
 * Fetch last traded price for a given market from the Injective Indexer.
 */
export async function getLastTradePrice(marketId) {
  if (!marketId || !/^0x[0-9a-fA-F]{64}$/.test(marketId)) {
    throw new Error('Invalid market id');
  }
  const indexer = new IndexerGrpcSpotApi(ENDPOINTS.indexer);
  const response = await indexer.fetchTrades({
    marketId,
    pagination: { limit: 1 },
  });
  const trade = response?.trades?.[0];
  if (!trade?.price) return null;
  return parseFloat(trade.price);
}

/**
 * Resolve a spot market by slug or ticker using the Indexer.
 * Accepts inputs like "inj_usdc", "inj-usdc", "INJ/USDC", or "injusdc".
 */
export async function fetchSpotMarketBySlug(slug) {
  if (!slug) return null;
  const normalized = slug.toLowerCase().replace(/\s+/g, '').replace('/', '_').replace('-', '_');
  if (!normalized) return null;

  const tickerCandidates = [];
  if (normalized.includes('_')) {
    const [base, quote] = normalized.split('_');
    if (base && quote) {
      tickerCandidates.push(`${base.toUpperCase()}/${quote.toUpperCase()}`);
    }
  }
  const compactCandidate = normalized.replace('_', '');

  const indexer = new IndexerGrpcSpotApi(ENDPOINTS.indexer);
  const markets = await indexer.fetchMarkets();

  const match = markets.find((market) => {
    const ticker = (market.ticker || '').toUpperCase();
    if (tickerCandidates.includes(ticker)) return true;
    const compact = ticker.replace('/', '').toLowerCase();
    return compact === compactCandidate;
  });

  return match || null;
}

/**
 * Build and broadcast a spot market order via a private key (for demo/server).
 * In the browser flow, we use broadcastViaPrivy instead.
 */
export async function buildMarketOrderMsg({
  marketId,
  side,
  amount,
  price,
  injectiveAddress,
  subaccountId,
  market,
}) {
  if (!marketId || !/^0x[0-9a-fA-F]{64}$/.test(marketId)) {
    throw new Error('marketId is required and must be a 0x-prefixed 64-byte hex string');
  }

  const slippageMultiplier = side === 'buy' ? 1 + SLIPPAGE : 1 - SLIPPAGE;
  const worstPrice = price * slippageMultiplier;

  const chainPrice = spotPriceToChainPriceToFixed({
    value: worstPrice,
    baseDecimals: market.baseDecimals,
    quoteDecimals: market.quoteDecimals,
  });

  const chainQuantity = spotQuantityToChainQuantityToFixed({
    value: amount,
    baseDecimals: market.baseDecimals,
  });

  const orderType =
    side === 'buy' ? OrderType.Buy : OrderType.Sell;

  const params = {
    marketId,
    subaccountId,
    injectiveAddress,
    orderType,
    price: chainPrice,
    quantity: chainQuantity,
    feeRecipient: injectiveAddress,
  };

  const msg = MsgCreateSpotMarketOrder.fromJSON(params);

  return msg;
}
