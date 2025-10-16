# Jeff Barr Selfie Spotter 🤳

A web app that superimposes Jeff Barr into your selfies so you can claim you got a photo with him at re:Invent!

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build and deploy:
```bash
./deploy.sh
```

3. Upload Jeff Barr image:
   - Find a good PNG image of Jeff Barr with transparent background
   - Upload it to your S3 bucket as `jeff-barr.png`

## Usage

1. Visit the deployed web app URL
2. Upload your selfie
3. Click "Process Image" 
4. Download your Jeff Barr selfie!

## Architecture

- **Frontend**: Single-page HTML app with drag-and-drop upload
- **Backend**: AWS Lambda functions for image processing
- **Storage**: S3 bucket for images
- **Image Processing**: Sharp library for compositing images

## Requirements

- AWS CLI configured
- SAM CLI installed
- Node.js 18+
