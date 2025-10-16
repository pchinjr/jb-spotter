import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const HTML_CONTENT = `
<!DOCTYPE html>
<html>
<head>
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
            if (file && file.type.startsWith('image/')) {
                selectedFile = file;
                processBtn.disabled = false;
                uploadArea.innerHTML = '<p>✓ Image selected: ' + file.name + '</p>';
            }
        }

        processBtn.addEventListener('click', async () => {
            if (!selectedFile) return;
            
            processBtn.disabled = true;
            processBtn.textContent = 'Processing...';
            result.innerHTML = '<p>Creating your Jeff Barr selfie...</p>';

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const response = await fetch('/process', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageData: e.target.result })
                    });
                    
                    const data = await response.json();
                    
                    if (data.imageUrl) {
                        result.innerHTML = \`
                            <h3>🎉 Your Jeff Barr Selfie is Ready!</h3>
                            <img src="\${data.imageUrl}" alt="Your selfie with Jeff Barr">
                            <p><a href="\${data.imageUrl}" download="jeff-barr-selfie.jpg">Download Image</a></p>
                        \`;
                    } else {
                        result.innerHTML = '<p>❌ Error: ' + (data.error || 'Unknown error') + '</p>';
                    }
                } catch (error) {
                    result.innerHTML = '<p>❌ Error processing image</p>';
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

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html',
      'Access-Control-Allow-Origin': '*'
    },
    body: HTML_CONTENT
  };
};
