#!/bin/bash
# Dit script maakt een ZIP backup van het project

ZIP_NAME="desktop_file_manager_backup_20250423_154207.zip"

echo "Backup maken van project naar $ZIP_NAME..."
cd .. && zip -r "backup/$ZIP_NAME" . -x "*node_modules*" "*.git*" "backup/*"

echo "Backup voltooid: $ZIP_NAME"
echo "Je kunt het bestand nu downloaden."
