const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>File Compression tool</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        body {
          background-image: url('https://via.placeholder.com/1920x1080');
          background-size: cover;
          background-position: center;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .overlay {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 100%;
          background-color: rgba(0, 0, 0, 0.6);
        }
        .content {
          position: relative;
          z-index: 2;
          color: #fff;
          text-align: center;
          max-width: 500px;
          padding: 30px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 15px;
          box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.3);
        }
        .custom-btn {
          width: 220px;
          height: 60px;
          font-size: 1.2rem;
          border-radius: 30px;
          margin: 10px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
          transition: transform 0.2s;
        }
        .custom-btn:hover {
          transform: translateY(-3px);
        }
      </style>
    </head>
    <body>
      <div class="overlay"></div>
      <div class="content">
        <h1 class="mb-4">File Compression tool</h1>
        <p>Effortlessly compress text files.</p>
        <form id="uploadForm" enctype="multipart/form-data" method="POST" action="/compress">
          <input type="file" name="file" class="form-control" accept=".txt" required>
          <button type="submit" class="btn btn-primary custom-btn mt-4">Compress</button>
        </form>
        <div class="mt-3">
          <p><strong>Original Size:</strong> <span id="originalSize">-</span> bytes</p>
          <p><strong>Compressed Size:</strong> <span id="compressedSize">-</span> bytes</p>
          <p><strong>Compression Percentage:</strong> <span id="compressionPercentage">-</span>%</p>
        </div>
        <p id="downloadLink" class="mt-3"></p>
      </div>
      <script>
        document.getElementById('uploadForm').onsubmit = async function(event) {
          event.preventDefault();
          const formData = new FormData(this);
          const response = await fetch('/compress', {
            method: 'POST',
            body: formData
          });
          if (response.ok) {
            const data = await response.json();
            const blob = new Blob([new Uint8Array(data.compressedData)], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'compressed.huff';
            link.textContent = 'Download Compressed File';
            document.getElementById('downloadLink').appendChild(link);

            document.getElementById('originalSize').textContent = data.originalSize;
            document.getElementById('compressedSize').textContent = data.compressedSize;

            // Directly display the compression percentage
            document.getElementById('compressionPercentage').textContent = data.compressionPercentage;
          } else {
            alert('File compression failed!');
          }
        };
      </script>
    </body>
    </html>
  `);
});

// Huffman Compression Helpers
class HuffmanNode {
  constructor(char, freq, left = null, right = null) {
    this.char = char;
    this.freq = freq;
    this.left = left;
    this.right = right;
  }
}

function buildFrequencyMap(data) {
  const freqMap = {};
  for (let char of data) {
    freqMap[char] = (freqMap[char] || 0) + 1;
  }
  return freqMap;
}

function buildHuffmanTree(freqMap) {
  const nodes = Object.entries(freqMap).map(([char, freq]) => new HuffmanNode(char, freq));
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.freq - b.freq);
    const left = nodes.shift();
    const right = nodes.shift();
    const newNode = new HuffmanNode(null, left.freq + right.freq, left, right);
    nodes.push(newNode);
  }
  return nodes[0];
}

function generateHuffmanCodes(node, code = '', huffmanCodes = {}) {
  if (node.char !== null) {
    huffmanCodes[node.char] = code;

  } else {
    generateHuffmanCodes(node.left, code + '0', huffmanCodes);
    generateHuffmanCodes(node.right, code + '1', huffmanCodes);
  }
  return huffmanCodes;
}

function encodeData(data, huffmanCodes) {
  return data.split('').map(char => huffmanCodes[char]).join('');
}

function binaryStringToBuffer(binaryStr) {
  const buffer = Buffer.alloc(Math.ceil(binaryStr.length / 8));
  for (let i = 0; i < binaryStr.length; i++) {
    if (binaryStr[i] === '1') {
      buffer[Math.floor(i / 8)] |= 1 << (7 - (i % 8));
    }
  }
  return buffer;
}

// Endpoint to upload, compress, and return the file
app.post('/compress', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).send('No file uploaded');

  fs.readFile(file.path, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Error reading file');

    const originalSize = Buffer.byteLength(data, 'utf8');
    const freqMap = buildFrequencyMap(data);
    const huffmanTree = buildHuffmanTree(freqMap);
    const huffmanCodes = generateHuffmanCodes(huffmanTree);
    const encodedData = encodeData(data, huffmanCodes);
    const compressedBuffer = binaryStringToBuffer(encodedData);

    fs.unlink(file.path, unlinkErr => { if (unlinkErr) console.error('Error deleting file:', unlinkErr); });

    const compressedSize = compressedBuffer.length;
    const compressionPercentage = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);

    res.json({
      originalSize,
      compressedSize,
      compressionPercentage, // Sending only the compression percentage
      compressedData: Array.from(compressedBuffer)
    });
  });
});

// Start the server
app.listen(8000, () => console.log('Server running on http://localhost:8000'));
