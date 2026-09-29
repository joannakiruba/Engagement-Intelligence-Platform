import jwt from 'jsonwebtoken';
import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: config.googleDrive.clientEmail,
      scope: 'https://www.googleapis.com/auth/drive.file',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    config.googleDrive.privateKey,
    { algorithm: 'RS256' },
  );

  const response = await axios.post(
    'https://oauth2.googleapis.com/token',
    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  );

  cachedToken = {
    token: response.data.access_token,
    expiresAt: Date.now() + response.data.expires_in * 1000,
  };

  return cachedToken.token;
}

function buildMultipartBody(
  metadata: Record<string, unknown>,
  fileBuffer: Buffer,
  mimeType: string,
): { body: Buffer; contentType: string } {
  const boundary = '----ProofUploadBoundary';
  const metaJson = JSON.stringify(metadata);

  const parts = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n`,
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
  ];

  const body = Buffer.concat([
    Buffer.from(parts[0]),
    Buffer.from(parts[1]),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

function extractDriveFileId(fileUrl: string): string | null {
  const match = fileUrl.match(/\/d\/([^/]+)/);
  return match?.[1] ?? null;
}

export async function uploadFileToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<{ fileId: string; fileUrl: string }> {
  const token = await getAccessToken();

  const { body, contentType } = buildMultipartBody(
    { name: fileName, parents: [config.googleDrive.folderId] },
    fileBuffer,
    mimeType,
  );

  const res = await axios.post(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    body,
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
      maxBodyLength: 20 * 1024 * 1024,
    },
  );

  const fileId: string = res.data.id;
  const fileUrl: string =
    res.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

  await axios.post(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    { role: 'reader', type: 'anyone' },
    { headers: { Authorization: `Bearer ${token}` } },
  );

  logger.info('Uploaded file to Google Drive', { fileId, fileName });
  return { fileId, fileUrl };
}

export async function replaceFileOnDrive(
  existingFileUrl: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<{ fileId: string; fileUrl: string }> {
  const existingId = extractDriveFileId(existingFileUrl);
  if (!existingId) {
    return uploadFileToDrive(fileBuffer, fileName, mimeType);
  }

  const token = await getAccessToken();

  const { body, contentType } = buildMultipartBody(
    { name: fileName },
    fileBuffer,
    mimeType,
  );

  await axios.patch(
    `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`,
    body,
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
      maxBodyLength: 20 * 1024 * 1024,
    },
  );

  logger.info('Replaced file on Google Drive', { fileId: existingId, fileName });
  return { fileId: existingId, fileUrl: existingFileUrl };
}

export async function deleteFileFromDrive(fileUrl: string): Promise<void> {
  const fileId = extractDriveFileId(fileUrl);
  if (!fileId) return;

  try {
    const token = await getAccessToken();
    await axios.delete(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    logger.info('Deleted file from Google Drive', { fileId });
  } catch (err) {
    logger.warn('Failed to delete file from Google Drive', { fileId, error: (err as Error).message });
  }
}
