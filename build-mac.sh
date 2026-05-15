#!/usr/bin/env bash
set -e

echo ""
echo "=========================================="
echo "  Notara - Building Mac App"
echo "=========================================="
echo ""

cd "$(dirname "$0")"
echo "  Working folder: $(pwd)"
echo ""

if ! command -v node &> /dev/null; then
    echo "Node.js not installed. Install from https://nodejs.org (LTS)"
    echo "Or: brew install node"
    exit 1
fi
echo "  Node.js: $(node -v)"
echo ""

echo "[1/3] Installing dependencies..."
npm install --legacy-peer-deps
echo ""

echo "[2/3] Compiling Notara..."
npm run build
echo ""

echo "[3/3] Packaging .dmg..."
npx electron-forge make --platform darwin --arch universal
echo ""

echo "=========================================="
echo "  Build complete!"
echo "=========================================="
echo "  Files in out/make:"
echo "    Notara.dmg  - drag to Applications"
echo ""
open out 2>/dev/null || true
