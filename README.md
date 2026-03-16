# Land Registry Command Platform

Production-style full-stack land registry dApp with:
- Smart contract + NFT-backed properties
- Multi-level government approvals
- Ownership timeline tracking
- AI fraud detection (`IsolationForest`)
- React operations dashboard

## Tech Stack
- `client`: React + Vite + Leaflet
- `server`: Node.js + Express + MongoDB + Ethers
- `blockchain`: Solidity + Hardhat
- `ai-module`: Python + scikit-learn

## Prerequisites
- Node.js `>=20`
- Python `>=3.10`
- MongoDB running locally (`mongodb://127.0.0.1:27017`)

## Setup
1. Install workspace packages:
```bash
npm run install:all
```
2. Install AI packages:
```bash
pip install -r ai-module/requirements.txt
```
3. Configure env:
- Copy `server/.env.example` to `server/.env`
- Copy `client/.env.example` to `client/.env` (optional if same defaults)

## Run Locally
1. Start blockchain node:
```bash
npm run dev:blockchain
```
2. Deploy contract (new terminal):
```bash
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```
Or use automated local deploy + env sync:
```bash
npm run ops:deploy-sync
```
3. Put deployed address in `server/.env` as `CONTRACT_ADDRESS`.
4. Start backend + frontend:
```bash
npm run dev:server
npm run dev:client -- --host 0.0.0.0 --port 5173
```

Or run all together:
```bash
npm run dev
```

## MetaMask Setup
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Currency: `ETH`
- Import a Hardhat account private key from node output

## Key User Flows
- Register Property: draw polygon + upload document content
- Verify Property: approve `tehsildar -> sdm -> collector` then verify
- Transfer Property: transfer owner after approvals
- Dashboard: risk filtering, table/cards view, alerts, gas comparison, timeline

## API Role Header Requirement
Backend expects:
- `x-user-role`: `admin|officer|buyer|auditor|tehsildar|sdm|collector`
- `x-user-id`: any user identifier string

Frontend sets these automatically from role switcher + wallet.

## Operator Preflight
Before business testing, run diagnostics from Dashboard or call:
```bash
GET /api/system/preflight
```
Checks included:
- Mongo connectivity
- RPC connectivity
- Contract deployed at configured address
- Auth context validity
- Parcel lookup health
