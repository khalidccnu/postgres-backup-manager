import compression from "compression";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import fs from "fs/promises";
import helmet from "helmet";
import morgan from "morgan";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

// Import libraries
import {
  createBackup,
  deleteLocalBackup,
  getLocalBackupPath,
  restoreBackup,
} from "./lib/backup.js";
import {
  clearTempConfig,
  getBackupConfig,
  getConfigMode,
  getDatabaseConfig,
  getManualConfig,
  getS3Config,
  resetManualConfig,
  setConfigMode,
  setManualBackupConfig,
  setManualDatabaseConfig,
  setManualS3Config,
  setTempConfig,
} from "./lib/config.js";
import { resetPool, testConnection } from "./lib/database.js";
import logger from "./lib/logger.js";
import {
  getSchedulerStatus,
  initializeScheduler,
  startScheduler,
  stopScheduler,
} from "./lib/scheduler.js";
import {
  deleteFromS3,
  downloadFromS3,
  getBackupStats,
  isS3Configured,
  listAllBackups,
  uploadToS3,
} from "./lib/storage/s3.js";
import {
  validateBackupConfig,
  validateConfigMode,
  validateCreateBackup,
  validateDatabaseConfig,
  validateFilename,
  validateManualDatabaseConfig,
  validateRestore,
  validateS3Config,
  validateScheduler,
} from "./lib/validation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 7050;

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // More strict limit for sensitive operations
  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
});

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "cdn.jsdelivr.net"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);
app.use(cors());
app.use(compression());
app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(limiter); // Apply rate limiting to all routes

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ==================== DATABASE TEST ENDPOINT ====================

/**
 * POST /api/config/test - Test database connection
 */
app.post("/api/config/test", strictLimiter, async (req, res) => {
  try {
    const result = await testConnection();
    logger.info("Database connection test successful");

    res.json({
      success: true,
      message: "Connection successful",
      serverTime: result.serverTime,
      version: result.version,
    });
  } catch (error) {
    logger.error("Database connection test failed", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== BACKUP ENDPOINTS ====================

/**
 * GET /api/backups - List all backups
 */
app.get("/api/backups", async (req, res) => {
  try {
    const backups = await listAllBackups();
    const stats = await getBackupStats();

    res.json({
      success: true,
      backups,
      stats,
    });
  } catch (error) {
    logger.error("Error listing backups", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/backups - Create new backup
 */
app.post(
  "/api/backups",
  strictLimiter,
  validateCreateBackup,
  async (req, res) => {
    try {
      const backupConfig = getBackupConfig();
      const { format } = req.body; // Get format from request body

      // Create backup with specified format
      const result = await createBackup(format);
      logger.info(`Backup created: ${result.filename} (${result.size} bytes)`);

      // Upload to S3 if configured
      if (
        (backupConfig.storage === "remote" ||
          backupConfig.storage === "both") &&
        isS3Configured()
      ) {
        await uploadToS3(result.path, result.filename);
        logger.info(`Backup uploaded to S3: ${result.filename}`);
      }

      const location =
        backupConfig.storage === "local"
          ? "local"
          : backupConfig.storage === "remote" && isS3Configured()
          ? "remote"
          : backupConfig.storage === "both" && isS3Configured()
          ? "both"
          : "local";

      res.status(201).json({
        success: true,
        message: "Backup created successfully",
        filename: result.filename,
        size: result.size,
        format: result.format,
        location,
      });
    } catch (error) {
      logger.error("Error creating backup", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

/**
 * DELETE /api/backups/:filename - Delete backup
 */
app.delete(
  "/api/backups/:filename",
  strictLimiter,
  validateFilename,
  async (req, res) => {
    try {
      const filename = path.basename(req.params.filename); // Prevent path traversal
      const backupConfig = getBackupConfig();

      let deletedLocal = false;
      let deletedRemote = false;

      // Try to delete from local storage
      if (backupConfig.storage === "local" || backupConfig.storage === "both") {
        try {
          await deleteLocalBackup(filename);
          deletedLocal = true;
        } catch (error) {
          logger.error("Failed to delete local backup", error);
        }
      }

      // Try to delete from remote storage
      if (
        (backupConfig.storage === "remote" ||
          backupConfig.storage === "both") &&
        isS3Configured()
      ) {
        try {
          await deleteFromS3(filename);
          deletedRemote = true;
        } catch (error) {
          logger.error("Failed to delete remote backup", error);
        }
      }

      if (deletedLocal || deletedRemote) {
        res.json({
          success: true,
          message: "Backup deleted successfully",
          deletedLocal,
          deletedRemote,
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Backup not found or could not be deleted",
        });
      }
    } catch (error) {
      logger.error("Error deleting backup", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/backups/:filename/download - Download backup
 */
app.get("/api/backups/:filename/download", async (req, res) => {
  try {
    const filename = path.basename(req.params.filename); // Prevent path traversal
    const backupConfig = getBackupConfig();
    let filepath = null;

    // Try to get from local storage first
    if (backupConfig.storage === "local" || backupConfig.storage === "both") {
      filepath = getLocalBackupPath(filename);

      try {
        await fs.access(filepath);
      } catch {
        filepath = null;
      }
    }

    // If not found locally and S3 is configured, download from S3
    if (
      !filepath &&
      (backupConfig.storage === "remote" || backupConfig.storage === "both") &&
      isS3Configured()
    ) {
      const tempPath = path.join(os.tmpdir(), filename);
      try {
        await downloadFromS3(filename, tempPath);
        filepath = tempPath;
      } catch (error) {
        logger.error("Failed to download from S3", error);
      }
    }

    if (!filepath) {
      return res.status(404).json({
        success: false,
        message: "Backup file not found",
      });
    }

    // Send file
    res.download(filepath, filename, (err) => {
      if (err) {
        logger.error("Error sending file", err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: "Failed to download backup",
          });
        }
      }

      // Clean up temp file if downloaded from S3
      if (filepath.startsWith(os.tmpdir())) {
        fs.unlink(filepath).catch((err) =>
          logger.error("Failed to clean up temp file", err)
        );
      }
    });
  } catch (error) {
    logger.error("Error downloading backup", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/restore - Restore database from backup
 */
app.post("/api/restore", strictLimiter, validateRestore, async (req, res) => {
  try {
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({
        success: false,
        message: "Filename is required",
      });
    }

    const safeFilename = path.basename(filename); // Prevent path traversal
    const backupConfig = getBackupConfig();
    let localPath = getLocalBackupPath(safeFilename);
    let isTemporaryFile = false;

    // Check if file exists locally
    let fileExists = false;
    try {
      await fs.access(localPath);
      fileExists = true;
    } catch {}

    // If not found locally, try to download from S3 to temporary location
    if (
      !fileExists &&
      (backupConfig.storage === "remote" || backupConfig.storage === "both") &&
      isS3Configured()
    ) {
      try {
        // Download to temporary location instead of permanent local storage
        const tempPath = path.join(
          os.tmpdir(),
          `restore_${Date.now()}_${safeFilename}`
        );
        await downloadFromS3(safeFilename, tempPath);
        localPath = tempPath;
        fileExists = true;
        isTemporaryFile = true;
      } catch (error) {
        logger.error("Failed to download from S3", error);
      }
    }

    if (!fileExists) {
      return res.status(404).json({
        success: false,
        message: "Backup file not found",
      });
    }

    // Restore backup (pass custom path if using temporary file)
    try {
      await restoreBackup(safeFilename, isTemporaryFile ? localPath : null);

      res.json({
        success: true,
        message: "Database restored successfully",
      });
    } finally {
      // Clean up temporary file if it was downloaded from S3
      if (isTemporaryFile) {
        try {
          await fs.unlink(localPath);
        } catch (err) {
          logger.error("Failed to clean up temporary file", err);
        }
      }
    }
  } catch (error) {
    logger.error("Error restoring backup", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== CONFIG ENDPOINTS ====================

/**
 * GET /api/config - Get current database configuration
 */
app.get("/api/config", (req, res) => {
  try {
    const config = getDatabaseConfig();

    // Don't expose password
    res.json({
      success: true,
      config: {
        host: config.host,
        port: config.port,
        user: config.user,
        database: config.database,
      },
    });
  } catch (error) {
    logger.error("Error getting config", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/config - Set temporary database configuration
 */
app.post(
  "/api/config",
  strictLimiter,
  validateDatabaseConfig,
  async (req, res) => {
    try {
      const { host, port, user, password, database } = req.body;

      if (!host || !port || !user || !password || !database) {
        return res.status(400).json({
          success: false,
          message:
            "All fields are required: host, port, user, password, database",
        });
      }

      const config = setTempConfig({ host, port, user, password, database });

      // Reset connection pool to use new config
      await resetPool();
      logger.info("Temporary database configuration updated");

      res.json({
        success: true,
        message: "Configuration updated successfully",
        config: {
          host: config.host,
          port: config.port,
          user: config.user,
          database: config.database,
        },
      });
    } catch (error) {
      logger.error("Error setting config", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

/**
 * DELETE /api/config - Clear temporary configuration
 */
app.delete("/api/config", (req, res) => {
  try {
    clearTempConfig();

    res.json({
      success: true,
      message: "Configuration reset to environment variables",
    });
  } catch (error) {
    logger.error("Error clearing config", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== CONFIG MODE ENDPOINTS ====================

/**
 * GET /api/config/mode - Get configuration mode
 */
app.get("/api/config/mode", (req, res) => {
  try {
    const mode = getConfigMode();
    const manualConfig = getManualConfig();

    // Also get ENV config for display purposes
    let envConfig = null;
    if (mode === "env") {
      try {
        const dbConfig = getDatabaseConfig();
        const backupConfig = getBackupConfig();
        const s3Config = isS3Configured() ? getS3Config() : null;

        envConfig = {
          database: {
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            database: dbConfig.database,
            schema: dbConfig.schema || "",
            excludeTables: dbConfig.excludeTables || [],
          },
          backup: {
            enabled: backupConfig.enabled,
            schedule: backupConfig.schedule,
            retentionDays: backupConfig.retentionDays,
            format: backupConfig.format,
            storage: backupConfig.storage,
          },
          s3: s3Config
            ? {
                bucket: s3Config.bucket,
                region: s3Config.region || "",
                prefix: s3Config.prefix || "",
                endpoint: s3Config.endpoint || "",
                forcePathStyle: s3Config.forcePathStyle || false,
              }
            : null,
        };
      } catch (error) {
        logger.error("Error getting ENV config", error);
      }
    }

    res.json({
      success: true,
      mode,
      manualConfig: mode === "manual" ? manualConfig : null,
      envConfig: mode === "env" ? envConfig : null,
    });
  } catch (error) {
    logger.error("Error getting config mode", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/config/mode - Set configuration mode
 */
app.post("/api/config/mode", strictLimiter, validateConfigMode, (req, res) => {
  try {
    const { mode } = req.body;

    if (!mode || (mode !== "env" && mode !== "manual")) {
      return res.status(400).json({
        success: false,
        message: 'Mode must be "env" or "manual"',
      });
    }

    setConfigMode(mode);

    res.json({
      success: true,
      message: `Configuration mode set to ${mode.toUpperCase()}`,
      mode,
    });
  } catch (error) {
    logger.error("Error setting config mode", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/config/reset - Reset manual configuration
 */
app.post("/api/config/reset", (req, res) => {
  try {
    const mode = getConfigMode();

    if (mode !== "manual") {
      return res.status(400).json({
        success: false,
        message: "Can only reset configuration in Manual mode",
      });
    }

    // Reset manual config by calling the reset function
    resetManualConfig();

    res.json({
      success: true,
      message: "Manual configuration has been reset",
    });
  } catch (error) {
    logger.error("Error resetting config", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/config/manual/database - Set manual database config
 */
app.post(
  "/api/config/manual/database",
  strictLimiter,
  validateManualDatabaseConfig,
  async (req, res) => {
    try {
      const { host, port, user, password, database, schema, excludeTables } =
        req.body;

      if (!host || !port || !user || !password || !database) {
        return res.status(400).json({
          success: false,
          message: "All fields are required",
        });
      }

      const config = setManualDatabaseConfig({
        host,
        port,
        user,
        password,
        database,
        schema,
        excludeTables,
      });

      // Reset connection pool to use new config
      await resetPool();
      logger.info("Manual database configuration saved");

      res.json({
        success: true,
        message: "Manual database configuration saved",
        config: {
          host: config.host,
          port: config.port,
          user: config.user,
          database: config.database,
          schema: config.schema,
          excludeTables: config.excludeTables,
        },
      });
    } catch (error) {
      logger.error("Error setting manual database config", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/config/manual/backup - Set manual backup config
 */
app.post(
  "/api/config/manual/backup",
  strictLimiter,
  validateBackupConfig,
  (req, res) => {
    try {
      const { auto, schedule, retentionDays, storage, localPath, format } =
        req.body;

      const config = setManualBackupConfig({
        auto,
        schedule,
        retentionDays,
        storage,
        localPath,
        format,
      });

      res.json({
        success: true,
        message: "Manual backup configuration saved",
        config,
      });
    } catch (error) {
      logger.error("Error setting manual backup config", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/config/manual/s3 - Set manual S3 config
 */
app.post(
  "/api/config/manual/s3",
  strictLimiter,
  validateS3Config,
  (req, res) => {
    try {
      const {
        accessKeyId,
        secretAccessKey,
        region,
        bucket,
        prefix,
        endpoint,
        s3ForcePathStyle,
      } = req.body;

      const config = setManualS3Config({
        accessKeyId,
        secretAccessKey,
        region,
        bucket,
        prefix,
        endpoint,
        s3ForcePathStyle,
      });

      res.json({
        success: true,
        message: "Manual S3 configuration saved",
        config: {
          accessKeyId: config.accessKeyId,
          region: config.region,
          bucket: config.bucket,
          endpoint: config.endpoint,
          s3ForcePathStyle: config.s3ForcePathStyle,
        },
      });
    } catch (error) {
      logger.error("Error setting manual S3 config", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ==================== STORAGE CONFIG ENDPOINTS ====================

/**
 * GET /api/storage/config - Get storage configuration
 */
app.get("/api/storage/config", (req, res) => {
  try {
    const backupConfig = getBackupConfig();

    res.json({
      success: true,
      config: {
        storage: backupConfig.storage || "local",
        retentionDays: backupConfig.retentionDays || 7,
        s3: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
          // Don't expose secret key
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ? "********" : "",
          region: process.env.AWS_REGION || "us-east-1",
          bucket: process.env.AWS_S3_BUCKET || "",
          prefix: process.env.AWS_S3_PREFIX || "",
          endpoint: process.env.AWS_S3_ENDPOINT || "",
          s3ForcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === "true",
        },
      },
    });
  } catch (error) {
    logger.error("Error getting storage config", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/storage/config - Update S3 storage configuration
 */
app.post("/api/storage/config", (req, res) => {
  try {
    const {
      accessKeyId,
      secretAccessKey,
      region,
      bucket,
      prefix,
      endpoint,
      s3ForcePathStyle,
    } = req.body;

    // Update environment variables for runtime configuration
    if (accessKeyId) process.env.AWS_ACCESS_KEY_ID = accessKeyId;
    if (secretAccessKey) process.env.AWS_SECRET_ACCESS_KEY = secretAccessKey;
    if (region) process.env.AWS_REGION = region;
    if (bucket) process.env.AWS_S3_BUCKET = bucket;
    if (typeof prefix !== "undefined") process.env.AWS_S3_PREFIX = prefix;
    if (endpoint) process.env.AWS_S3_ENDPOINT = endpoint;
    if (typeof s3ForcePathStyle !== "undefined") {
      process.env.AWS_S3_FORCE_PATH_STYLE = s3ForcePathStyle ? "true" : "false";
    }

    res.json({
      success: true,
      message: "Storage configuration updated successfully",
    });
  } catch (error) {
    logger.error("Error updating storage config", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== SCHEDULER ENDPOINTS ====================

/**
 * GET /api/scheduler - Get scheduler status
 */
app.get("/api/scheduler", (req, res) => {
  try {
    const status = getSchedulerStatus();

    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    logger.error("Error getting scheduler status", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/scheduler - Start scheduler
 */
app.post("/api/scheduler", strictLimiter, validateScheduler, (req, res) => {
  try {
    const { schedule } = req.body;

    const result = startScheduler(schedule);

    res.json({
      success: true,
      message: "Scheduler started successfully",
      ...result,
    });
  } catch (error) {
    logger.error("Error starting scheduler", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * DELETE /api/scheduler - Stop scheduler
 */
app.delete("/api/scheduler", (req, res) => {
  try {
    const result = stopScheduler();

    res.json({
      success: true,
      message: "Scheduler stopped successfully",
      ...result,
    });
  } catch (error) {
    logger.error("Error stopping scheduler", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== ERROR HANDLERS ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

// Global error handler
app.use((err, req, res, _next) => {
  logger.error("Unhandled error", err);
  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  logger.info(`PostgreSQL Backup Manager running on http://localhost:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);

  // Initialize scheduler if auto-backup is enabled
  initializeScheduler();
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully...");
  stopScheduler();
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully...");
  stopScheduler();
  process.exit(0);
});
