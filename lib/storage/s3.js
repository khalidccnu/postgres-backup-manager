import AWS from "aws-sdk";
import fs from "fs/promises";
import path from "path";
import { listLocalBackups } from "../backup.js";
import { getBackupConfig, getS3Config } from "../config.js";
import logger from "../logger.js";

let s3Client = null;
let lastConfig = null;

/**
 * Initialize S3 client
 * Re-creates client if configuration changes
 */
function getS3Client() {
  const config = getS3Config();

  // Create a config signature to detect changes
  const configSignature = JSON.stringify({
    accessKeyId: config.accessKeyId,
    region: config.region,
    endpoint: config.endpoint,
    s3ForcePathStyle: config.s3ForcePathStyle,
  });

  // Re-create client if config changed or doesn't exist
  if (!s3Client || lastConfig !== configSignature) {
    const s3Options = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
    };

    // Support for S3-compatible services (Supabase, MinIO, etc.)
    if (config.endpoint) {
      s3Options.endpoint = config.endpoint;
    }

    if (config.s3ForcePathStyle) {
      s3Options.s3ForcePathStyle = true;
    }

    s3Client = new AWS.S3(s3Options);
    lastConfig = configSignature;
  }

  return s3Client;
}

/**
 * Check if S3 is configured
 */
export function isS3Configured() {
  const config = getS3Config();
  return !!(config.accessKeyId && config.secretAccessKey && config.bucket);
}

/**
 * Upload backup to S3
 */
export async function uploadToS3(filepath, filename) {
  if (!isS3Configured()) {
    throw new Error("S3 is not configured");
  }

  const s3 = getS3Client();
  const config = getS3Config();

  const fileContent = await fs.readFile(filepath);

  // Build the S3 key with prefix if provided
  const prefix = config.prefix ? config.prefix.replace(/\/$/, "") + "/" : "";
  const key = prefix + filename;

  const params = {
    Bucket: config.bucket,
    Key: key,
    Body: fileContent,
    ContentType: "application/sql",
  };

  try {
    await s3.upload(params).promise();
    return true;
  } catch (error) {
    throw new Error(`S3 upload failed: ${error.message}`);
  }
}

/**
 * List backups from S3
 */
export async function listS3Backups() {
  if (!isS3Configured()) {
    return [];
  }

  const s3 = getS3Client();
  const config = getS3Config();

  try {
    // Use prefix from config if provided, otherwise default to "backup_"
    const prefix = config.prefix ? config.prefix.replace(/\/$/, "") + "/" : "";
    const searchPrefix = prefix + "backup_";

    const params = {
      Bucket: config.bucket,
      Prefix: searchPrefix,
    };

    const data = await s3.listObjectsV2(params).promise();

    return (data.Contents || []).map((item) => ({
      filename: path.basename(item.Key), // Extract just the filename
      size: item.Size,
      date: item.LastModified,
      location: "remote",
    }));
  } catch (error) {
    logger.error("Failed to list S3 backups", error);
    return [];
  }
}

/**
 * Download backup from S3
 */
export async function downloadFromS3(filename, destinationPath) {
  if (!isS3Configured()) {
    throw new Error("S3 is not configured");
  }

  const s3 = getS3Client();
  const config = getS3Config();

  // Build the S3 key with prefix if provided
  const prefix = config.prefix ? config.prefix.replace(/\/$/, "") + "/" : "";
  const key = prefix + filename;

  const params = {
    Bucket: config.bucket,
    Key: key,
  };

  try {
    const data = await s3.getObject(params).promise();
    await fs.writeFile(destinationPath, data.Body);
    return true;
  } catch (error) {
    throw new Error(`S3 download failed: ${error.message}`);
  }
}

/**
 * Delete backup from S3
 */
export async function deleteFromS3(filename) {
  if (!isS3Configured()) {
    throw new Error("S3 is not configured");
  }

  const s3 = getS3Client();
  const config = getS3Config();

  // Build the S3 key with prefix if provided
  const prefix = config.prefix ? config.prefix.replace(/\/$/, "") + "/" : "";
  const key = prefix + filename;

  const params = {
    Bucket: config.bucket,
    Key: key,
  };

  try {
    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    throw new Error(`S3 delete failed: ${error.message}`);
  }
}

/**
 * List all backups from local and remote storage
 */
export async function listAllBackups() {
  const backupConfig = getBackupConfig();
  const storage = backupConfig.storage;

  let localBackups = [];
  let remoteBackups = [];

  // Get local backups if storage is local or both
  if (storage === "local" || storage === "both") {
    localBackups = await listLocalBackups();
  }

  // Get remote backups if storage is remote or both
  if ((storage === "remote" || storage === "both") && isS3Configured()) {
    remoteBackups = await listS3Backups();
  }

  // Merge backups and mark location
  const backupMap = new Map();

  for (const backup of localBackups) {
    backupMap.set(backup.filename, {
      ...backup,
      location: "local",
    });
  }

  for (const backup of remoteBackups) {
    if (backupMap.has(backup.filename)) {
      // Exists in both local and remote
      const existing = backupMap.get(backup.filename);
      backupMap.set(backup.filename, {
        ...existing,
        location: "both",
      });
    } else {
      backupMap.set(backup.filename, {
        ...backup,
        location: "remote",
      });
    }
  }

  return Array.from(backupMap.values()).sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );
}

/**
 * Get backup statistics
 */
export async function getBackupStats() {
  const allBackups = await listAllBackups();

  const stats = {
    total: allBackups.length,
    local: 0,
    remote: 0,
    totalSize: 0,
  };

  for (const backup of allBackups) {
    stats.totalSize += backup.size;

    if (backup.location === "local") {
      stats.local++;
    } else if (backup.location === "remote") {
      stats.remote++;
    } else if (backup.location === "both") {
      stats.local++;
      stats.remote++;
    }
  }

  return stats;
}
