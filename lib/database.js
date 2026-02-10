import pg from "pg";
import { getDatabaseConfig, getSSLMode } from "./config.js";
import logger from "./logger.js";

const { Pool } = pg;

let pool = null;

/**
 * Get or create database connection pool
 */
export function getPool() {
  if (!pool) {
    const dbConfig = getDatabaseConfig();
    const sslMode = getSSLMode(dbConfig.host);

    // SSL configuration based on sslMode setting
    let sslOption = false;
    if (sslMode === "require" || sslMode === "prefer") {
      sslOption = { rejectUnauthorized: false };
    }

    pool = new Pool({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      // Connection pool settings
      max: 10, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection could not be established
      // SSL configuration - respects the DB_SSL setting
      ssl: sslOption,
    });

    // Handle pool errors
    pool.on("error", (err) => {
      logger.error("Unexpected error on idle database client", err);
    });

    logger.info("Database connection pool created");
  }

  return pool;
}

/**
 * Test database connection
 */
export async function testConnection() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      "SELECT NOW() as now, version() as version",
    );
    return {
      success: true,
      serverTime: result.rows[0].now,
      version: result.rows[0].version,
    };
  } catch (error) {
    logger.error("Database connection test failed", error);
    throw new Error(`Connection failed: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Close database pool
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info("Database connection pool closed");
  }
}

/**
 * Reset pool (useful when config changes)
 */
export async function resetPool() {
  await closePool();
  return getPool();
}

export default {
  getPool,
  testConnection,
  closePool,
  resetPool,
};
