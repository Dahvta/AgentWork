# Development

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and configure Arc RPC URLs plus deployed contract addresses.
3. Start Postgres and Redis: `docker compose up postgres redis`
4. Generate Prisma client: `npm run db:generate`
5. Run migrations: `npm run db:migrate`
6. Start API: `npm run backend:dev`
7. Start frontend: `npm run dev`

Contracts:

- Build: `npm run contracts:build`
- Test: `npm run contracts:test`
- Deploy: `forge script contracts/script/Deploy.s.sol --rpc-url $env:ARC_RPC_HTTP_URL --private-key $env:DEPLOYER_PRIVATE_KEY --broadcast`
