const sharp = require('sharp');
const fs = require('fs');

async function formatJeffImage(inputPath, outputPath = 'jeff-barr.png') {
  try {
    await sharp(inputPath)
      .resize(300, 400, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outputPath);
    
    console.log(`✅ Jeff Barr image formatted and saved as ${outputPath}`);
  } catch (error) {
    console.error('❌ Error processing image:', error.message);
  }
}

// Usage: node format-jeff-image.js <input-image-path>
const inputPath = process.argv[2];
if (!inputPath) {
  console.log('Usage: node format-jeff-image.js <input-image-path>');
  process.exit(1);
}

if (!fs.existsSync(inputPath)) {
  console.error('❌ Input file does not exist:', inputPath);
  process.exit(1);
}

formatJeffImage(inputPath);
