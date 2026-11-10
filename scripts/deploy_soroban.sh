#!/usr/bin/env bash
set -euo pipefail

# HESABU Stellar Soroban Deployment Automation Script
# Deploys hesabu_anchor.wasm and hesabu_escrow.wasm to Stellar Network

NETWORK="${STELLAR_NETWORK:-testnet}"
RPC_URL="${SOROBAN_RPC_URL:-https://soroban-testnet.stellar.org}"
SOURCE_ACCOUNT="${STELLAR_ADMIN_SECRET:-}"

echo "[HESABU] Target Network: ${NETWORK}"
echo "[HESABU] RPC Endpoint:  ${RPC_URL}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
WASM_DIR="${ROOT_DIR}/contracts/soroban/target/wasm32-unknown-unknown/release"

ANCHOR_WASM="${WASM_DIR}/hesabu_anchor.wasm"
ESCROW_WASM="${WASM_DIR}/hesabu_escrow.wasm"

if [[ ! -f "${ANCHOR_WASM}" ]] || [[ ! -f "${ESCROW_WASM}" ]]; then
  echo "[HESABU] Building Soroban WASM artifacts..."
  (cd "${ROOT_DIR}/contracts/soroban" && cargo build --target wasm32-unknown-unknown --release)
fi

echo "[HESABU] Computing SHA-256 bytecode hashes:"
ANCHOR_HASH=$(sha256sum "${ANCHOR_WASM}" | awk '{print $1}')
ESCROW_HASH=$(sha256sum "${ESCROW_WASM}" | awk '{print $1}')

echo "  hesabu_anchor.wasm: ${ANCHOR_HASH}"
echo "  hesabu_escrow.wasm: ${ESCROW_HASH}"

OUTPUT_MANIFEST="${ROOT_DIR}/contracts/soroban/deployment-manifest.json"

cat <<EOF > "${OUTPUT_MANIFEST}"
{
  "network": "${NETWORK}",
  "rpcUrl": "${RPC_URL}",
  "compiledAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "contracts": {
    "hesabu_anchor": {
      "wasmPath": "${ANCHOR_WASM}",
      "sha256": "${ANCHOR_HASH}",
      "status": "COMPILED"
    },
    "hesabu_escrow": {
      "wasmPath": "${ESCROW_WASM}",
      "sha256": "${ESCROW_HASH}",
      "status": "COMPILED"
    }
  }
}
EOF

echo "[HESABU] Deployment manifest generated at: ${OUTPUT_MANIFEST}"
echo "[HESABU] Soroban bytecode ready for network deployment."
