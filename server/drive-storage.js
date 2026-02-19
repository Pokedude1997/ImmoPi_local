/**
 * ImmoPi Manager - Google Drive Document Storage
 * 
 * Uploads and organizes documents in Google Drive by property, year, and category
 * Returns Drive file ID for database reference
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH || './google-credentials.json';
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID;

let driveClient = null;

/**
 * Initialize Google Drive client
 */
function initializeDriveClient() {
  if (driveClient) return driveClient;

  try {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      console.error(`❌ Google credentials not found at: ${CREDENTIALS_PATH}`);
      return null;
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.metadata.readonly',
      ],
    });

    driveClient = google.drive({ version: 'v3', auth });
    console.log('✅ Google Drive storage client initialized');
    return driveClient;
  } catch (error) {
    console.error('❌ Failed to initialize Google Drive client:', error.message);
    return null;
  }
}

/**
 * Find or create a folder in Google Drive
 * @param {string} folderName - Name of the folder
 * @param {string} parentId - Parent folder ID (optional)
 * @returns {Promise<string>} - Folder ID
 */
async function findOrCreateFolder(folderName, parentId = ROOT_FOLDER_ID) {
  const drive = driveClient || initializeDriveClient();
  if (!drive) throw new Error('Drive client not initialized');

  try {
    // Search for existing folder
    const query = [
      `name='${folderName.replace(/'/g, "\\'")}'`,
      `mimeType='application/vnd.google-apps.folder'`,
      parentId ? `'${parentId}' in parents` : undefined,
      'trashed=false',
    ]
      .filter(Boolean)
      .join(' and ');

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id;
    }

    // Create folder if not found
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : [],
    };

    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id',
    });

    console.log(`📁 Created folder: ${folderName} (${folder.data.id})`);
    return folder.data.id;
  } catch (error) {
    console.error(`Failed to find/create folder ${folderName}:`, error.message);
    throw error;
  }
}

/**
 * Build folder structure: Root > PropertyName > Year > Category
 * @param {string} propertyName - Property identifier
 * @param {string} year - Document year (YYYY)
 * @param {string} category - Category name (e.g., "Invoices", "Receipts")
 * @returns {Promise<string>} - Final folder ID
 */
async function buildFolderStructure(propertyName, year, category) {
  try {
    // Level 1: Property folder
    const propertyFolderId = await findOrCreateFolder(propertyName, ROOT_FOLDER_ID);

    // Level 2: Year folder
    const yearFolderId = await findOrCreateFolder(year, propertyFolderId);

    // Level 3: Category folder
    const categoryFolderId = await findOrCreateFolder(category, yearFolderId);

    return categoryFolderId;
  } catch (error) {
    console.error('Failed to build folder structure:', error.message);
    throw error;
  }
}

/**
 * Map document type to folder category name
 */
function getCategoryFolder(documentType) {
  const categoryMap = {
    Invoice: 'Invoices',
    Receipt: 'Receipts',
    Contract: 'Contracts',
    'Utility Bill': 'Utility Bills',
    'Tax Statement': 'Tax Statements',
    Other: 'Other Documents',
  };
  return categoryMap[documentType] || 'Uncategorized';
}

/**
 * Upload document to Google Drive with organized folder structure
 * @param {Object} options - Upload options
 * @param {string} options.filePath - Local file path
 * @param {string} options.originalName - Original filename
 * @param {string} options.mimeType - File MIME type
 * @param {string} options.propertyName - Property identifier
 * @param {string} options.documentType - Document type from AI analysis
 * @param {string} options.documentDate - ISO date string from document
 * @returns {Promise<Object>} - Upload result with fileId and metadata
 */
async function uploadDocument(options) {
  const {
    filePath,
    originalName,
    mimeType,
    propertyName = 'Unassigned',
    documentType = 'Other',
    documentDate,
  } = options;

  console.log(`\n📤 Uploading document: ${originalName}`);

  const drive = driveClient || initializeDriveClient();
  if (!drive) {
    throw new Error('Drive client not initialized');
  }

  if (!ROOT_FOLDER_ID) {
    throw new Error('GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID not configured in .env');
  }

  try {
    // Extract year from document date (fallback to current year)
    const year = documentDate
      ? new Date(documentDate).getFullYear().toString()
      : new Date().getFullYear().toString();

    // Get category folder name
    const category = getCategoryFolder(documentType);

    // Build folder structure
    console.log(`📁 Organizing: ${propertyName}/${year}/${category}`);
    const targetFolderId = await buildFolderStructure(propertyName, year, category);

    // Generate unique filename with timestamp to avoid conflicts
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const uniqueFileName = `${timestamp}_${baseName}${ext}`;

    // Upload file
    const fileMetadata = {
      name: uniqueFileName,
      parents: [targetFolderId],
      description: `Uploaded from ImmoPi Manager - ${documentType}`,
    };

    const media = {
      mimeType: mimeType,
      body: fs.createReadStream(filePath),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, size, createdTime, webViewLink, mimeType',
    });

    console.log('✅ Upload successful');
    console.log(`   File ID: ${response.data.id}`);
    console.log(`   Size: ${(response.data.size / 1024).toFixed(2)} KB`);

    return {
      success: true,
      fileId: response.data.id,
      fileName: response.data.name,
      originalName: originalName,
      size: response.data.size,
      mimeType: response.data.mimeType,
      webViewLink: response.data.webViewLink,
      createdTime: response.data.createdTime,
      folderPath: `${propertyName}/${year}/${category}`,
    };
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    throw error;
  }
}

/**
 * Get document download URL (requires user to be authenticated)
 * @param {string} fileId - Google Drive file ID
 * @returns {string} - Web view link
 */
function getDocumentLink(fileId) {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Delete document from Google Drive
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<boolean>} - Success status
 */
async function deleteDocument(fileId) {
  const drive = driveClient || initializeDriveClient();
  if (!drive) throw new Error('Drive client not initialized');

  try {
    await drive.files.delete({
      fileId: fileId,
    });
    console.log(`🗑️  Deleted document: ${fileId}`);
    return true;
  } catch (error) {
    console.error('Failed to delete document:', error.message);
    return false;
  }
}

module.exports = {
  initializeDriveClient,
  uploadDocument,
  getDocumentLink,
  deleteDocument,
  findOrCreateFolder,
};
