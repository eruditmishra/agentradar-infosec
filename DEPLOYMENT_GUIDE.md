# AgentRadar Deployment Guide

This guide covers deploying the AgentRadar application on a single server. In this architecture:

- **Server** (Node.js backend) & **Database** (PostgreSQL) run in Docker Compose.
- **Dashboard** (Vite + React frontend) is built statically on the instance and served directly via **Nginx**.

Depending on your environment and infrastructure, you can deploy AgentRadar either **without a domain** (using raw IP addresses) or **with a domain** (with automated SSL/TLS certificates).

---

## Prerequisites (Both Methods)

1. A Linux Server (Ubuntu 22.04+ recommended) with at least 2vCPU and 4GB RAM.
2. **Docker**, **Docker Compose**, and **Node.js/npm** installed.
3. **Nginx** installed (`sudo apt update && sudo apt install nginx`).
4. Git (to clone the repository).

```bash
# Clone the repository
git clone https://gitrepository.citiustech.com/44757/agentradar.git
cd agentradar

# Build the frontend statically
cd dashboard
npm install
npm run build

# Move build files to Nginx web directory
sudo mkdir -p /var/www/agentradar
sudo cp -r dist/* /var/www/agentradar/
sudo chown -R www-data:www-data /var/www/agentradar
cd ..
```

---

## 1. Deployment Without a Domain (IP Based)

Use this method for internal networks, VPNs, or quick proofs-of-concept where an SSL certificate and domain name are not required.

### Configuration

1. Create the `.env` file in the `server` directory with at minimum (a full annotated example is available at [server/.env.example](server/.env.example)):

```env
NODE_ENV=production
JWT_ACCESS_SECRET=<generate with: openssl rand -hex 32>
JWT_REFRESH_SECRET=<generate with: openssl rand -hex 32>
# Required — encrypts connector/integration secrets at rest
DISCOVERY_ENCRYPTION_KEY=<generate with: openssl rand -hex 32>
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=your_secure_password
```
   - **Important**: Because you are not using HTTPS, add `SECURE_COOKIES=false` to the bottom of the `.env` file so your login sessions work over plain HTTP.
2. Start the backend stack:

```bash
# Start the backend and database in detached mode, using ONLY the base
# compose file — the repo also has a docker-compose.override.yml that
# Compose auto-merges by default, which switches the build target to
# `dev` (bind-mounts server/, runs `npm run dev` instead of the compiled
# production build). Exclude it explicitly in production:
docker-compose -f docker-compose.yml up -d --build
```

### Nginx Configuration

Create a new configuration file: `/etc/nginx/sites-available/agentradar`

```nginx
server {
    listen 80;
    server_name _; # Catch-all for IP access

    # Serve the static frontend
    location / {
        root /var/www/agentradar;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Route API traffic to the Node backend
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the configuration and remove the default Nginx page:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/agentradar /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Accessing the Application

- Open your browser and navigate directly to your server's IP: `http://<YOUR_SERVER_IP>`

> [!WARNING]
> Running without a domain means traffic is not encrypted via HTTPS. Do not use this method if exposing the application to the public internet.

---

## 2. Deployment With a Domain (HTTPS / SSL)

Use this method for production environments. This involves placing a reverse proxy (like Nginx, Traefik, or Caddy) in front of the AgentRadar containers to handle SSL termination.

### Prerequisites

1. A registered domain name (e.g., `radar.yourcompany.com`).
2. DNS A records pointing your domain to your server's public IP address.
3. Port `80` and `443` open on your server's firewall.

### Using Nginx and Certbot (Recommended)

**1. Install Certbot**

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

**2. Configure Nginx**
Create a new configuration file for AgentRadar: `/etc/nginx/sites-available/agentradar`

```nginx
server {
    listen 80;
    server_name radar.yourcompany.com;

    # Serve the static frontend
    location / {
        root /var/www/agentradar;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Route API traffic to the Node backend
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the configuration and remove the default Nginx page:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/agentradar /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**3. Obtain an SSL Certificate**
Run Certbot to automatically configure SSL for your domain:

```bash
sudo certbot --nginx -d radar.yourcompany.com
```

### Using Manual SSL Certificates (If you already have a .cer/.crt file)

If you already have your own SSL certificate (e.g., a `.cer` or `.crt` file provided by your IT department or a CA), you cannot use it alone—you **must** also have the corresponding **private key** (`.key` file) that was generated alongside the CSR.

**1. Place your Certificates securely**
Upload your certificate and private key to the server and place them in the standard SSL directories:

```bash
sudo cp your_domain.cer /etc/ssl/certs/radar.yourcompany.com.cer
sudo cp your_domain.key /etc/ssl/private/radar.yourcompany.com.key
    sudo chmod 600 /etc/ssl/private/radar.yourcompany.com.key
```

**2. Configure Nginx for Manual SSL**
Create the Nginx configuration file: `/etc/nginx/sites-available/agentradar`

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name radar.yourcompany.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name radar.yourcompany.com;

    ssl_certificate /etc/ssl/certs/radar.yourcompany.com.cer;
    ssl_certificate_key /etc/ssl/private/radar.yourcompany.com.key;

    # Recommended SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Serve the static frontend
    location / {
        root /var/www/agentradar;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Route API traffic to the Node backend
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the configuration and remove the default Nginx page:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/agentradar /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**4. Update Microsoft SSO (If Enabled)**
If you are using Microsoft SSO, update your `server/.env` file to use the secure domain callback:

```env
MICROSOFT_REDIRECT_URI=https://radar.yourcompany.com/api/auth/microsoft/callback
```

_Ensure you also update the Redirect URI in your Azure Entra ID App Registration._

### Starting the Stack

Ensure the backend is running in the root directory (excluding the dev-only `docker-compose.override.yml`, as noted above):

```bash
docker-compose -f docker-compose.yml up -d --build
```

### Accessing the Application

- **Dashboard**: Securely access `https://radar.yourcompany.com`

> [!TIP]
> The Nginx reverse proxy serves your compiled frontend statically and routes backend API requests to port 3000 securely.

---

## 3. Initial Setup (Creating the Admin User)

Once your stack is running, you need to create the initial super-admin user to log into the Dashboard.

The `server/.env` file contains two variables for this:

- `ADMIN_EMAIL=admin@yourcompany.com`
- `ADMIN_PASSWORD=your_secure_password` _(Optional. If left blank, a secure random password will be generated for you)_

Run the seed script inside the Docker container:

```bash
    docker-compose exec agentradar npm run seed:admin
```

If you did not provide a password in the `.env` file, the script will output a securely generated password for you to use.
