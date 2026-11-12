#!/bin/sh
set -e

# Auto-generate TLS certificate if none is mounted/provided
if [ ! -f /etc/nginx/ssl/hesabu.crt ] || [ ! -f /etc/nginx/ssl/hesabu.key ]; then
    echo "Provisioning self-signed TLS certificates for HESABU web container..."
    mkdir -p /etc/nginx/ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/hesabu.key \
        -out /etc/nginx/ssl/hesabu.crt \
        -subj "/C=KE/ST=Nairobi/L=Nairobi/O=HESABU/CN=hesabu.local" 2>/dev/null
    chmod 600 /etc/nginx/ssl/hesabu.key
    echo "Self-signed TLS certificate generated successfully."
fi
