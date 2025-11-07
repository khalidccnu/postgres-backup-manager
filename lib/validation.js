import { body, param, validationResult } from "express-validator";
import cron from "node-cron";

/**
 * Middleware to handle validation errors
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

/**
 * Validation rules for backup creation
 */
export const validateCreateBackup = [
  body("format")
    .optional()
    .isIn(["sql", "dump"])
    .withMessage('Format must be either "sql" or "dump"'),
  validate,
];

/**
 * Validation rules for restore
 */
export const validateRestore = [
  body("filename")
    .trim()
    .notEmpty()
    .withMessage("Filename is required")
    .matches(/^backup_[\w-]+\.(sql|dump)$/)
    .withMessage("Invalid backup filename format"),
  validate,
];

/**
 * Validation rules for filename parameter
 */
export const validateFilename = [
  param("filename")
    .trim()
    .notEmpty()
    .withMessage("Filename is required")
    .matches(/^backup_[\w-]+\.(sql|dump)$/)
    .withMessage("Invalid backup filename format"),
  validate,
];

/**
 * Validation rules for database config
 */
export const validateDatabaseConfig = [
  body("host").trim().notEmpty().withMessage("Host is required"),
  body("port").isInt({ min: 1, max: 65535 }).withMessage("Invalid port number"),
  body("user").trim().notEmpty().withMessage("User is required"),
  body("password").trim().notEmpty().withMessage("Password is required"),
  body("database").trim().notEmpty().withMessage("Database name is required"),
  body("schema").optional().trim(),
  body("excludeTables").optional(),
  validate,
];

/**
 * Validation rules for manual database config
 */
export const validateManualDatabaseConfig = [
  body("host").trim().notEmpty().withMessage("Host is required"),
  body("port")
    .isInt({ min: 1, max: 65535 })
    .withMessage("Port must be between 1 and 65535"),
  body("user").trim().notEmpty().withMessage("User is required"),
  body("password").optional().trim(),
  body("database").trim().notEmpty().withMessage("Database name is required"),
  body("schema").optional().trim(),
  body("excludeTables").optional(),
  validate,
];

/**
 * Validation rules for backup config
 */
export const validateBackupConfig = [
  body("auto").optional().isBoolean().withMessage("Auto must be a boolean"),
  body("schedule")
    .optional()
    .custom((value) => {
      if (!cron.validate(value)) {
        throw new Error("Invalid cron expression");
      }
      return true;
    }),
  body("retentionDays")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("Retention days must be between 1 and 365"),
  body("storage")
    .optional()
    .isIn(["local", "remote", "both"])
    .withMessage('Storage must be "local", "remote", or "both"'),
  body("localPath").optional().trim(),
  body("format")
    .optional()
    .isIn(["sql", "dump"])
    .withMessage('Format must be "sql" or "dump"'),
  validate,
];

/**
 * Validation rules for S3 config
 */
export const validateS3Config = [
  body("accessKeyId").optional().trim(),
  body("secretAccessKey").optional().trim(),
  body("region").optional().trim(),
  body("bucket").optional().trim(),
  body("prefix").optional().trim(),
  body("endpoint")
    .optional()
    .trim()
    .custom((value) => {
      if (
        value &&
        !value.startsWith("http://") &&
        !value.startsWith("https://")
      ) {
        throw new Error("Endpoint must start with http:// or https://");
      }
      return true;
    }),
  body("s3ForcePathStyle").optional().isBoolean(),
  validate,
];

/**
 * Validation rules for config mode
 */
export const validateConfigMode = [
  body("mode")
    .isIn(["env", "manual"])
    .withMessage('Mode must be either "env" or "manual"'),
  validate,
];

/**
 * Validation rules for scheduler
 */
export const validateScheduler = [
  body("schedule")
    .optional()
    .custom((value) => {
      if (value && !cron.validate(value)) {
        throw new Error("Invalid cron expression");
      }
      return true;
    }),
  validate,
];

/**
 * Sanitize filename to prevent path traversal
 */
export const sanitizeFilename = (filename) => {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "");
};
