# Land Registry DApp

A production-style full-stack decentralized application for land/property registration, verification, and ownership transfer.

## Why This Application Was Built

Traditional land record workflows are often slow, paper-heavy, and difficult to audit. This project was built to demonstrate a transparent, tamper-resistant workflow where:

- Property records are represented on-chain.
- Multi-stage government approvals are enforced by system logic.
- Ownership history can be traced clearly.
- AI-assisted checks can help flag suspicious activity.

## Core Features

- NFT-backed property registration
- Multi-level approval pipeline (`tehsildar -> sdm -> collector`)
- On-chain ownership transfer flow
- Property timeline and dashboard analytics
- AI fraud-risk scoring support (`IsolationForest`)

## Tech Stack

- `client`: React, Vite, Leaflet
- `server`: Node.js, Express, MongoDB, Ethers
- `blockchain`: Solidity, Hardhat, OpenZeppelin
- `ai-module`: Python, scikit-learn

## Project Structure

```text
land-registry-dapp/
|- client/                # Frontend (React + Vite)
|  |- src/
|  |- public/
|  |- .env.example
|- server/                # Backend API (Express + MongoDB + Ethers)
|  |- src/
|  |- .env.example
|- blockchain/            # Smart contracts + Hardhat scripts/tests
|  |- contracts/
|  |- scripts/
|  |- test/
|- ai-module/             # Python fraud detection module
|- scripts/               # Utility scripts (deploy/env sync)
|- package.json           # Root workspace scripts
|- .env.example           # Shared env placeholders
```

## Prerequisites

- Node.js `>= 20`
- npm `>= 9`
- Python `>= 3.10`
- MongoDB running locally (`mongodb://127.0.0.1:27017`)
- MetaMask (for wallet interaction in browser)

## Environment Configuration

1. Create backend env file:
```bash
cp server/.env.example server/.env
```
2. Create frontend env file:
```bash
cp client/.env.example client/.env
```
3. Update values in `server/.env`:
- `MONGO_URI`
- `RPC_URL`
- `PRIVATE_KEY`
- `CONTRACT_ADDRESS` (after deployment)
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`

## Installation

1. Install workspace dependencies:
```bash
npm run install:all
```
2. Install AI dependencies:
```bash
pip install -r ai-module/requirements.txt
```

## How To Run (Step-by-Step)

Open multiple terminals from project root and follow this order.

1. Start local blockchain node:
```bash
npm run dev:blockchain
```

2. Deploy smart contract (new terminal):
```bash
npm run ops:deploy-sync
```
This script deploys contract to local Hardhat node and syncs deployment data for app usage.

3. Start backend API (new terminal):
```bash
npm run dev:server
```

4. Start frontend app (new terminal):
```bash
npm run dev:client -- --host 0.0.0.0 --port 5173
```

5. Open browser:
`http://localhost:5173`

## One-Command Development Mode

If your env is already configured, you can run all services together:

```bash
npm run dev
```

## MetaMask Local Network Setup

- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Currency symbol: `ETH`
- Import one account from Hardhat node private keys

## Testing

Run blockchain tests:

```bash
npm run test:blockchain
```

## API Notes

The backend uses headers for role simulation:

- `x-user-role`: `admin|officer|buyer|auditor|tehsildar|sdm|collector`
- `x-user-id`: any user identifier

Frontend sets these automatically through the app role controls.

## Diagnostics

Preflight endpoint:

```http
GET /api/system/preflight
```

Checks include DB connectivity, RPC availability, contract configuration, auth context, and parcel lookup health.

## Security and Repository Hygiene

- Do not commit real `.env` files.
- Keep only `.env.example` in version control.
- Do not commit `node_modules`, build outputs, or logs.
- Rotate any secret that was exposed accidentally.

## License

Add your preferred license before public production use.
