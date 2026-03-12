# SSL Setup with Let's Encrypt

## Prerequisites

- Domain name pointing to your VPS (e.g., `rrg.yourdomain.com`)
- Docker and Docker Compose installed
- Ports 80 and 443 open on firewall

## Step 1: Install Certbot

```bash
# On Ubuntu/Debian
sudo apt update
sudo apt install -y certbot

# On CentOS/RHEL
sudo yum install -y certbot
```

## Step 2: Obtain SSL Certificate

### Option A: Standalone mode (recommended for Docker)

Stop nginx temporarily, then run:

```bash
# Stop nginx if running
docker compose -f docker-compose.prod.yml stop nginx

# Get certificate
sudo certbot certonly --standalone \
  -d rrg.yourdomain.com \
  -d www.rrg.yourdomain.com \
  --email your@email.com \
  --agree-tos \
  --no-eff-email \
  --non-interactive
```

### Option B: Webroot mode (if nginx is running)

```bash
# Create webroot directory
sudo mkdir -p /var/www/certbot

# Add volume to nginx for certbot challenge
# (modify docker-compose.prod.yml to add volume mapping)

# Get certificate
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d rrg.yourdomain.com \
  -d www.rrg.yourdomain.com \
  --email your@email.com \
  --agree-tos \
  --no-eff-email \
  --non-interactive
```

## Step 3: Copy Certificates to Docker Volume

```bash
# Create SSL directory in docker volume
mkdir -p /home/sviluppatore/Documenti/salim/docker/ssl

# Copy certificates
sudo cp /etc/letsencrypt/live/rrg.yourdomain.com/fullchain.pem \
  /home/sviluppatore/Documenti/salim/docker/ssl/fullchain.pem

sudo cp /etc/letsencrypt/live/rrg.yourdomain.com/privkey.pem \
  /home/sviluppatore/Documenti/salim/docker/ssl/privkey.pem

# Set permissions
sudo chmod 644 /home/sviluppatore/Documenti/salim/docker/ssl/fullchain.pem
sudo chmod 600 /home/sviluppatore/Documenti/salim/docker/ssl/privkey.pem
```

## Step 4: Enable SSL in Nginx

Edit `docker/nginx/nginx.conf` and uncomment the SSL section:

```nginx
# In the server block:
listen 443 ssl http2;
ssl_certificate /etc/nginx/ssl/fullchain.pem;
ssl_certificate_key /etc/nginx/ssl/privkey.pem;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
ssl_prefer_server_ciphers off;

# Add HTTP to HTTPS redirect in port 80 server block:
return 301 https://$host$request_uri;
```

## Step 5: Restart Docker Compose

```bash
cd /home/sviluppatore/Documenti/salim
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

## Step 6: Auto-Renewal

Let's Encrypt certificates expire after 90 days. Set up automatic renewal:

```bash
# Create renewal script
sudo nano /usr/local/bin/certbot-renew.sh
```

Add content:

```bash
#!/bin/bash
certbot renew --quiet --deploy-hook "systemctl reload nginx"
docker cp /etc/letsencrypt/live/rrg.yourdomain.com/fullchain.pem rrg-nginx:/etc/nginx/ssl/fullchain.pem
docker cp /etc/letsencrypt/live/rrg.yourdomain.com/privkey.pem rrg-nginx:/etc/nginx/ssl/privkey.pem
docker exec rrg-nginx nginx -s reload
```

Make executable:

```bash
sudo chmod +x /usr/local/bin/certbot-renew.sh
```

Add to crontab:

```bash
sudo crontab -e
```

Add line (runs daily at 3am):

```
0 3 * * * /usr/local/bin/certbot-renew.sh
```

## Verify SSL

```bash
# Test certificate
curl -vI https://rrg.yourdomain.com

# Check SSL Labs score
# Visit: https://www.ssllabs.com/ssltest/
```

## Troubleshooting

### Certificate not found

```bash
ls -la /etc/letsencrypt/live/
```

### Nginx fails to start

```bash
docker compose -f docker-compose.prod.yml logs nginx
docker exec rrg-nginx nginx -t
```

### Port 80 blocked

Ensure port 80 is open for certificate renewal:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```
