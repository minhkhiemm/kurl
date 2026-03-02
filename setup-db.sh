#!/bin/bash

echo "Setting up PostgreSQL database for kurl..."

# Stop and remove existing containers and volumes
docker-compose down -v

# Start PostgreSQL
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 5

# Check if database exists, if not it should be created automatically by POSTGRES_DB env var
docker exec kurl-postgres psql -U kurl -lqt | cut -d \| -f 1 | grep -qw kurl
if [ $? -eq 0 ]; then
    echo "✅ Database 'kurl' exists and is ready!"
else
    echo "❌ Database 'kurl' was not created automatically"
    echo "Creating database manually..."
    docker exec kurl-postgres createdb -U kurl kurla
fi

echo ""
echo "Database connection details:"
echo "  Host: localhost"
echo "  Port: 5444"
echo "  Database: kurl"
echo "  User: kurl"
echo "  Password: kurl"
echo ""
echo "DATABASE_URL=postgres://kurl:kurl@localhost:5444/kurl"
