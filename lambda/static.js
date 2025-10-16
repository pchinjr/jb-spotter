"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const HTML_CONTENT = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jeff Barr Selfie Spotter</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .upload-area { border: 2px dashed #ccc; padding: 40px; text-align: center; margin: 20px 0; }
        .upload-area.dragover { border-color: #007dbc; background: #f0f8ff; }
        #result { margin-top: 20px; }
        img { max-width: 100%; height: auto; }
        button { background: #ff9900; color: white; border: none; padding: 10px 20px; cursor: pointer; }
        button:disabled { background: #ccc; }
    </style>
</head>
<body>
    <h1>🤳 Jeff Barr Selfie Spotter</h1>
    <p>Upload your selfie and get a photo with Jeff Barr at re:Invent!</p>
    
    <div class="upload-area" id="uploadArea">
        <p>Drop your selfie here or click to select</p>
        <input type="file" id="fileInput" accept="image/*" style="display: none;">
    </div>
    
    <button id="processBtn" disabled>Process Image</button>
    
    <div id="result"></div>

    <script>
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const processBtn = document.getElementById('processBtn');
        const result = document.getElementById('result');
        let selectedFile = null;

        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            handleFile(e.dataTransfer.files[0]);
        });

        fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

        function handleFile(file) {
            if (!file) return;

            // Check if it's an image
            if (!file.type.startsWith('image/')) {
                uploadArea.innerHTML = '<p style="color: red;">❌ Please select an image file</p>';
                selectedFile = null;
                processBtn.disabled = true;
                return;
            }

            // Check file size (API Gateway has 10MB limit, leave buffer for base64 encoding)
            const maxSize = 7 * 1024 * 1024; // 7MB (base64 encoding adds ~33% overhead)
            if (file.size > maxSize) {
                uploadArea.innerHTML = '<p style="color: red;">❌ File too large! Maximum size is 7MB. Please compress your image or choose a smaller one.</p>';
                selectedFile = null;
                processBtn.disabled = true;
                return;
            }

            selectedFile = file;
            processBtn.disabled = false;
            uploadArea.innerHTML = '<p>✓ Image selected: ' + file.name + ' (' + (file.size / 1024 / 1024).toFixed(2) + ' MB)</p>';
        }

        processBtn.addEventListener('click', async () => {
            if (!selectedFile) return;

            processBtn.disabled = true;
            processBtn.textContent = 'Processing...';
            result.innerHTML = '<p>Creating your Jeff Barr selfie...</p>';

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    // Use relative path - 'process' (not '/process') to work with API Gateway stages
                    const response = await fetch('process', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageData: e.target.result })
                    });

                    // Handle HTTP errors
                    if (!response.ok) {
                        if (response.status === 413) {
                            result.innerHTML = '<p style="color: red;">❌ File too large! The image exceeds the 10MB API limit. Please use a smaller image.</p>';
                        } else if (response.status === 400) {
                            const data = await response.json();
                            result.innerHTML = '<p style="color: red;">❌ ' + (data.error || 'Invalid image format') + '</p>';
                        } else {
                            result.innerHTML = '<p style="color: red;">❌ Error: Server returned status ' + response.status + '</p>';
                        }
                        return;
                    }

                    const data = await response.json();

                    if (data.imageUrl) {
                        result.innerHTML = \`
                            <h3>🎉 Your Jeff Barr Selfie is Ready!</h3>
                            <img src="\${data.imageUrl}" alt="Your selfie with Jeff Barr">
                            <p><a href="\${data.imageUrl}" download="jeff-barr-selfie.jpg">Download Image</a></p>
                        \`;
                    } else {
                        result.innerHTML = '<p style="color: red;">❌ Error: ' + (data.error || 'Unknown error') + '</p>';
                    }
                } catch (error) {
                    result.innerHTML = '<p style="color: red;">❌ Network error. Please check your connection and try again.</p>';
                    console.error('Error:', error);
                }
                
                processBtn.disabled = false;
                processBtn.textContent = 'Process Image';
            };
            reader.readAsDataURL(selectedFile);
        });
    </script>
</body>
</html>
`;
const handler = async (event) => {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        },
        body: HTML_CONTENT
    };
};
exports.handler = handler;
