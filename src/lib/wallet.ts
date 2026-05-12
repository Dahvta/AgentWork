export const ARC_TESTNET = {
  chainId: "0x4cef52",
  chainName: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: ["https://rpc.testnet.arc.network"],
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

type EthereumProvider = {
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
  request<T = unknown>(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<T>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export type WalletState = {
  address: string | null;
  chainId: string | null;
  error: string | null;
};

export async function connectWallet(): Promise<WalletState> {
  const provider = getProvider();
  if (!provider) {
    return { address: null, chainId: null, error: "No EVM wallet found. Install MetaMask, Rabby, or Coinbase Wallet." };
  }

  try {
    const accounts = await provider.request<string[]>({ method: "eth_requestAccounts" });
    await ensureArcTestnet(provider);
    const chainId = await provider.request<string>({ method: "eth_chainId" });
    return { address: accounts[0] ?? null, chainId, error: null };
  } catch (error) {
    console.error("Wallet connection failed", error);
    return {
      address: null,
      chainId: null,
      error: walletErrorMessage(error),
    };
  }
}

export async function getWalletState(): Promise<WalletState> {
  const provider = getProvider();
  if (!provider) return { address: null, chainId: null, error: null };
  const [accounts, chainId] = await Promise.all([
    provider.request<string[]>({ method: "eth_accounts" }),
    provider.request<string>({ method: "eth_chainId" }),
  ]);
  return { address: accounts[0] ?? null, chainId, error: null };
}

export function subscribeWallet(listener: () => void) {
  const provider = getProvider();
  if (!provider?.on) return () => undefined;
  provider.on("accountsChanged", listener);
  provider.on("chainChanged", listener);
  return () => {
    provider.removeListener?.("accountsChanged", listener);
    provider.removeListener?.("chainChanged", listener);
  };
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function ensureArcTestnet(provider: EthereumProvider) {
  const currentChainId = await provider.request<string>({ method: "eth_chainId" });
  if (currentChainId.toLowerCase() === ARC_TESTNET.chainId) return;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_TESTNET.chainId }],
    });
  } catch (error: any) {
    if (!isUnknownChainError(error)) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [ARC_TESTNET],
    });
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_TESTNET.chainId }],
    });
  }
}

export function getProvider() {
  const provider = window.ethereum;
  if (!provider?.providers?.length) return provider;
  return provider.providers.find((candidate) => candidate.isMetaMask) ?? provider.providers[0];
}

function walletErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Wallet connection failed. Check your wallet popup and try again.";
}

function isUnknownChainError(error: any) {
  const message = String(error?.message ?? "").toLowerCase();
  return error?.code === 4902 || message.includes("unrecognized chain") || message.includes("unknown chain");
}
