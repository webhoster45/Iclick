// Static map of URL slug → Injective testnet spot market IDs
// Verified from Injective testnet chain explorer
export const MARKETS = {
  inj_usdc: {
    marketId: '0x5e80ae5b2c7fc0f27d4f2d38afd41d40a7c15742ffb5e4e6a425ec529a6a2bc0',
    baseDenom: 'inj',
    quoteDenom: 'peggy0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d',
    baseSymbol: 'INJ',
    quoteSymbol: 'USDC',
    baseDecimals: 18,
    quoteDecimals: 6,
    minPriceTickSize: '0.000000000000001',
    minQuantityTickSize: '1000000000000000',
  },
};

export function getMarket(slug) {
  return MARKETS[slug?.toLowerCase()] || null;
}
