#!/bin/bash
set -e

# Match the region your JS app uses by default
export AWS_REGION=eu-west-2
export AWS_DEFAULT_REGION=eu-west-2
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test

echo "🚀 Initializing SNS + SQS in LocalStack..."

TOPIC_NAME="grant_application_approved"
QUEUE_NAME="create_agreement"

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
  --notification-endpoint "$QUEUE_ARN" \
  --attributes '{ "RawMessageDelivery": "true"}'
echo "🔗 Subscribed queue to topic."

# Create extra SNS topic and SQS queue for agreement_accepted
EXTRA_TOPIC_NAME="agreement_accepted"
EXTRA_QUEUE_NAME="gas_agreement_accepted"

# Create SNS topic and capture ARN
EXTRA_TOPIC_ARN=$(awslocal sns create-topic --name "$EXTRA_TOPIC_NAME" --query 'TopicArn' --output text)
echo "✅ Created extra topic: $EXTRA_TOPIC_ARN"

# Create SQS queue
EXTRA_QUEUE_URL=$(awslocal sqs create-queue --queue-name "$EXTRA_QUEUE_NAME" --query 'QueueUrl' --output text)
EXTRA_QUEUE_ARN=$(awslocal sqs get-queue-attributes --queue-url "$EXTRA_QUEUE_URL" --attribute-name QueueArn --query "Attributes.QueueArn" --output text)
echo "✅ Created extra queue: $EXTRA_QUEUE_URL"

# Retry loop to ensure extra topic is fully registered
echo "⏳ Waiting for extra SNS topic to be available..."
for i in {1..5}; do
  if awslocal sns get-topic-attributes --topic-arn "$EXTRA_TOPIC_ARN" > /dev/null 2>&1; then
    echo "✅ Extra topic is now available."
    break
  fi
  echo "🔄 Still waiting for extra topic..."
  sleep 1
done

# Subscribe extra queue to extra topic
awslocal sns subscribe \
  --topic-arn "$EXTRA_TOPIC_ARN" \
  --protocol sqs \
  --notification-endpoint "$EXTRA_QUEUE_ARN" \
  --attributes '{ "RawMessageDelivery": "true"}'
echo "🔗 Subscribed extra queue to extra topic."

# Optional extras
# awslocal s3 mb s3://my-bucket
# awslocal sqs create-queue --queue-name my-queue

echo "✅ SNS and SQS setup complete."
