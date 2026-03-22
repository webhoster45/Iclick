# Iclick - Injective 1-Click Alpha Gateway

Iclick is a Next.js app that turns a single Alpha link into a pre-filled Injective trade confirmation. It combines Privy wallet authentication, Injective SDK order construction, and URL-driven trading flows.

---

**What This App Does (Novice-Friendly)**
- You fill in a market, a side (buy/sell), and an amount on the homepage.
- The app generates a special link called an **Alpha link**.
- Anyone who opens that link sees a ready-to-confirm trade card.
- When they confirm, the app asks their wallet to sign the trade and sends it to Injective testnet.

Think of it like: **“Share a link → friend clicks → trade is already filled in.”**

---

**Core Flow**
1. A user generates an Alpha link on the homepage.
2. The Alpha link encodes market, side, and amount as URL params.
3. The Alpha page parses the params, fetches a live price, and builds a market order.
4. The user signs an EIP-712 transaction via Privy, and the order broadcasts to Injective testnet.

---

**Routes**
- `/` Home. Builds Alpha links and connects wallet.
- `/alpha` Trade confirmation screen. Requires `m`, `s`, `q` query params.
- `/markets` Live Injective spot market snapshots.
- `/history` Alpha links + trade history.
- `/portfolio` Wallet balances and positions (Privy-authenticated).

---

**Quick Start**
1. Install deps
```
C:\Program Files\nodejs\npm.cmd install
```
2. Create `.env.local`
```
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_EVM_CHAIN_ID=1439
```
3. Run dev server
```
C:\Program Files\nodejs\npm.cmd run dev
```
Open `http://localhost:3000`.

---

**Alpha Link Format**
The Alpha page is intentionally URL-driven. It expects:
- `m` market slug, e.g. `inj_usdc`
- `s` side, `buy` or `sell`
- `q` amount (number)

Example:
```
http://localhost:3000/alpha?m=inj_usdc&s=buy&q=1
```

The homepage generates links using the current domain (`window.location.origin`), so it works on localhost, Netlify, or any custom domain.

---

**Manual Price Override (Why It Exists)**
Injective testnet markets sometimes have **empty orderbooks** (no bids/asks). When that happens, the app cannot calculate a price.

So we provide two fallbacks:
1. **Last trade price** (automatic)
2. **Manual price override** (you type a price)

This keeps demos and hackathon flows working even when the testnet has no liquidity.

---

**Wallet Chain ID Note (Why You Saw chainId Errors)**
Injective spot orders sign on the **Injective EVM Testnet**. If your wallet is on Ethereum Mainnet (`1`), the signer will reject the EIP-712 payload.

The app now tries to switch you to Injective EVM Testnet automatically. You can also set:
```
NEXT_PUBLIC_EVM_CHAIN_ID=1439
```
Network parameters used for MetaMask auto-switch:
- Chain ID: 1439
- RPC: https://k8s.testnet.json-rpc.injective.network/
- Explorer: https://testnet.blockscout.injective.network/blocks

---

**Wallet Initialization + Testnet Funds**
If you see an error like:
`Wallet not initialized on Injective...`

That means the Injective account has never signed a transaction before, so the public key is not registered on-chain yet. To fix:
1. Fund the Injective address with **testnet INJ**.
2. Perform any small on-chain action once (a trade or transfer).

Also note: **you need USDC** (or the quote asset) in your Injective testnet wallet to place a buy, plus **INJ** to pay gas.

---

**Architecture Notes**
- `lib/markets.js` holds the market map. Add more markets here.
- `lib/injective.js` wraps Injective SDK helpers for price, order construction, and broadcasting.
- Alpha page validates market IDs strictly before any gRPC calls.
- Webpack is enforced in dev to support Injective SDK polyfills.

---

**Key Files**
- `app/page.js` Homepage UI and Alpha link generator
- `app/alpha/page.js` Alpha trade confirmation + transaction flow
- `app/markets/page.js` Live market snapshots
- `app/history/page.js` Alpha links + trades
- `app/portfolio/page.js` Privy-authenticated portfolio view
- `lib/injective.js` Injective SDK helpers
- `lib/markets.js` Injective market map

---

**Testing Checklist**
1. Homepage
- Click Generate Alpha Link and confirm link shows.
- Copy link and open it in a new tab.

2. Alpha page
- Link with valid params shows confirmation card.
- Clicking Confirm Order prompts wallet signature.
- On success, tx hash links to Injective explorer.

3. Markets page
- Markets list shows best bid/ask values.

4. History page
- Alpha links generated on the homepage show up.
- Trade history loads after connecting wallet.

5. Portfolio page
- Connect wallet and verify balances/positions populate.

---

**Troubleshooting**
- `marketId must match the regexp ...`
  - Make sure your Alpha link uses a valid market slug.
  - Restart dev server after updating Injective helpers.

- Orderbook empty
  - Use the last-trade fallback or enter a manual price.

- Wallet not initialized
  - Fund with testnet INJ and complete one transaction.

- Turbopack warning
  - This project uses Webpack. The `dev` script already forces `next dev --webpack`.

- PowerShell `npm` blocked
  - Use `C:\Program Files\nodejs\npm.cmd` or run in Command Prompt.

---

**Extending the App**
- Add markets: update `lib/markets.js` with new market IDs and symbols.
- Add pages: create new routes under `app/` with the same Tailwind theme.
- Modify UI: edit `app/page.js` and `app/alpha/page.js`.

---

**Deploying**
Deploy anywhere that supports Next.js. The Alpha link generator uses the current domain automatically, so links remain valid on Netlify, Vercel, or custom domains.
