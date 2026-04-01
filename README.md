# UniTrade

UniTrade is a campus marketplace built with React, Firebase, and Algorand TestNet.

It supports:
- real-time listings
- wallet-based purchases
- OTP-verified in-person handovers
- chat offers between buyer and seller
- wishlist and profile sync

## Current UI Theme
The currently active design system is Sovereign Glass.

Theme loading order:
1. Base styles: [src/index.css](src/index.css)
2. Active override theme: [src/sovereign-glass.css](src/sovereign-glass.css)
3. Entry mount: [src/main.jsx](src/main.jsx)

## Core Features
1. Marketplace browsing with search, sort, category, condition, and price filters
2. Listing creation modal with optional AI-assisted metadata
3. Pera wallet connect and live ALGO balance display
4. Order lifecycle with held payment and OTP verification
5. Buyer/seller realtime chat and negotiated offers
6. Wishlist and profile persistence per authenticated user
7. Campus meetup map and pickup location selection

## Tech Stack
- React 19
- Vite 7
- Framer Motion
- Firebase Auth + Firestore + Storage
- Algorand SDK + Pera Wallet Connect
- React Leaflet + Leaflet
- Gemini integration through API route

## Project Structure
Top-level:
- [src](src): frontend app
- [api](api): API handlers
- [server](server): server-side AI helpers
- [firestore.rules](firestore.rules): Firestore security rules

Inside [src](src):
- [src/App.jsx](src/App.jsx): main application container and workflows
- [src/components](src/components): UI building blocks (modals, cards, drawers)
- [src/hooks](src/hooks): realtime orchestration hooks
- [src/services](src/services): data and side-effect services
- [src/firebase/config.js](src/firebase/config.js): Firebase bootstrap and env validation
- [src/data/seedListings.js](src/data/seedListings.js): initial seed data

## End-to-End Workflow (Quick View)
1. App boots and loads Firebase config
2. Anonymous auth starts (if no user session)
3. Realtime subscriptions hydrate listings/orders/wishlist/profile
4. User optionally connects wallet
5. Buyer places order and pickup location
6. Buyer generates OTP, seller verifies OTP
7. Buyer releases on-chain payment (Algorand)
8. Order marked completed and listing marked sold

## Data and Security
Key Firestore collections:
- listings
- orders
- orderSecrets
- wishlists
- users
- chats (with messages subcollection)

Security highlights in [firestore.rules](firestore.rules):
1. Listings are owner-write only
2. Orders are visible/updateable only to buyer or seller
3. orderSecrets is buyer-only (plaintext OTP visibility)
4. Wishlist is user-owned only

## Setup From Scratch
1. Install dependencies:

```bash
npm install
```

2. Create a .env file with Firebase web config values:
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID

3. Add server key for AI endpoint:
- GEMINI_API_KEY

4. Start development server:

```bash
npm run dev
```

## Scripts
- dev: start Vite dev server
- build: production build
- lint: run ESLint
- preview: preview production build

See [package.json](package.json) for exact script definitions.

## Troubleshooting
1. If app loads but data is empty, check Firebase env vars and Firestore API enablement
2. If auth fails, ensure Anonymous Sign-In is enabled in Firebase Auth
3. If listing image upload fails, verify Storage bucket permissions and CORS
4. If wallet actions fail, reconnect Pera wallet and verify TestNet balance
5. If AI analyze fails, ensure GEMINI_API_KEY is configured

Built by Team Vectôr.
