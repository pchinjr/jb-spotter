import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as sharp from 'sharp';

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME!;
const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';

// Constants
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const MAX_IMAGE_DIMENSION = 4096; // Maximum width/height
const PRESIGNED_URL_EXPIRY = 3600; // 1 hour
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface ProcessImageRequest {
  imageData: string;
}

// Logging utility
function log(level: string, message: string, meta?: any) {
  const logLevels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
  const currentLevel = logLevels.indexOf(LOG_LEVEL);
  const messageLevel = logLevels.indexOf(level);

  if (messageLevel <= currentLevel) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta
    }));
  }
}

function buildResponse(
  statusCode: number,
  body: any,
  additionalHeaders: Record<string, string> = {}
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      ...additionalHeaders
    },
    body: JSON.stringify(body)
  };
}

function validateImageData(imageData: string): { buffer: Buffer; mimeType: string } {
  // Validate data URL format
  if (!imageData || typeof imageData !== 'string') {
    throw new Error('Invalid image data format');
  }

  const dataUrlMatch = imageData.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!dataUrlMatch) {
    throw new Error('Invalid data URL format. Expected: data:image/[type];base64,[data]');
  }

  const [, mimeType, base64Data] = dataUrlMatch;

  // Validate MIME type
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw new Error(`Unsupported image type: ${mimeType}. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`);
  }

  // Decode base64
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Data, 'base64');
  } catch (error) {
    throw new Error('Failed to decode base64 image data');
  }

  // Validate size
  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error(`Image too large: ${(buffer.length / 1024 / 1024).toFixed(2)}MB. Maximum: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
  }

  return { buffer, mimeType };
}

async function validateImageBuffer(buffer: Buffer): Promise<sharp.Metadata> {
  try {
    const metadata = await sharp(buffer).metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Could not determine image dimensions');
    }

    if (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) {
      throw new Error(`Image dimensions too large: ${metadata.width}x${metadata.height}. Maximum: ${MAX_IMAGE_DIMENSION}px`);
    }

    return metadata;
  } catch (error: any) {
    throw new Error(`Invalid image file: ${error.message}`);
  }
}

async function getJeffBarrImage(): Promise<Buffer> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: 'jeff-barr.png'
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error('Jeff Barr image has no content');
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      throw new Error('Jeff Barr image not found. Please upload jeff-barr.png to the S3 bucket.');
    }
    throw new Error(`Failed to retrieve Jeff Barr image: ${error.message}`);
  }
}

async function compositeImages(
  userImageBuffer: Buffer,
  jeffBarrBuffer: Buffer,
  metadata: sharp.Metadata
): Promise<Buffer> {
  const targetWidth = 800;
  const targetHeight = 600;

  // Get Jeff Barr image metadata
  const jeffMetadata = await sharp(jeffBarrBuffer).metadata();

  // Calculate smart positioning - place Jeff in the upper right area
  const jeffWidth = jeffMetadata.width || 300;
  const jeffHeight = jeffMetadata.height || 400;
  const jeffTop = Math.floor(targetHeight * 0.1); // 10% from top
  const jeffLeft = targetWidth - jeffWidth - Math.floor(targetWidth * 0.05); // 5% from right

  log('INFO', 'Compositing images', {
    targetWidth,
    targetHeight,
    jeffPosition: { top: jeffTop, left: jeffLeft, width: jeffWidth, height: jeffHeight },
    userImageSize: { width: metadata.width, height: metadata.height }
  });

  try {
    return await sharp(userImageBuffer)
      .resize(targetWidth, targetHeight, {
        fit: 'cover',
        position: 'center'
      })
      .composite([{
        input: jeffBarrBuffer,
        top: jeffTop,
        left: Math.max(0, jeffLeft), // Ensure we don't go negative
        blend: 'over'
      }])
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch (error: any) {
    throw new Error(`Failed to composite images: ${error.message}`);
  }
}

async function uploadProcessedImage(imageBuffer: Buffer): Promise<string> {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(7);
  const key = `processed/${timestamp}-${randomSuffix}.jpg`;

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
      CacheControl: 'max-age=3600',
      Metadata: {
        'processed-at': new Date().toISOString()
      }
    });

    await s3Client.send(command);

    log('INFO', 'Uploaded processed image', { key, size: imageBuffer.length });

    // Generate presigned URL
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const presignedUrl = await getSignedUrl(s3Client, getCommand, {
      expiresIn: PRESIGNED_URL_EXPIRY
    });

    return presignedUrl;
  } catch (error: any) {
    throw new Error(`Failed to upload processed image: ${error.message}`);
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';

  log('INFO', 'Processing image request', { requestId });

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, {});
  }

  try {
    // Parse request body
    let body: ProcessImageRequest;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (error) {
      log('WARN', 'Invalid JSON in request body', { requestId });
      return buildResponse(400, { error: 'Invalid JSON in request body' });
    }

    const { imageData } = body;

    if (!imageData) {
      log('WARN', 'Missing imageData in request', { requestId });
      return buildResponse(400, {
        error: 'Missing required field: imageData',
        details: 'Please provide image data as a base64-encoded data URL'
      });
    }

    // Validate and decode image data
    log('DEBUG', 'Validating image data', { requestId });
    const { buffer: imageBuffer, mimeType } = validateImageData(imageData);

    // Validate image properties
    const metadata = await validateImageBuffer(imageBuffer);
    log('INFO', 'Image validated', {
      requestId,
      mimeType,
      dimensions: `${metadata.width}x${metadata.height}`,
      size: `${(imageBuffer.length / 1024).toFixed(2)}KB`
    });

    // Get Jeff Barr image
    log('DEBUG', 'Fetching Jeff Barr image', { requestId });
    const jeffBarrBuffer = await getJeffBarrImage();

    // Composite images
    log('DEBUG', 'Compositing images', { requestId });
    const processedImage = await compositeImages(imageBuffer, jeffBarrBuffer, metadata);

    // Upload to S3 and get presigned URL
    log('DEBUG', 'Uploading processed image', { requestId });
    const imageUrl = await uploadProcessedImage(processedImage);

    log('INFO', 'Image processing completed successfully', { requestId });

    return buildResponse(200, {
      imageUrl,
      expiresIn: PRESIGNED_URL_EXPIRY,
      message: 'Image processed successfully'
    });

  } catch (error: any) {
    log('ERROR', 'Image processing failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    // Return appropriate error response
    const statusCode = error.message.includes('too large') ||
                       error.message.includes('Invalid') ||
                       error.message.includes('Unsupported') ? 400 : 500;

    return buildResponse(statusCode, {
      error: error.message || 'Image processing failed',
      requestId
    });
  }
};
