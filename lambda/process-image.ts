import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { RekognitionClient, DetectFacesCommand, BoundingBox } from '@aws-sdk/client-rekognition';
import sharp from 'sharp';

const s3Client = new S3Client({});
const rekognitionClient = new RekognitionClient({});
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

async function detectFaces(imageBuffer: Buffer): Promise<BoundingBox[]> {
  try {
    const command = new DetectFacesCommand({
      Image: {
        Bytes: imageBuffer
      },
      Attributes: ['DEFAULT']
    });

    const response = await rekognitionClient.send(command);

    log('INFO', 'Face detection completed', {
      faceCount: response.FaceDetails?.length || 0
    });

    return response.FaceDetails?.map(face => face.BoundingBox!).filter(Boolean) || [];
  } catch (error: any) {
    log('WARN', 'Face detection failed, using default positioning', {
      error: error.message
    });
    return [];
  }
}

interface Position {
  top: number;
  left: number;
}

function calculateSmartPosition(
  faces: BoundingBox[],
  targetWidth: number,
  targetHeight: number,
  jeffWidth: number,
  jeffHeight: number
): Position {
  // If no faces detected, use default upper-right positioning
  if (faces.length === 0) {
    log('INFO', 'No faces detected, using default positioning');
    return {
      top: Math.floor(targetHeight * 0.1),
      left: targetWidth - jeffWidth - Math.floor(targetWidth * 0.05)
    };
  }

  // Convert bounding boxes to pixel coordinates
  const faceRegions = faces.map(box => ({
    left: (box.Left || 0) * targetWidth,
    top: (box.Top || 0) * targetHeight,
    width: (box.Width || 0) * targetWidth,
    height: (box.Height || 0) * targetHeight
  }));

  log('INFO', 'Calculating smart position', {
    faceCount: faces.length,
    faceRegions
  });

  // Define candidate positions (corners and edges)
  const candidates: Position[] = [
    // Top-right corner
    { top: Math.floor(targetHeight * 0.05), left: targetWidth - jeffWidth - Math.floor(targetWidth * 0.05) },
    // Top-left corner
    { top: Math.floor(targetHeight * 0.05), left: Math.floor(targetWidth * 0.05) },
    // Bottom-right corner
    { top: targetHeight - jeffHeight - Math.floor(targetHeight * 0.05), left: targetWidth - jeffWidth - Math.floor(targetWidth * 0.05) },
    // Bottom-left corner
    { top: targetHeight - jeffHeight - Math.floor(targetHeight * 0.05), left: Math.floor(targetWidth * 0.05) },
    // Right edge, middle
    { top: Math.floor((targetHeight - jeffHeight) / 2), left: targetWidth - jeffWidth - Math.floor(targetWidth * 0.05) },
    // Left edge, middle
    { top: Math.floor((targetHeight - jeffHeight) / 2), left: Math.floor(targetWidth * 0.05) }
  ];

  // Score each candidate position (higher score = less overlap with faces)
  const scores = candidates.map(pos => {
    let score = 1000; // Start with high max score

    // Calculate Jeff's bounding box
    const jeffBox = {
      left: pos.left,
      top: pos.top,
      right: pos.left + jeffWidth,
      bottom: pos.top + jeffHeight
    };

    // Penalize overlap with faces (VERY heavily)
    let hasOverlap = false;
    for (const face of faceRegions) {
      // Add padding around faces to create a "no-go zone"
      const facePadding = Math.max(face.width * 0.2, face.height * 0.2);
      const faceBox = {
        left: face.left - facePadding,
        top: face.top - facePadding,
        right: face.left + face.width + facePadding,
        bottom: face.top + face.height + facePadding
      };

      // Check for overlap
      const overlapLeft = Math.max(jeffBox.left, faceBox.left);
      const overlapTop = Math.max(jeffBox.top, faceBox.top);
      const overlapRight = Math.min(jeffBox.right, faceBox.right);
      const overlapBottom = Math.min(jeffBox.bottom, faceBox.bottom);

      if (overlapLeft < overlapRight && overlapTop < overlapBottom) {
        const overlapArea = (overlapRight - overlapLeft) * (overlapBottom - overlapTop);
        const jeffArea = jeffWidth * jeffHeight;
        const overlapPercentage = (overlapArea / jeffArea) * 100;

        // VERY heavy penalty for overlapping faces (essentially eliminates this position)
        score -= overlapPercentage * 50;
        hasOverlap = true;
      }
    }

    // Only consider distance bonus if there's no overlap
    if (!hasOverlap) {
      // Slight preference for positions near faces (creates photobomb effect)
      // but not too close
      for (const face of faceRegions) {
        const faceCenter = {
          x: face.left + face.width / 2,
          y: face.top + face.height / 2
        };

        const jeffCenter = {
          x: pos.left + jeffWidth / 2,
          y: pos.top + jeffHeight / 2
        };

        const distance = Math.sqrt(
          Math.pow(faceCenter.x - jeffCenter.x, 2) +
          Math.pow(faceCenter.y - jeffCenter.y, 2)
        );

        // Prefer positions that are reasonably close to faces but not overlapping
        const minPreferredDistance = Math.max(face.width, face.height) * 1.5;
        const maxPreferredDistance = targetWidth * 0.5;

        if (distance >= minPreferredDistance && distance <= maxPreferredDistance) {
          // Give bonus for being in the "sweet spot"
          const normalizedDistance = (distance - minPreferredDistance) / (maxPreferredDistance - minPreferredDistance);
          score += (1 - Math.abs(normalizedDistance - 0.5) * 2) * 50;
        }
      }
    }

    return { position: pos, score };
  });

  // Find the best position
  const best = scores.reduce((prev, current) =>
    current.score > prev.score ? current : prev
  );

  log('INFO', 'Smart position calculated', {
    selectedPosition: best.position,
    score: best.score,
    allScores: scores.map(s => ({ pos: s.position, score: s.score }))
  });

  return best.position;
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
  metadata: sharp.Metadata,
  faces: BoundingBox[]
): Promise<Buffer> {
  // First, auto-rotate the image based on EXIF to get correct orientation
  const rotatedImage = await sharp(userImageBuffer)
    .rotate() // Auto-rotate based on EXIF orientation
    .toBuffer();

  // Get metadata AFTER rotation to get the correct dimensions
  const rotatedMetadata = await sharp(rotatedImage).metadata();
  const originalWidth = rotatedMetadata.width || metadata.width || 800;
  const originalHeight = rotatedMetadata.height || metadata.height || 600;
  const aspectRatio = originalWidth / originalHeight;

  // Now calculate target dimensions based on the ROTATED dimensions
  const maxDimension = 1200;
  let targetWidth: number;
  let targetHeight: number;

  if (originalWidth > originalHeight) {
    // Landscape or square
    targetWidth = Math.min(maxDimension, originalWidth);
    targetHeight = Math.round(targetWidth / aspectRatio);
  } else {
    // Portrait
    targetHeight = Math.min(maxDimension, originalHeight);
    targetWidth = Math.round(targetHeight * aspectRatio);
  }

  log('INFO', 'Image dimensions calculated', {
    original: { width: originalWidth, height: originalHeight },
    target: { width: targetWidth, height: targetHeight },
    aspectRatio,
    isPortrait: originalHeight > originalWidth
  });

  // Resize the rotated image
  const resizedUserImage = await sharp(rotatedImage)
    .resize(targetWidth, targetHeight, {
      fit: 'inside', // Preserve aspect ratio
      withoutEnlargement: true
    })
    .toBuffer();

  // Get actual dimensions after resize
  const resizedMetadata = await sharp(resizedUserImage).metadata();
  const finalWidth = resizedMetadata.width || targetWidth;
  const finalHeight = resizedMetadata.height || targetHeight;

  // Get Jeff Barr image metadata and scale it appropriately
  const jeffMetadata = await sharp(jeffBarrBuffer).metadata();
  const originalJeffWidth = jeffMetadata.width || 300;
  const originalJeffHeight = jeffMetadata.height || 400;

  // Scale Jeff aggressively so he’s prominent in the shot (>40% width when possible)
  const jeffScale = Math.min(
    (finalWidth * 0.45) / originalJeffWidth,
    (finalHeight * 0.65) / originalJeffHeight
  );

  const jeffWidth = Math.round(originalJeffWidth * jeffScale);
  const jeffHeight = Math.round(originalJeffHeight * jeffScale);

  // Resize Jeff's image
  const resizedJeffBuffer = await sharp(jeffBarrBuffer)
    .resize(jeffWidth, jeffHeight, {
      fit: 'inside'
    })
    .toBuffer();

  // Calculate smart positioning based on detected faces
  const position = calculateSmartPosition(
    faces,
    finalWidth,
    finalHeight,
    jeffWidth,
    jeffHeight
  );

  log('INFO', 'Compositing images', {
    finalDimensions: { width: finalWidth, height: finalHeight },
    jeffDimensions: { width: jeffWidth, height: jeffHeight },
    jeffPosition: { top: position.top, left: position.left },
    userImageSize: { width: metadata.width, height: metadata.height },
    faceCount: faces.length
  });

  try {
    return await sharp(resizedUserImage)
      .composite([{
        input: resizedJeffBuffer,
        top: Math.floor(position.top),
        left: Math.max(0, Math.floor(position.left)), // Ensure we don't go negative
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

    // Detect faces in the user's image
    log('DEBUG', 'Detecting faces', { requestId });
    const faces = await detectFaces(imageBuffer);

    // Get Jeff Barr image
    log('DEBUG', 'Fetching Jeff Barr image', { requestId });
    const jeffBarrBuffer = await getJeffBarrImage();

    // Composite images with smart positioning
    log('DEBUG', 'Compositing images', { requestId });
    const processedImage = await compositeImages(imageBuffer, jeffBarrBuffer, metadata, faces);

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
