#!/bin/bash

# Stop the container
docker stop farming-grants-agreements-api-cdp-agreement-service-1

# Remove the container
docker rm -f farming-grants-agreements-api-cdp-agreement-service-1

# Remove the image
docker rmi -f farming-grants-agreements-api-cdp-agreement-service

# Remove the associated image
# Get the image ID of the container
# Get the image ID of the target image
image_id=$(docker images --format "{{.Repository}}:{{.Tag}} {{.ID}}" | grep "farming-grants-agreements-api" | awk '{print $2}')

if [ -n "$image_id" ]; then
  echo "Found image: $image_id"

  # Find all containers using that image
  container_ids=$(docker ps -a --filter ancestor="$image_id" --format "{{.ID}}")

  if [ -n "$container_ids" ]; then
    echo "Stopping and removing containers using the image..."
    docker stop $container_ids
    docker rm $container_ids
  else
    echo "No containers found using the image."
  fi

  # Now delete the image
  echo "Removing image..."
  docker rmi "$image_id"
else
  echo "Image not found or already removed."
fi

docker compose up --build -d

docker compose ps --format "table {{.Name}}\t{{.Command}}\t{{.State}}\t{{.Ports}}" | column -t -s $'\t'