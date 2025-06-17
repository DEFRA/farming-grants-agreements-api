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
AGREEMENT_ACCEPTED_TOPIC_NAME="agreement_accepted"
AGREEMENT_ACCEPTED_QUEUE_NAME="gas_agreement_accepted"

# Create SNS topic and capture ARN
AGREEMENT_ACCEPTED_TOPIC_ARN=$(awslocal sns create-topic --name "$AGREEMENT_ACCEPTED_TOPIC_NAME" --query 'TopicArn' --output text)
echo "✅ Created agreement_accepted topic: $AGREEMENT_ACCEPTED_TOPIC_ARN"

# Create SQS queue
AGREEMENT_ACCEPTED_QUEUE_URL=$(awslocal sqs create-queue --queue-name "$AGREEMENT_ACCEPTED_QUEUE_NAME" --query 'QueueUrl' --output text)
AGREEMENT_ACCEPTED_QUEUE_ARN=$(awslocal sqs get-queue-attributes --queue-url "$AGREEMENT_ACCEPTED_QUEUE_URL" --attribute-name QueueArn --query "Attributes.QueueArn" --output text)
echo "✅ Created gas_agreement_accepted queue: $AGREEMENT_ACCEPTED_QUEUE_URL"

# Retry loop to ensure agreement_accepted topic is fully registered
echo "⏳ Waiting for agreement_accepted SNS topic to be available..."
for i in {1..5}; do
  if awslocal sns get-topic-attributes --topic-arn "$AGREEMENT_ACCEPTED_TOPIC_ARN" > /dev/null 2>&1; then
    echo "✅ agreement_accepted topic is now available."
    break
  fi
  echo "🔄 Still waiting for agreement_accepted topic..."
  sleep 1
done

# Subscribe gas_agreement_accepted queue to agreement_accepted topic
awslocal sns subscribe \
  --topic-arn "$AGREEMENT_ACCEPTED_TOPIC_ARN" \
  --protocol sqs \
  --notification-endpoint "$AGREEMENT_ACCEPTED_QUEUE_ARN" \
  --attributes '{ "RawMessageDelivery": "true"}'
echo "🔗 Subscribed gas_agreement_accepted queue to agreement_accepted topic."

# Optional extras
# awslocal s3 mb s3://my-bucket
# awslocal sqs create-queue --queue-name my-queue

echo "✅ SNS and SQS setup complete."
