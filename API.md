# API Documentation

## Base URL

```
http://localhost:7050/api
```

## Table of Contents

- [Health Check](#health-check)
- [Database Configuration](#database-configuration)
- [Backups](#backups)
- [Config Mode Management](#config-mode-management)
- [Manual Configuration](#manual-configuration)
- [Storage Configuration](#storage-configuration)
- [Scheduler](#scheduler)
- [Error Responses](#error-responses)
- [Rate Limiting](#rate-limiting)
- [Cron Schedule Format](#cron-schedule-format)
- [Security Best Practices](#security-best-practices)

---

## Health Check

### Check Server Health

```http
GET /health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Database Configuration

### Get Database Configuration

```http
GET /api/config
```

**Response:**

```json
{
  "success": true,
  "config": {
    "host": "localhost",
    "port": 5432,
    "user": "postgres",
    "database": "mydb"
  }
}
```

### Set Temporary Database Configuration

```http
POST /api/config
```

**Request Body:**

```json
{
  "host": "localhost",
  "port": 5432,
  "user": "postgres",
  "password": "password",
  "database": "mydb"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Configuration updated successfully",
  "config": {
    "host": "localhost",
    "port": 5432,
    "user": "postgres",
    "database": "mydb"
  }
}
```

### Clear Temporary Configuration

```http
DELETE /api/config
```

**Response:**

```json
{
  "success": true,
  "message": "Configuration reset to environment variables"
}
```

### Test Database Connection

```http
POST /api/config/test
```

**Response:**

```json
{
  "success": true,
  "message": "Connection successful",
  "serverTime": "2024-01-01T00:00:00.000Z",
  "version": "PostgreSQL 14.5 on x86_64-pc-linux-gnu..."
}
```

---

## Backups

### List All Backups

```http
GET /api/backups
```

**Response:**

```json
{
  "success": true,
  "backups": [
    {
      "filename": "backup_mydb_2024-01-01T00-00-00-000Z.sql",
      "size": 1048576,
      "date": "2024-01-01T00:00:00.000Z",
      "location": "both",
      "format": "sql"
    }
  ],
  "stats": {
    "total": 1,
    "local": 1,
    "remote": 1,
    "totalSize": 1048576
  }
}
```

### Create New Backup

```http
POST /api/backups
```

**Request Body (Optional):**

```json
{
  "format": "sql" // or "dump"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Backup created successfully",
  "filename": "backup_mydb_2024-01-01T00-00-00-000Z.sql",
  "size": 1048576,
  "format": "sql",
  "location": "both"
}
```

### Download Backup

```http
GET /api/backups/:filename/download
```

**Parameters:**

- `filename` - The backup filename

**Response:**

- File download stream

### Delete Backup

```http
DELETE /api/backups/:filename
```

**Parameters:**

- `filename` - The backup filename

**Response:**

```json
{
  "success": true,
  "message": "Backup deleted successfully",
  "deletedLocal": true,
  "deletedRemote": true
}
```

### Restore Backup

```http
POST /api/restore
```

**Request Body:**

```json
{
  "filename": "backup_mydb_2024-01-01T00-00-00-000Z.sql"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Database restored successfully"
}
```

---

## Config Mode Management

### Get Configuration Mode

```http
GET /api/config/mode
```

**Response:**

```json
{
  "success": true,
  "mode": "env",
  "manualConfig": null,
  "envConfig": {
    "database": {
      "host": "localhost",
      "port": 5432,
      "user": "postgres",
      "database": "mydb",
      "schema": "",
      "excludeTables": []
    },
    "backup": {
      "enabled": true,
      "schedule": "0 2 * * *",
      "retentionDays": 7,
      "format": "sql",
      "storage": "local"
    },
    "s3": null
  }
}
```

### Set Configuration Mode

```http
POST /api/config/mode
```

**Request Body:**

```json
{
  "mode": "manual" // or "env"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Configuration mode set to MANUAL",
  "mode": "manual"
}
```

### Reset Manual Configuration

```http
POST /api/config/reset
```

**Response:**

```json
{
  "success": true,
  "message": "Manual configuration has been reset"
}
```

---

## Manual Configuration

Manual configuration endpoints allow you to set database, backup, and S3 settings via API when the application is in `manual` mode.

### Set Manual Database Configuration

```http
POST /api/config/manual/database
```

**Request Body:**

```json
{
  "host": "localhost",
  "port": 5432,
  "user": "postgres",
  "password": "password",
  "database": "mydb",
  "schema": "public",
  "excludeTables": "migrations,sessions"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Manual database configuration saved",
  "config": {
    "host": "localhost",
    "port": 5432,
    "user": "postgres",
    "database": "mydb",
    "schema": "public",
    "excludeTables": ["migrations", "sessions"]
  }
}
```

### Set Manual Backup Configuration

```http
POST /api/config/manual/backup
```

**Request Body:**

```json
{
  "auto": true,
  "schedule": "0 2 * * *",
  "retentionDays": 7,
  "storage": "both",
  "localPath": "./backups",
  "format": "sql"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Manual backup configuration saved",
  "config": {
    "auto": true,
    "schedule": "0 2 * * *",
    "retentionDays": 7,
    "storage": "both",
    "localPath": "./backups",
    "format": "sql"
  }
}
```

### Set Manual S3 Configuration

```http
POST /api/config/manual/s3
```

**Request Body:**

```json
{
  "accessKeyId": "your-access-key",
  "secretAccessKey": "your-secret-key",
  "region": "us-east-1",
  "bucket": "my-backups",
  "prefix": "postgres/",
  "endpoint": "https://s3.amazonaws.com",
  "s3ForcePathStyle": false
}
```

**Response:**

```json
{
  "success": true,
  "message": "Manual S3 configuration saved",
  "config": {
    "accessKeyId": "your-access-key",
    "region": "us-east-1",
    "bucket": "my-backups",
    "endpoint": "https://s3.amazonaws.com",
    "s3ForcePathStyle": false
  }
}
```

**Note:** All manual configuration endpoints require the application to be in `manual` mode. Switch mode using `POST /api/config/mode` first.

---

## Storage Configuration

### Get Storage Configuration

```http
GET /api/storage/config
```

**Response:**

```json
{
  "success": true,
  "config": {
    "storage": "local",
    "retentionDays": 7,
    "s3": {
      "accessKeyId": "your-access-key",
      "secretAccessKey": "********",
      "region": "us-east-1",
      "bucket": "my-backups",
      "prefix": "postgres/",
      "endpoint": "",
      "s3ForcePathStyle": false
    }
  }
}
```

### Update Storage Configuration

```http
POST /api/storage/config
```

**Request Body:**

```json
{
  "accessKeyId": "your-access-key",
  "secretAccessKey": "your-secret-key",
  "region": "us-east-1",
  "bucket": "my-backups",
  "prefix": "postgres/",
  "endpoint": "https://s3.amazonaws.com",
  "s3ForcePathStyle": false
}
```

**Response:**

```json
{
  "success": true,
  "message": "Storage configuration updated successfully"
}
```

---

## Scheduler

### Get Scheduler Status

```http
GET /api/scheduler
```

**Response:**

```json
{
  "success": true,
  "running": true,
  "schedule": "0 2 * * *",
  "nextRun": "2024-01-02T02:00:00.000Z"
}
```

### Start Scheduler

```http
POST /api/scheduler
```

**Request Body (Optional):**

```json
{
  "schedule": "0 2 * * *"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Scheduler started successfully",
  "running": true,
  "schedule": "0 2 * * *"
}
```

### Stop Scheduler

```http
DELETE /api/scheduler
```

**Response:**

```json
{
  "success": true,
  "message": "Scheduler stopped successfully",
  "running": false
}
```

---

## Error Responses

All endpoints may return the following error formats:

### Validation Error (400)

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "type": "field",
      "value": "",
      "msg": "Host is required",
      "path": "host",
      "location": "body"
    }
  ]
}
```

### Not Found Error (404)

```json
{
  "success": false,
  "message": "Backup file not found"
}
```

### Server Error (500)

```json
{
  "success": false,
  "message": "Internal server error"
}
```

### Rate Limit Error (429)

```json
{
  "success": false,
  "message": "Too many requests, please try again later"
}
```

---

## Rate Limiting

- **General endpoints**: 100 requests per 15 minutes per IP
- **Sensitive operations** (backup, restore, config changes): 20 requests per 15 minutes per IP

---

## Cron Schedule Format

The scheduler uses standard cron syntax:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
* * * * *
```

### Examples:

- `0 2 * * *` - Every day at 2:00 AM
- `0 */6 * * *` - Every 6 hours
- `*/30 * * * *` - Every 30 minutes
- `0 0 * * 0` - Every Sunday at midnight
- `0 0 1 * *` - First day of every month at midnight

---

## Security Best Practices

1. **Always use HTTPS in production** - Deploy behind a reverse proxy (nginx, Caddy, etc.)
2. **Restrict network access** - Use firewall rules to limit access to trusted IPs
3. **Use strong passwords** - For both database and S3 credentials
4. **Rotate credentials regularly** - Change passwords and access keys periodically
5. **Limit S3 bucket permissions** - Grant only necessary permissions for backup operations
6. **Keep backups encrypted** - Consider encrypting sensitive backup data
7. **Monitor logs** - Regularly check logs for suspicious activity
8. **Keep software updated** - Regularly update dependencies for security patches
