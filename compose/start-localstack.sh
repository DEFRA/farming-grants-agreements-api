#!/bin/bash
set -e

# Match the region your JS app uses by default
export AWS_REGION=eu-west-2
export AWS_DEFAULT_REGION=eu-west-2
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test

echo "🚀 Initializing SNS + SQS in LocalStack..."

TOPIC_OFFER_CREATED_NAME="grant_offer_created"
TOPIC_OFFER_ACCEPTED_NAME="grant_offer_accepted"
TOPIC_APPLICATION_APPROVED_NAME="grant_application_approved"

# Create SNS topic and capture ARN
TOPIC_OFFER_CREATED_ARN=$(awslocal sns create-topic --name "$TOPIC_OFFER_CREATED_NAME" --query 'TopicArn' --output text)
echo "✅ Created topic: $TOPIC_OFFER_CREATED_ARN"

TOPIC_OFFER_ACCEPTED_ARN=$(awslocal sns create-topic --name "$TOPIC_OFFER_ACCEPTED_NAME" --query 'TopicArn' --output text)
echo "✅ Created topic: $TOPIC_OFFER_ACCEPTED_ARN"

TOPIC_APPLICATION_APPROVED_ARN=$(awslocal sns create-topic --name "$TOPIC_APPLICATION_APPROVED_NAME" --query 'TopicArn' --output text)
echo "✅ Created topic: $TOPIC_APPLICATION_APPROVED_ARN"

# Create SQS queue
QUEUE_OFFER_CREATED_NAME="create_agreement"
QUEUE_OFFER_CREATED_URL=$(awslocal sqs create-queue --queue-name "$QUEUE_OFFER_CREATED_NAME" --query 'QueueUrl' --output text)
QUEUE_OFFER_CREATED_ARN=$(awslocal sqs get-queue-attributes --queue-url "$QUEUE_OFFER_CREATED_URL" --attribute-name QueueArn --query "Attributes.QueueArn" --output text)
echo "✅ Created queue: $QUEUE_OFFER_CREATED_URL"

QUEUE_OFFER_ACCEPTED_NAME="accept_offer"
QUEUE_OFFER_ACCEPTED_URL=$(awslocal sqs create-queue --queue-name "$QUEUE_OFFER_ACCEPTED_NAME" --query 'QueueUrl' --output text)
QUEUE_OFFER_ACCEPTED_ARN=$(awslocal sqs get-queue-attributes --queue-url "$QUEUE_OFFER_ACCEPTED_URL" --attribute-name QueueArn --query "Attributes.QueueArn" --output text)
echo "✅ Created queue: $QUEUE_OFFER_ACCEPTED_URL"

QUEUE_APPLICATION_APPROVED_NAME="application_approved"
QUEUE_APPLICATION_APPROVED_URL=$(awslocal sqs create-queue --queue-name "$QUEUE_APPLICATION_APPROVED_NAME" --query 'QueueUrl' --output text)
QUEUE_APPLICATION_APPROVED_ARN=$(awslocal sqs get-queue-attributes --queue-url "$QUEUE_APPLICATION_APPROVED_URL" --attribute-name QueueArn --query "Attributes.QueueArn" --output text)
echo "✅ Created queue: $QUEUE_APPLICATION_APPROVED_URL"

wait_for_topic() {
  local arn="$1"
  local name="$2"
  echo "⏳ Waiting for SNS topic to be available: ${name}"
  for i in {1..10}; do
    if awslocal sns get-topic-attributes --topic-arn "$arn" > /dev/null 2>&1; then
      echo "✅ Topic is now available: ${name}"
      return 0
    fi
    echo "🔄 Still waiting for ${name}..."
    sleep 1
  done
  echo "⚠️  Timeout waiting for topic: ${name}"
}

# Ensure all topics are fully registered
wait_for_topic "$TOPIC_OFFER_CREATED_ARN" "$TOPIC_OFFER_CREATED_NAME"
wait_for_topic "$TOPIC_OFFER_ACCEPTED_ARN" "$TOPIC_OFFER_ACCEPTED_NAME"
wait_for_topic "$TOPIC_APPLICATION_APPROVED_ARN" "$TOPIC_APPLICATION_APPROVED_NAME"

# Subscribe queue to topic
awslocal sns subscribe \
  --topic-arn "$TOPIC_OFFER_CREATED_ARN" \
  --protocol sqs \
  --notification-endpoint "$QUEUE_OFFER_CREATED_ARN" \
  --attributes '{ "RawMessageDelivery": "true"}'
echo "🔗 Subscribed queue to topic: $QUEUE_OFFER_CREATED_ARN"

awslocal sns subscribe \
  --topic-arn "$TOPIC_OFFER_ACCEPTED_ARN" \
  --protocol sqs \
  --notification-endpoint "$QUEUE_OFFER_ACCEPTED_ARN" \
  --attributes '{ "RawMessageDelivery": "true"}'
echo "🔗 Subscribed queue to topic: $QUEUE_OFFER_ACCEPTED_ARN"

awslocal sns subscribe \
  --topic-arn "$TOPIC_APPLICATION_APPROVED_ARN" \
  --protocol sqs \
  --notification-endpoint "$QUEUE_APPLICATION_APPROVED_ARN" \
  --attributes '{ "RawMessageDelivery": "true"}'
echo "🔗 Subscribed queue to topic: $QUEUE_APPLICATION_APPROVED_ARN"

# Optional extras
# awslocal s3 mb s3://my-bucket
# awslocal sqs create-queue --queue-name my-queue

echo "✅ SNS and SQS setup complete."
