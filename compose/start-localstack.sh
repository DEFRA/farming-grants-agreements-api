#!/bin/bash
set -e

# Match the region your JS app uses by default
export AWS_REGION=eu-west-2
export AWS_DEFAULT_REGION=eu-west-2
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test

echo "🚀 Initializing SNS + SQS in LocalStack..."

TOPIC_NAME="application-approved-topic"
QUEUE_NAME="application-approved-queue"

# Create SNS topic and capture ARN
TOPIC_ARN=$(awslocal sns create-topic --name "$TOPIC_NAME" --query 'TopicArn' --output text)
echo "✅ Created topic: $TOPIC_ARN"

# Create SQS queue
QUEUE_URL=$(awslocal sqs create-queue --queue-name "$QUEUE_NAME" --query 'QueueUrl' --output text)
QUEUE_ARN=$(awslocal sqs get-queue-attributes --queue-url "$QUEUE_URL" --attribute-name QueueArn --query "Attributes.QueueArn" --output text)
echo "✅ Created queue: $QUEUE_URL"

# Retry loop to ensure topic is fully registered
echo "⏳ Waiting for SNS topic to be available..."
for i in {1..5}; do
  if awslocal sns get-topic-attributes --topic-arn "$TOPIC_ARN" > /dev/null 2>&1; then
    echo "✅ Topic is now available."
    break
  fi
  echo "🔄 Still waiting..."
  sleep 1
done

# Subscribe queue to topic
awslocal sns subscribe \
  --topic-arn "$TOPIC_ARN" \
  --protocol sqs \
  --notification-endpoint "$QUEUE_ARN"
echo "🔗 Subscribed queue to topic."

# Optional extras
# awslocal s3 mb s3://my-bucket
# awslocal sqs create-queue --queue-name my-queue

echo "✅ SNS and SQS setup complete."
