/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
  readonly VITE_CERTIFICATE_REGISTRY_ADDRESS: string;
  readonly VITE_INSTITUTION_REGISTRY_ADDRESS: string;
  readonly VITE_CHAIN_ID: string;
  readonly VITE_SUBGRAPH_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
