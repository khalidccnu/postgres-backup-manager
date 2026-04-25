# PostgreSQL Backup Manager

A production-ready web application for managing PostgreSQL database backups with support for local and S3-compatible remote storage. Built with Express.js and vanilla JavaScript with a beautiful, responsive UI.

![PostgreSQL Backup Manager](https://img.shields.io/badge/PostgreSQL-Backup%20Manager-blue)
![Node.js](https://img.shields.io/badge/Node.js-20%20LTS-green)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)
![Security](https://img.shields.io/badge/Security-Hardened-green)

## ✨ Features

### Core Features

- 📦 **Database Backup & Restore** - Create and restore PostgreSQL backups using native `pg_dump` and `psql` commands
- 📤 **Upload & Restore Any Backup File** - Upload `.sql` or `.dump` files manually, then restore on demand from UI
- 🗄️ **Local Storage** - Save backups to local filesystem with persistent storage
- ☁️ **S3-Compatible Storage** - Upload backups to AWS S3, Supabase S3, MinIO, DigitalOcean Spaces, Backblaze B2, and more
- 📊 **Statistics Dashboard** - View total backups, storage locations, and total size at a glance
- 📜 **Detailed Operation Timeline** - View operation-wise logs (backup/restore/upload), including table and sequence level steps
- ⚙️ **Dual Configuration Modes** - Choose between ENV (environment variables) or Manual (runtime) configuration modes
- 🔧 **Runtime Configuration** - Change database connection settings without restarting the application
- 🔐 **SSL Auto-Detection** - Automatically detect local vs remote databases and configure SSL mode accordingly
- ✅ **Connection Testing** - Test database connectivity before creating backups
- 💾 **Configuration Management** - Separate manual configuration for database, backup settings, and S3 storage

### Automation

- ⏰ **Auto-Backup Scheduler** - Cron-based automatic backups with configurable schedule
- 🗑️ **Retention Policy** - Automatically delete backups older than configured days
- 🔄 **Start/Stop Scheduler** - Control auto-backup scheduler via API or UI without restart

### Security & Reliability

- 🛡️ **Rate Limiting** - Protection against API abuse (100 req/15min general, 20 req/15min for sensitive ops)
- 🔒 **Input Validation** - Comprehensive validation and sanitization on all endpoints
- 📝 **Professional Logging** - Winston logger with daily rotation and separate error logs
- 🔗 **Connection Pooling** - Efficient PostgreSQL connection management
- 🔐 **Security Headers** - Helmet.js with proper CSP, HSTS, and security configuration

### User Interface

- 📱 **Responsive Design** - Works perfectly on mobile (320px+), tablet (768px+), and desktop (1024px+)
- 🎨 **Beautiful UI** - Modern design with Ant Design-inspired components
- 🔔 **Toast Notifications** - Real-time feedback for all operations
- ⚡ **Real-Time Updates** - Auto-refresh backup list and scheduler status
- 🌐 **No Authentication** - Simple, straightforward access (suitable for internal networks)

### Storage Options

- **Local Only** - Save backups to local filesystem
- **Remote Only** - Upload backups directly to S3-compatible storage
- **Both** - Save locally AND upload to remote storage simultaneously

## 🏗️ Architecture

### Tech Stack

- **Backend**: Express.js 4.x with Node.js 20 LTS
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Database**: PostgreSQL client tools (pg_dump, psql) with connection pooling
- **Storage**: AWS SDK v2 for S3-compatible services
- **Scheduler**: node-cron with cron-parser for automated backups
- **Logging**: Winston with daily log rotation
- **Validation**: express-validator for input sanitization
- **Security**: Helmet, CORS, rate limiting, CSP headers

### File Structure

```
postgres-backup/
├── server.js                  # Main Express application
├── lib/
│   ├── config.js             # Configuration management
│   ├── backup.js             # Backup/restore operations
│   ├── scheduler.js          # Auto-backup scheduler
│   ├── database.js           # PostgreSQL connection pooling
│   ├── logger.js             # Winston logging configuration
│   ├── validation.js         # Input validation middleware
│   └── storage/
│       └── s3.js             # S3-compatible storage operations
├── public/
│   ├── index.html            # Main UI
│   ├── css/
│   │   └── styles.css        # All custom styles
│   └── js/
│       └── app.js            # Frontend JavaScript
├── logs/                      # Application logs (auto-created)
├── backups/                   # Local backup storage (auto-created)
├── Dockerfile                # Multi-stage Docker build
├── docker-compose.yml        # Docker Compose configuration
├── .env.example              # Environment variables template
├── .eslintrc.json            # ESLint configuration
├── .gitignore                # Git ignore patterns
├── setup.bat                 # Windows setup script
├── setup.sh                  # Unix setup script
├── API.md                    # API documentation
├── ARCHITECTURE.md           # Architecture documentation
├── INSTALLATION.md           # Installation guide
├── package.json              # Dependencies
└── README.md                 # This file
```

## 🚀 Quick Start

### Option 1: Docker (Recommended)

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd postgres-backup
   ```

2. **Create environment file**

   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` with your database credentials**

   ```env
   DB_HOST=your-database-host.com
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_NAME=postgres
   ```

4. **Build and run with Docker Compose**

   ```bash
   docker compose up -d
   ```

5. **Access the application**
   - Open http://localhost:7050 in your browser

### Option 2: Local Development

1. **Prerequisites**

   - Node.js 20 LTS or higher
   - PostgreSQL client tools (`pg_dump` and `psql` commands must be available in PATH)

2. **Install PostgreSQL client tools**

   **Ubuntu/Debian:**

   ```bash
   sudo apt-get update
   sudo apt-get install postgresql-client
   ```

   **macOS:**

   ```bash
   brew install postgresql
   ```

   **Windows:**

   - Download from https://www.postgresql.org/download/windows/
   - Or use WSL with Ubuntu instructions

3. **Install dependencies**

   ```bash
   yarn install
   ```

4. **Create environment file**

   ```bash
   cp .env.example .env
   ```

5. **Edit `.env` with your configuration**

6. **Start the application**

   ```bash
   yarn start
   ```

7. **Access the application**
   - Open http://localhost:7050 in your browser

## ⚙️ Configuration

### Environment Variables

#### Database Configuration (Required)

````env
#### Database Connection

```env
DB_HOST=db.example.com         # PostgreSQL host
DB_PORT=5432                     # PostgreSQL port
DB_USER=postgres                 # Database username
DB_PASSWORD=your_password        # Database password
DB_NAME=postgres                 # Database name
DB_SCHEMA=                       # Optional: Schema to backup (e.g., public)
DB_EXCLUDE_TABLES=               # Optional: Tables to exclude (e.g., migrations,sessions)
````

````

#### Backup Configuration

```env
BACKUP_AUTO=false                      # Enable auto-backup scheduler (true/false)
BACKUP_SCHEDULE=0 2 * * *             # Cron schedule (default: 2 AM daily)
BACKUP_RETENTION_DAYS=7               # Delete backups older than X days
BACKUP_STORAGE=local                  # Storage mode: local, remote, or both
BACKUP_LOCAL_PATH=./backups           # Local backup directory path
BACKUP_FORMAT=sql                     # Format: sql (plain) or dump (compressed)
````

#### S3-Compatible Storage (Optional)

```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=postgres-backups
AWS_S3_PREFIX=backups/postgres              # Optional: organize in folders
```

**For S3-compatible services (Supabase, MinIO, etc.):**

```env
AWS_S3_ENDPOINT=https://your-project.supabase.co/storage/v1/s3
AWS_S3_FORCE_PATH_STYLE=true
```

#### Server Configuration

```env
PORT=7050                        # Application port
NODE_ENV=production              # Environment mode
CONFIG_MODE=env                  # Configuration mode: env or manual
```

### Configuration Modes

The application supports two configuration modes:

#### ENV Mode (Default)

- Configuration is loaded from environment variables (.env file)
- Changes require application restart
- Best for production deployments with infrastructure-as-code
- Set `CONFIG_MODE=env` (or leave unset)

#### Manual Mode

- Configuration is set via API calls
- Stored in memory (resets on application restart)
- Changes take effect immediately without restart
- Best for development or dynamic configuration needs
- Set `CONFIG_MODE=manual`

**Switching Modes:**
Use the `POST /api/config/mode` endpoint to switch between modes at runtime.

### Cron Schedule Examples

| Schedule       | Description              |
| -------------- | ------------------------ |
| `0 2 * * *`    | Every day at 2:00 AM     |
| `0 */6 * * *`  | Every 6 hours            |
| `0 0 * * 0`    | Every Sunday at midnight |
| `*/30 * * * *` | Every 30 minutes         |
| `0 0 1 * *`    | First day of every month |

### Storage Modes

- **`local`** - Backups are saved only to local filesystem
- **`remote`** - Backups are uploaded only to S3-compatible storage
- **`both`** - Backups are saved locally AND uploaded to remote storage

## 📡 API Endpoints

### Backups

- `GET /api/backups` - List all backups with statistics
- `POST /api/backups` - Create new backup
- `POST /api/backups/upload` - Upload backup file (`multipart/form-data`, field: `backupFile`)
- `DELETE /api/backups/:filename` - Delete backup
- `GET /api/backups/:filename/download` - Download backup file
- `GET /api/operations` - List grouped operation logs with step lines
- `DELETE /api/operations` - Clear operation logs

### Restore

- `POST /api/restore` - Restore database from backup
  ```json
  {
    "filename": "backup_postgres_2025-11-04T10-30-00-000Z.sql"
  }
  ```

### Configuration Mode Management

- `GET /api/config/mode` - Get current configuration mode (ENV or Manual)
- `POST /api/config/mode` - Set configuration mode
  ```json
  {
    "mode": "manual" // or "env"
  }
  ```
- `POST /api/config/reset` - Reset manual configuration to defaults

### Database Configuration (Legacy - Temporary)

- `GET /api/config` - Get current database config (excludes password)
- `POST /api/config` - Set temporary database config
  ```json
  {
    "host": "db.example.com",
    "port": 5432,
    "user": "postgres",
    "password": "password",
    "database": "postgres"
  }
  ```
- `DELETE /api/config` - Reset to environment variables
- `POST /api/config/test` - Test database connection

### Manual Configuration (New)

- `POST /api/config/manual/database` - Set manual database configuration
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
- `POST /api/config/manual/backup` - Set manual backup configuration
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
- `POST /api/config/manual/s3` - Set manual S3 configuration
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

### Storage Configuration

- `GET /api/storage/config` - Get current storage configuration
- `POST /api/storage/config` - Update S3 storage configuration

### Scheduler

- `GET /api/scheduler` - Get scheduler status
- `POST /api/scheduler` - Start scheduler
- `DELETE /api/scheduler` - Stop scheduler

### Health Check

- `GET /health` - Application health status

## 🎯 Usage Guide

### Creating a Backup

1. Click the **"Create Backup"** button
2. Wait for the backup to complete
3. The backup will appear in the table with:
   - Filename with timestamp
   - File size
   - Creation date (relative time)
   - Location (local/remote/both)

### Downloading a Backup

1. Find the backup in the table
2. Click the **"Download"** button
3. The `.sql` file will be downloaded to your computer

### Restoring a Backup

1. Find the backup you want to restore
2. Click the **"Restore"** button
3. Confirm the restoration (this will overwrite current data!)
4. Wait for the restore to complete

⚠️ **Warning**: Restoring a backup will overwrite all current database data!

### Uploading External Backup Files

1. Click **"Upload Backup File"**
2. Select a `.sql` or `.dump` file from your computer
3. Wait for upload success, then restore it from the backup table when needed

### Deleting a Backup

1. Find the backup to delete
2. Click the **"Delete"** button
3. Confirm the deletion
4. The backup will be removed from local and/or remote storage

### Configuring Database Connection

1. Click the **"Configure"** button
2. Enter your database credentials:
   - Host
   - Port
   - Username
   - Password
   - Database name
3. Click **"Save Configuration"**

The configuration is stored temporarily in memory and will reset to environment variables on restart.

### Using Auto-Backup Scheduler

1. Toggle the **"Auto-Backup"** switch to enable
2. The scheduler will run based on `BACKUP_SCHEDULE` cron expression
3. Each scheduled backup automatically applies retention policy
4. Toggle off to stop the scheduler

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down

# Rebuild after changes
docker compose up -d --build
```

### Using Docker CLI

```bash
# Build image
docker build -t postgres-backup-manager .

# Run container
docker run -d \
  --name postgres-backup \
  -p 7050:7050 \
  -v backup_data:/app/backups \
  -e DB_HOST=your-host \
  -e DB_PORT=5432 \
  -e DB_USER=postgres \
  -e DB_PASSWORD=your_password \
  -e DB_NAME=postgres \
  postgres-backup-manager

# View logs
docker logs -f postgres-backup
```

### Persistent Storage

Backups are stored in a Docker volume named `backup_data`. To backup or restore this volume:

```bash
# Backup volume to tar file
docker run --rm -v backup_data:/backups -v $(pwd):/backup ubuntu tar czf /backup/backups.tar.gz /backups

# Restore volume from tar file
docker run --rm -v backup_data:/backups -v $(pwd):/backup ubuntu tar xzf /backup/backups.tar.gz -C /
```

## 🔧 Troubleshooting

### IPv6 Connectivity Issues (Supabase)

**Problem**: Supabase databases often use IPv6-only addresses. If your Docker host doesn't have IPv6 internet connectivity, the app can't connect from inside Docker.

**Solutions**:

1. **Run outside Docker** (Recommended for Supabase):

   ```bash
   yarn install
   yarn start
   ```

2. **Enable IPv6 in Docker**:

   - Edit `/etc/docker/daemon.json`:
     ```json
     {
       "ipv6": true,
       "fixed-cidr-v6": "2001:db8:1::/64"
     }
     ```
   - Restart Docker: `sudo systemctl restart docker`

3. **Use IPv4 Database**: Configure your Supabase project to use IPv4 or use a different database provider

### Connection Errors

**Error**: `ECONNREFUSED` or `Connection timeout`

**Causes & Solutions**:

- Verify database host, port, and credentials in `.env`
- Check firewall rules allow outbound connections to database
- Ensure database accepts connections from your IP
- For local databases in Docker, use `host.docker.internal` instead of `localhost`

### pg_dump/psql Not Found

**Error**: `pg_dump: command not found`

**Solutions**:

- **Docker**: PostgreSQL client is pre-installed in the image
- **Local**: Install PostgreSQL client tools:

  ```bash
  # Ubuntu/Debian
  sudo apt-get install postgresql-client

  # macOS
  brew install postgresql
  ```

### Permission Denied

**Error**: `EACCES: permission denied, mkdir '/app/backups'`

**Solutions**:

- Check Docker volume permissions
- Ensure the application runs as the correct user (nodejs:1001)
- Rebuild Docker image: `docker compose up -d --build`

### Backup Failed: Disk Space

**Error**: `ENOSPC: no space left on device`

**Solutions**:

- Check available disk space: `df -h`
- Delete old backups manually
- Reduce `BACKUP_RETENTION_DAYS` to auto-delete sooner
- Increase disk space or use remote-only storage

### S3 Upload Failed

**Error**: `S3 upload failed: Access Denied`

**Causes & Solutions**:

- Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
- Check bucket exists and credentials have write permissions
- For Supabase S3: Ensure `AWS_S3_ENDPOINT` is set correctly
- For MinIO/custom S3: Set `AWS_S3_FORCE_PATH_STYLE=true`

### Scheduler Not Running

**Problem**: Auto-backup scheduler doesn't execute

**Solutions**:

- Check `BACKUP_AUTO=true` in environment
- Verify `BACKUP_SCHEDULE` is a valid cron expression
- Check logs for scheduler errors: `docker compose logs -f`
- Restart the application

## 🔒 Security Considerations

### Network Security

- Deploy behind a reverse proxy (nginx, Caddy) with HTTPS
- Use firewall rules to restrict access to trusted networks
- Consider adding authentication middleware for production

### Credential Management

- Never commit `.env` file to version control
- Use Docker secrets or environment management tools in production
- Rotate database credentials regularly

### Backup Security

- Encrypt backups before uploading to remote storage
- Use private S3 buckets with restricted access policies
- Enable S3 bucket versioning for backup recovery

### Database Permissions

- Use a dedicated database user with minimal required permissions
- For backups: `SELECT` on all tables
- For restores: `CREATE`, `INSERT`, `UPDATE`, `DELETE`

## 📊 Monitoring & Logging

### Application Logs

**Docker**:

```bash
docker compose logs -f backup-app
```

**Local**:

```bash
yarn start
# Logs appear in console
```

### Log Rotation (Docker)

Configured in `docker-compose.yml`:

- Max size: 10MB per file
- Max files: 3
- Total log storage: ~30MB

### Health Monitoring

```bash
# Check health status
curl http://localhost:7050/health

# Response
{"status":"ok","timestamp":"2025-11-04T10:30:00.000Z"}
```

## 🚀 Production Deployment

### Recommended Setup

1. **Use Docker Compose** for easy deployment
2. **Enable HTTPS** with reverse proxy (nginx, Caddy, Traefik)
3. **Set up monitoring** with health checks
4. **Configure backups** to remote storage (S3)
5. **Enable auto-backup** with appropriate schedule
6. **Set retention policy** based on compliance requirements

### Example nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name backup.example.com;

    location / {
        proxy_pass http://localhost:7050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Environment-Specific Configuration

**Development**:

```env
NODE_ENV=development
BACKUP_AUTO=false
BACKUP_STORAGE=local
```

**Production**:

```env
NODE_ENV=production
BACKUP_AUTO=true
BACKUP_STORAGE=both
BACKUP_RETENTION_DAYS=30
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - feel free to use this project for any purpose.

## 🙏 Acknowledgments

- Built with [Express.js](https://expressjs.com/)
- UI inspired by [Ant Design](https://ant.design/)
- Icons from [Material Design Icons](https://materialdesignicons.com/)
- Date formatting by [Day.js](https://day.js.org/)

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Review application logs
3. Open an issue on GitHub

---

**Made with ❤️ for PostgreSQL backup management**
