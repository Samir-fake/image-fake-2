#!/bin/bash

# Image Extractor - Production Startup Script
echo "Starting Image Extractor Production Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js 18+ to continue."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Warning: Node.js version 18+ is recommended. Current version: $(node -v)"
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing production dependencies..."
    npm install --production
fi

# Check for environment file
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found. Using default configuration."
    echo "For production use, please create a .env file based on .env.example"
fi

# Start the application
echo "Starting server..."
node index.js