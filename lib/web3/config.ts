import { createConfig, http } from 'wagmi';
import { baseSepolia, base } from 'wagmi/chains';
import { farcasterFrame } from '@farcaster/miniapp-wagmi-connector';
import { injected } from 'wagmi/connectors';

// Determine chain based on env
const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '84532');
const isTestnet = chainId === 84532;

const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || (
  isTestnet
    ? 'https://sepolia.base.org'
    : 'https://mainnet.base.org'
);

// Build connectors array
const connectors = [
  farcasterFrame(),
  // Add injected connector for dev/testing outside Mini App
  ...(process.env.NODE_ENV === 'development' ? [injected()] : []),
];

// Create config with explicit chain type to satisfy wagmi's strict typing
const wagmiConfig = isTestnet
  ? createConfig({
      chains: [baseSepolia],
      connectors,
      transports: {
        [baseSepolia.id]: http(rpcUrl),
      },
    })
  : createConfig({
      chains: [base],
      connectors,
      transports: {
        [base.id]: http(rpcUrl),
      },
    });

const chain = isTestnet ? baseSepolia : base;

export { wagmiConfig, chain, isTestnet, rpcUrl };
