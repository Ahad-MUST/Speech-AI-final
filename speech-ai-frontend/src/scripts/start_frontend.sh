#!/bin/bash
echo "Starting Speech AI Frontend..."
echo "================================"

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo "Building application..."
npm run build

echo "Starting frontend server..."
echo "Frontend will be available at:"
echo "  Local: http://localhost:3000"
echo "  Network: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "Make sure backend is running on Device B!"
echo "================================"

npm run preview
