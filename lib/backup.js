import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { getBackupConfig, getDatabaseConfig, getSSLMode } from "./config.js";
import logger from "./logger.js";

const execAsync = promisify(exec);

/**
 * Generate backup filename with timestamp
 */
export function generateBackupFilename(database, format = "sql") {
  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\./g, "-");
  const extension = format === "dump" ? "dump" : "sql";
  return `backup_${database}_${timestamp}.${extension}`;
}

/**
 * Ensure backup directory exists
 */
export async function ensureBackupDir() {
  const config = getBackupConfig();
  await fs.mkdir(config.localPath, { recursive: true });
  return config.localPath;
}

/**
 * Create database backup using pg_dump
 */
export async function createBackup(format) {
  const dbConfig = getDatabaseConfig();
  const backupConfig = getBackupConfig();
  const backupDir = await ensureBackupDir();

  // Use provided format or config format
  const backupFormat = format || backupConfig.format || "sql";
  const filename = generateBackupFilename(dbConfig.database, backupFormat);
  const filepath = path.join(backupDir, filename);

  // Set environment variables for PostgreSQL authentication
  const env = {
    ...process.env,
    PGPASSWORD: dbConfig.password,
    PGSSLMODE: getSSLMode(dbConfig.host),
  };

  // Build pg_dump command based on format
  let command = `pg_dump --no-password -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database}`;

  // Add schema if specified
  if (dbConfig.schema) {
    command += ` -n ${dbConfig.schema}`;
  }

  // Add exclude tables if specified
  if (dbConfig.excludeTables && dbConfig.excludeTables.length > 0) {
    dbConfig.excludeTables.forEach((table) => {
      // If schema is specified, include it in the table name
      const tableName = dbConfig.schema ? `${dbConfig.schema}.${table}` : table;
      command += ` --exclude-table=${tableName}`;
    });
  }

  // Add format and output file
  if (backupFormat === "dump") {
    // Custom format (.dump) - compressed, can be used with pg_restore
    command += ` -F c -v -f "${filepath}"`;
  } else {
    // Plain text format (.sql) - can be used with psql
    command += ` -F p -f "${filepath}"`;
  }

  try {
    // Use shell option to ensure environment variables are properly passed
    await execAsync(command, {
      env,
      shell: process.platform === "win32" ? "powershell.exe" : true,
    });

    // Get file stats
    const stats = await fs.stat(filepath);

    return {
      filename,
      path: filepath,
      size: stats.size,
      format: backupFormat,
    };
  } catch (error) {
    // Clean up failed backup file if it exists
    try {
      await fs.unlink(filepath);
    } catch {}
    throw new Error(`Backup failed: ${error.message}`);
  }
}

/**
 * Restore database from backup using psql or pg_restore
 * @param {string} filename - Backup filename or full path
 * @param {string} customPath - Optional custom file path (used for temporary files)
 */
export async function restoreBackup(filename, customPath = null) {
  const dbConfig = getDatabaseConfig();
  const backupConfig = getBackupConfig();

  // Use custom path if provided, otherwise construct from filename
  const filepath =
    customPath || path.join(backupConfig.localPath, path.basename(filename));

  // Check if backup file exists
  try {
    await fs.access(filepath);
  } catch {
    throw new Error(`Backup file not found: ${filename}`);
  }

  // Set environment variables for PostgreSQL authentication
  const env = {
    ...process.env,
    PGPASSWORD: dbConfig.password,
    PGSSLMODE: getSSLMode(dbConfig.host),
  };

  // Determine format from file extension
  const isDumpFormat = filename.endsWith(".dump");

  // Build restore command based on format
  let command;
  if (isDumpFormat) {
    // Use pg_restore for .dump files (custom format)
    // -c: clean (drop) database objects before recreating
    // -v: verbose mode
    // --no-owner: skip ownership restoration
    // -F c: custom format (matches pg_dump -F c)
    command = `pg_restore --no-password -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -c -v --no-owner -F c "${filepath}"`;
  } else {
    // Use psql for .sql files (plain text format)
    // Drop and recreate schema to match dump behavior (clean restore)
    const schema = dbConfig.schema || "public";
    const dropSchemaCmd = `psql --no-password -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -c "DROP SCHEMA IF EXISTS ${schema} CASCADE; CREATE SCHEMA ${schema};"`;
    const restoreCmd = `psql --no-password -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -f "${filepath}"`;

    command = `${dropSchemaCmd} && ${restoreCmd}`;
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      env,
      shell: process.platform === "win32" ? "powershell.exe" : true,
    });
    return { success: true, output: stdout || stderr };
  } catch (error) {
    throw new Error(`Restore failed: ${error.message}`);
  }
}

/**
 * List local backup files
 */
export async function listLocalBackups() {
  const backupConfig = getBackupConfig();

  try {
    await ensureBackupDir();
    const files = await fs.readdir(backupConfig.localPath);

    const backups = [];
    for (const file of files) {
      if (file.endsWith(".sql") || file.endsWith(".dump")) {
        const filepath = path.join(backupConfig.localPath, file);
        const stats = await fs.stat(filepath);
        backups.push({
          filename: file,
          size: stats.size,
          date: stats.mtime,
          location: "local",
          format: file.endsWith(".dump") ? "dump" : "sql",
        });
      }
    }

    return backups;
  } catch (error) {
    return [];
  }
}

/**
 * Delete local backup file
 */
export async function deleteLocalBackup(filename) {
  const backupConfig = getBackupConfig();
  const filepath = path.join(backupConfig.localPath, path.basename(filename));

  try {
    await fs.unlink(filepath);
    return true;
  } catch (error) {
    throw new Error(`Failed to delete local backup: ${error.message}`);
  }
}

/**
 * Get local backup file path
 */
export function getLocalBackupPath(filename) {
  const backupConfig = getBackupConfig();
  return path.join(backupConfig.localPath, path.basename(filename));
}

/**
 * Apply retention policy - delete backups older than configured days
 */
export async function applyRetentionPolicy() {
  const backupConfig = getBackupConfig();
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - backupConfig.retentionDays);

  let deletedCount = 0;

  // Get all backups (local and remote)
  const { listAllBackups } = await import("./storage/s3.js");
  const allBackups = await listAllBackups();

  for (const backup of allBackups) {
    if (new Date(backup.date) < retentionDate) {
      try {
        // Delete from local if exists
        if (backup.location === "local" || backup.location === "both") {
          await deleteLocalBackup(backup.filename);
        }

        // Delete from remote if exists
        if (backup.location === "remote" || backup.location === "both") {
          const { deleteFromS3 } = await import("./storage/s3.js");
          await deleteFromS3(backup.filename);
        }

        deletedCount++;
        logger.info(`Deleted old backup: ${backup.filename}`);
      } catch (error) {
        logger.error(`Failed to delete old backup ${backup.filename}`, error);
      }
    }
  }

  return deletedCount;
}
