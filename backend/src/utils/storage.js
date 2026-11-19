/**
 * storage.js
 * ----------
 * Saves uploaded files (company logo) and returns a URL to show them.
 *
 *   S3_BUCKET set   -> upload to AWS S3 (or MinIO when S3_ENDPOINT is set)
 *   S3_BUCKET empty -> save to backend/uploads/ and serve via /uploads/...
 *
 * The rest of the app only calls saveFile(), so switching between local
 * and S3 needs no code change - only environment variables.
 */
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/env');

const LOCAL_DIR = path.join(__dirname, '..', '..', 'uploads');

let s3Client = null;
function getS3() {
  if (!s3Client) {
    const { S3Client } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({
      region: config.s3.region,
      // For MinIO we need a custom endpoint and path-style URLs (http://host/bucket/key)
      ...(config.s3.endpoint ? { endpoint: config.s3.endpoint, forcePathStyle: true } : {}),
      // Credentials come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY or the IAM role.
    });
  }
  return s3Client;
}

/**
 * @param {Buffer} buffer       file contents
 * @param {string} originalName used only to keep the extension (.png)
 * @param {string} mimeType     e.g. 'image/png'
 * @param {string} folder       e.g. 'logos'
 * @returns {Promise<string>}   public URL of the file
 */
async function saveFile(buffer, originalName, mimeType, folder) {
  const ext = path.extname(originalName).toLowerCase() || '.bin';
  const key = `${folder}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`; // unique name

  if (config.s3.bucket) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await getS3().send(new PutObjectCommand({
      Bucket: config.s3.bucket, Key: key, Body: buffer, ContentType: mimeType,
    }));
    const base = config.s3.publicUrl || `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com`;
    return `${base}/${key}`;
  }

  // Local disk fallback
  const fullPath = path.join(LOCAL_DIR, key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
  return `/uploads/${key}`;
}

module.exports = { saveFile, LOCAL_DIR };
