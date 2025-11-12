#!/bin/bash

echo "Cleaning previous builds..."
npm run clean

echo "Building TypeScript..."
npm run build

echo "Building SAM application..."
sam build

echo "Deploying to AWS..."
sam deploy

echo "Don't forget to upload jeff-barr.png to your S3 bucket!"
