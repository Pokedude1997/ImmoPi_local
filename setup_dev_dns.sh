#!/bin/bash

# ImmoPi Development Setup Script
# Sets up DNS name for development with hot-reload

echo "🚀 ImmoPi Development Setup with DNS Name"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  This script needs root privileges to edit /etc/hosts"
    echo "Please run with sudo:"
    echo "   sudo bash setup_dev_dns.sh"
    exit 1
fi

# Add DNS entry
HOSTS_FILE="/etc/hosts"
DNS_ENTRY="192.168.1.18 immopi.local"

# Check if entry already exists
if grep -q "immopi.local" "$HOSTS_FILE"; then
    echo "✅ DNS entry for immopi.local already exists in $HOSTS_FILE"
else
    echo "📝 Adding DNS entry to $HOSTS_FILE..."
    echo "$DNS_ENTRY" >> "$HOSTS_FILE"
    echo "✅ DNS entry added successfully"
fi

echo ""
echo "📋 Setup Complete!"
echo ""
echo "To use the development environment with hot-reload:"
echo ""
echo "1. Start the backend server:"
echo "   cd /home/cmacharski/ImmoPi_local/server"
echo "   node server.js &"
echo ""
echo "2. Start the frontend dev server:"
echo "   cd /home/cmacharski/ImmoPi_local"
echo "   npm run dev &"
echo ""
echo "3. Access the application via:"
echo "   http://immopi.local:3000"
echo ""
echo "✅ Cookies will now work properly across frontend and backend!"
echo ""
echo "To verify DNS setup:"
echo "   ping immopi.local"
echo ""
