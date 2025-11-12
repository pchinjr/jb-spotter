"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const GITHUB_REPO_URL = 'https://github.com/pchinjr/jb-spotter';
const HOME_PAGE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Was that Jeff Barr?</title>
    <style>
        :root {
            --invent-blue: #00b2ff;
            --invent-purple: #7c3aed;
            --invent-orange: #ff9900;
            --card-bg: rgba(11, 16, 31, 0.8);
            --text-body: #e8f2ff;
            --text-muted: #a3b6d6;
            --border-color: rgba(255, 255, 255, 0.15);
            --shadow-soft: 0 10px 30px rgba(5, 6, 33, 0.45);
        }
        * {
            box-sizing: border-box;
        }
        body {
            margin: 0;
            min-height: 100vh;
            font-family: 'Amazon Ember', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: radial-gradient(circle at top, #081229, #040611 70%);
            color: var(--text-body);
            padding: 24px 12px 56px;
            display: flex;
            justify-content: center;
        }
        main {
            width: 100%;
            max-width: 900px;
            position: relative;
        }
        .bg-rings {
            position: fixed;
            inset: 0;
            overflow: hidden;
            pointer-events: none;
        }
        .bg-rings span {
            position: absolute;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 50%;
            animation: pulse 12s linear infinite;
        }
        .bg-rings .ring-one { width: 420px; height: 420px; top: -120px; left: -40px; }
        .bg-rings .ring-two { width: 560px; height: 560px; bottom: -260px; right: -120px; animation-delay: 2s; }
        .bg-rings .ring-three { width: 320px; height: 320px; bottom: -120px; left: 10%; animation-delay: 4s; }

        .hero {
            text-align: center;
            margin-bottom: 24px;
            padding-top: 4px;
        }
        .hero .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            border-radius: 999px;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            background: rgba(0, 178, 255, 0.1);
            color: var(--invent-blue);
            border: 1px solid rgba(0, 178, 255, 0.3);
        }
        h1 {
            font-size: clamp(1.9rem, 5vw, 2.6rem);
            margin: 12px 0 8px;
            font-weight: 700;
        }
        .hero p {
            margin: 0 auto;
            max-width: 520px;
            color: var(--text-muted);
            font-size: 0.95rem;
        }
        .card {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 22px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: var(--shadow-soft);
            backdrop-filter: blur(24px);
        }
        .upload-card {
            position: relative;
            overflow: hidden;
        }
        .upload-card::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(120deg, rgba(0, 178, 255, 0.15), rgba(124, 58, 237, 0.12));
            opacity: 0;
            transition: opacity 0.4s ease;
            pointer-events: none;
        }
        .upload-card.active::after {
            opacity: 1;
        }
        .upload-area {
            border: 2px dashed rgba(255, 255, 255, 0.2);
            border-radius: 20px;
            text-align: center;
            padding: 26px 16px;
            transition: border-color 0.3s ease, background 0.3s ease, transform 0.3s ease;
            cursor: pointer;
        }
        .upload-area.dragover {
            border-color: var(--invent-blue);
            background: rgba(0, 178, 255, 0.08);
            transform: translateY(-2px);
        }
        .upload-area p {
            margin: 12px 0 0;
            color: var(--text-muted);
            font-size: 0.95rem;
        }
        .upload-icon {
            width: 56px;
            height: 56px;
            margin: 0 auto 8px;
            border-radius: 16px;
            background: rgba(255, 255, 255, 0.08);
            display: grid;
            place-items: center;
            font-size: 1.5rem;
        }
        .cta {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 18px;
        }
        button {
            border: none;
            border-radius: 16px;
            padding: 16px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            background: linear-gradient(120deg, var(--invent-orange), #ffb347);
            color: #1a0f00;
            transition: opacity 0.25s ease, transform 0.2s ease;
        }
        button:hover:not(:disabled) {
            transform: translateY(-1px);
        }
        button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }
        .helper-text {
            font-size: 0.85rem;
            color: var(--text-muted);
            text-align: center;
        }
        .tips {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        .tip {
            flex: 1 1 140px;
            min-width: 140px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 14px;
            padding: 12px 14px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .tip strong {
            font-size: 0.9rem;
        }
        #result {
            min-height: 120px;
        }
        #result img {
            margin-top: 16px;
            border-radius: 18px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 20px 45px rgba(5, 6, 33, 0.65);
            max-width: 100%;
            height: auto;
        }
        #result a {
            color: var(--invent-orange);
            font-weight: 600;
        }
        .status {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 14px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.08);
            font-size: 0.88rem;
        }
        .status span {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: var(--invent-orange);
            box-shadow: 0 0 12px var(--invent-orange);
        }
        .result-card.ready #result {
            animation: pop 0.45s ease;
        }
        footer {
            text-align: center;
            margin-top: 20px;
            color: var(--text-muted);
            font-size: 0.8rem;
        }
        footer a {
            color: var(--invent-blue);
            text-decoration: none;
            font-weight: 600;
        }
        footer a:hover {
            color: var(--invent-orange);
        }
        @keyframes pulse {
            0% { transform: scale(1); opacity: 0.6; }
            50% { opacity: 0.1; }
            100% { transform: scale(1.15); opacity: 0.6; }
        }
        @keyframes pop {
            0% { transform: scale(0.96); opacity: 0.5; }
            100% { transform: scale(1); opacity: 1; }
        }
        @media (min-width: 768px) {
            .cta {
                flex-direction: row;
                align-items: center;
            }
            button {
                flex: 1;
            }
            .helper-text {
                flex: 1;
                text-align: left;
            }
        }
    </style>
</head>
<body>
    <div class="bg-rings" aria-hidden="true">
        <span class="ring ring-one"></span>
        <span class="ring ring-two"></span>
        <span class="ring ring-three"></span>
    </div>
    <main>
        <section class="hero">
            <p class="badge">AWS re:Invent 2025</p>
            <h1>Was that Jeff Barr?</h1>
            <p>Upload a selfie and we'll find Jeff for you, perfect for busy re:Inventers.</p>
        </section>

        <section class="card upload-card">
            <div class="upload-area" id="uploadArea">
                <div class="upload-icon">📸</div>
                <h2>Tap to add your photo</h2>
                <p>PNG or JPEG · under 7 MB</p>
                <input type="file" id="fileInput" accept="image/*" style="display: none;">
            </div>
            <div class="cta">
                <button id="processBtn" disabled>Find Jeff</button>
            </div>
        </section>
        <section class="card result-card" id="resultCard">
            <div class="status">
                <span></span>
                <strong>Final Output</strong>
            </div>
            <div id="result" role="status" aria-live="polite">
                <p>Waiting for upload...</p>
            </div>
        </section>

        <footer>
            <p>Praise Cage! · <a href="__ABOUT_URL__">About this project</a></p>
        </footer>
    </main>

    <script>
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const processBtn = document.getElementById('processBtn');
        const result = document.getElementById('result');
        const resultCard = document.getElementById('resultCard');
        const uploadCard = document.querySelector('.upload-card');
        let selectedFile = null;

        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
            uploadCard?.classList.add('active');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
            uploadCard?.classList.remove('active');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            uploadCard?.classList.remove('active');
            handleFile(e.dataTransfer.files[0]);
        });

        fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

        function handleFile(file) {
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                uploadArea.innerHTML = '<p style="color: #ff9b9b;">❌ Please select an image file</p>';
                selectedFile = null;
                processBtn.disabled = true;
                return;
            }

            const maxSize = 7 * 1024 * 1024;
            if (file.size > maxSize) {
                uploadArea.innerHTML = '<p style="color: #ff9b9b;">❌ File too large! Maximum size is 7MB. Please compress your image or choose a smaller one.</p>';
                selectedFile = null;
                processBtn.disabled = true;
                return;
            }

            selectedFile = file;
            processBtn.disabled = false;
            uploadArea.innerHTML = '<div class="upload-icon">✅</div><h2>Ready to process</h2><p>' + file.name + ' · ' + (file.size / 1024 / 1024).toFixed(2) + ' MB</p>';
        }

        processBtn.addEventListener('click', async () => {
            if (!selectedFile) return;

            processBtn.disabled = true;
            processBtn.textContent = 'Processing...';
            resultCard?.classList.remove('ready');
            result.innerHTML = '<p>Looking for Jeff ...</p>';
            result.scrollIntoView({ behavior: 'smooth', block: 'start' });

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const response = await fetch('process', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageData: e.target.result })
                    });

                    if (!response.ok) {
                        if (response.status === 413) {
                            result.innerHTML = '<p style="color: #ff9b9b;">❌ File too large! The image exceeds the 10MB API limit. Please use a smaller image.</p>';
                        } else if (response.status === 400) {
                            const data = await response.json();
                            result.innerHTML = '<p style="color: #ff9b9b;">❌ ' + (data.error || 'Invalid image format') + '</p>';
                        } else {
                            result.innerHTML = '<p style="color: #ff9b9b;">❌ Error: Server returned status ' + response.status + '</p>';
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
                        resultCard?.classList.add('ready');
                        result.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } else {
                        result.innerHTML = '<p style="color: #ff9b9b;">❌ Error: ' + (data.error || 'Unknown error') + '</p>';
                    }
                } catch (error) {
                    result.innerHTML = '<p style="color: #ff9b9b;">❌ Network error. Please check your connection and try again.</p>';
                    console.error('Error:', error);
                }

                processBtn.disabled = false;
                processBtn.textContent = 'Look for Jeff ...';
            };
            reader.readAsDataURL(selectedFile);
        });
    </script>
</body>
</html>
`;
const ABOUT_PAGE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>About Jeff Barr Spotter</title>
    <style>
        :root {
            --invent-blue: #00b2ff;
            --invent-purple: #7c3aed;
            --invent-orange: #ff9900;
            --card-bg: rgba(11, 16, 31, 0.85);
            --text-body: #e8f2ff;
            --text-muted: #a3b6d6;
            --border-color: rgba(255, 255, 255, 0.15);
            --shadow-soft: 0 10px 30px rgba(5, 6, 33, 0.45);
        }
        * {
            box-sizing: border-box;
        }
        body {
            margin: 0;
            min-height: 100vh;
            font-family: 'Amazon Ember', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: radial-gradient(circle at top, #081229, #040611 70%);
            color: var(--text-body);
            padding: 24px 12px 56px;
            display: flex;
            justify-content: center;
        }
        main {
            width: 100%;
            max-width: 900px;
            position: relative;
        }
        .bg-rings {
            position: fixed;
            inset: 0;
            overflow: hidden;
            pointer-events: none;
        }
        .bg-rings span {
            position: absolute;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 50%;
            animation: pulse 12s linear infinite;
        }
        .bg-rings .ring-one { width: 420px; height: 420px; top: -120px; left: -40px; }
        .bg-rings .ring-two { width: 560px; height: 560px; bottom: -260px; right: -120px; animation-delay: 2s; }
        .bg-rings .ring-three { width: 320px; height: 320px; bottom: -120px; left: 10%; animation-delay: 4s; }
        .hero {
            text-align: center;
            margin-bottom: 24px;
            padding-top: 4px;
        }
        .hero .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            border-radius: 999px;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            background: rgba(0, 178, 255, 0.1);
            color: var(--invent-blue);
            border: 1px solid rgba(0, 178, 255, 0.3);
        }
        .card {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 22px;
            padding: 22px;
            margin-bottom: 20px;
            box-shadow: var(--shadow-soft);
            backdrop-filter: blur(24px);
        }
        .card h2 {
            margin-top: 0;
        }
        p {
            color: var(--text-muted);
        }
        .stack {
            list-style: none;
            padding: 0;
            margin: 0;
            display: grid;
            gap: 12px;
        }
        .stack li {
            padding: 14px;
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.02);
        }
        .stack strong {
            color: var(--text-body);
        }
        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
        }
        .actions a {
            flex: 1 1 200px;
            text-align: center;
            border-radius: 16px;
            padding: 14px;
            font-weight: 600;
            text-decoration: none;
            border: 1px solid transparent;
            transition: transform 0.2s ease, opacity 0.2s ease;
        }
        .actions a.primary {
            background: linear-gradient(120deg, var(--invent-orange), #ffb347);
            color: #1a0f00;
        }
        .actions a.secondary {
            border-color: rgba(255, 255, 255, 0.2);
            color: var(--invent-blue);
        }
        .actions a:hover {
            transform: translateY(-1px);
        }
        footer {
            text-align: center;
            margin-top: 20px;
            color: var(--text-muted);
            font-size: 0.85rem;
        }
        footer a {
            color: var(--invent-blue);
            text-decoration: none;
            font-weight: 600;
        }
        footer a:hover {
            color: var(--invent-orange);
        }
        @keyframes pulse {
            0% { transform: scale(1); opacity: 0.6; }
            50% { opacity: 0.1; }
            100% { transform: scale(1.15); opacity: 0.6; }
        }
    </style>
</head>
<body>
    <div class="bg-rings" aria-hidden="true">
        <span class="ring ring-one"></span>
        <span class="ring ring-two"></span>
        <span class="ring ring-three"></span>
    </div>
    <main>
        <section class="hero">
            <p class="badge">Behind the scenes</p>
            <h1>About Jeff Barr Spotter</h1>
            <p>One Lambda serves the interface, another composites Jeff into your photo, and a handful of AWS services keep it reliable.</p>
        </section>

        <section class="card">
            <h2>Architecture at a glance</h2>
            <p>The <code>/process</code> route accepts a base64 image, detects faces with Rekognition, glues Jeff in with Sharp, and streams the finished selfie back via a presigned S3 URL.</p>
            <ul class="stack">
                <li><strong>AWS Lambda</strong> — <code>ProcessImageFunction</code> validates uploads, runs Sharp, and overlays the transparent Jeff asset.</li>
                <li><strong>Amazon S3</strong> — Stores the overlay plus final selfies; presigned URLs give short-lived download links.</li>
                <li><strong>Amazon Rekognition</strong> — Detects faces so Jeff lands where he won’t cover attendees.</li>
                <li><strong>Amazon API Gateway</strong> — Serves both the static shell (<code>/</code>) and the upload API (<code>/process</code>).</li>
                <li><strong>AWS SAM & CloudFormation</strong> — <code>template.yaml</code> defines IAM, buckets, and functions; <code>deploy.sh</code> wraps <code>sam build && sam deploy</code>.</li>
            </ul>
        </section>

        <section class="card">
            <h2>Build & deploy flow</h2>
            <p>Run <code>npm run build</code> to compile the TypeScript in <code>lambda/</code> into <code>src/</code>, then ship it with SAM. Local testing uses <code>sam local start-api</code> with <code>BUCKET_NAME</code> exported so Sharp can load the Jeff overlay.</p>
        </section>

        <section class="card">
            <h2>Explore the code</h2>
            <p>The full source, issues, and deployment history live on GitHub.</p>
            <div class="actions">
                <a class="primary" href="__HOME_URL__">Back to the uploader</a>
                <a class="secondary" href="${GITHUB_REPO_URL}" target="_blank" rel="noopener noreferrer">View the repository</a>
            </div>
        </section>

        <footer>
            Built with 🧡 for Jeff Barr fans. <a href="__HOME_URL__">Return home</a>
        </footer>
    </main>
</body>
</html>
`;
function buildInternalUrl(basePath, targetPath) {
    const normalizedTarget = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
    if (!basePath) {
        return normalizedTarget === '/' ? '/' : normalizedTarget;
    }
    if (normalizedTarget === '/') {
        return `${basePath}/`;
    }
    return `${basePath}${normalizedTarget}`;
}
function getRequestHost(event) {
    const headers = event.headers || {};
    return headers.Host || headers.host || event.requestContext?.domainName;
}
function isDefaultExecuteApiHost(host) {
    return !!host && /\.execute-api\.[^.]+\.amazonaws\.com$/i.test(host);
}
function getBasePath(event) {
    const stage = event.requestContext?.stage;
    if (!stage) {
        return '';
    }
    const host = getRequestHost(event);
    return isDefaultExecuteApiHost(host) ? `/${stage}` : '';
}
function renderHomePage(basePath) {
    const aboutUrl = buildInternalUrl(basePath, '/about');
    return HOME_PAGE_HTML.replace(/__ABOUT_URL__/g, aboutUrl);
}
function renderAboutPage(basePath) {
    const homeUrl = buildInternalUrl(basePath, '/');
    return ABOUT_PAGE_HTML.replace(/__HOME_URL__/g, homeUrl);
}
function resolvePath(event) {
    if (event.pathParameters?.proxy) {
        const proxyPath = `/${event.pathParameters.proxy}`.replace(/\/+$/, '');
        return proxyPath === '' ? '/' : proxyPath.toLowerCase();
    }
    let rawPath = event.path ?? '/';
    const stage = event.requestContext?.stage;
    if (stage && rawPath.startsWith(`/${stage}`)) {
        rawPath = rawPath.slice(stage.length + 1);
        if (!rawPath.startsWith('/')) {
            rawPath = `/${rawPath}`;
        }
    }
    const sanitized = rawPath.replace(/\/+$/, '');
    return (sanitized === '' ? '/' : sanitized).toLowerCase();
}
const handler = async (event) => {
    const basePath = getBasePath(event);
    const path = resolvePath(event);
    const pageContent = path === '/about'
        ? renderAboutPage(basePath)
        : renderHomePage(basePath);
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        },
        body: pageContent
    };
};
exports.handler = handler;
