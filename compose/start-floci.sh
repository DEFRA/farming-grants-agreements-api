#!/bin/bash
set -e

echo "🚀 Initializing SNS + SQS in Floci..."

# SQS Queues we listen to
declare -A QUEUES=(
  [grant_application_approved_fifo.fifo]="create_agreement_fifo.fifo" # Grants UI has approved an application, we need to create the agreement in response
  [gas__sns__update_agreement_status_fifo.fifo]="update_agreement_fifo.fifo" # Grants Application Service update (e.g. withdrawn)
  [agreement_status_updated_fifo.fifo]="create_agreement_pdf_fifo.fifo" # We need to create the agreement PDF in response to the offer being accepted
  [create_payment.fifo]="gps__sqs__create_payment.fifo"
  [cancel_payment.fifo]="gps__sqs__cancel_payment.fifo"
)

# SNS Topics we publish to
declare -A TOPICS=(
  [agreement_status_updated_fifo.fifo]="agreement_status_updated_fifo.fifo" # We've updated the agreement status e.g. created/accepted
  [create_agreement_pdf_fifo.fifo]="agreement_status_updated_fifo.fifo"     # - Used to generate the PDF of the agreement
)

# Associative arrays for ARNs and URLs
declare -A TOPIC_ARNS
declare -A QUEUE_URLS
declare -A QUEUE_ARNS

AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_DEFAULT_REGION=eu-west-2

ENDPOINT="${AWS_ENDPOINT:-http://floci:4566}"
run() {
  aws --endpoint-url "$ENDPOINT" "$@"
}

# Create SNS topics
for key in "${!TOPICS[@]}"; do
  topic_name="${TOPICS[$key]}"
  arn="$(run sns create-topic --name "$topic_name" --attributes FifoTopic=true,ContentBasedDeduplication=true --query 'TopicArn' --output text)"
  TOPIC_ARNS[$key]="$arn"
  echo "✅ Created topic: $arn"
done

# Create mock SNS topics tests can use to publish and listen to
for key in "${!QUEUES[@]}"; do
  topic_name="$key"
  arn="$(run sns create-topic --name "$topic_name" --attributes FifoTopic=true,ContentBasedDeduplication=true --query 'TopicArn' --output text)"
  TOPIC_ARNS[$key]="$arn"
  echo "✅ Created topic: $arn"
done

# Create SQS queues and get ARNs
for key in "${!QUEUES[@]}"; do
  queue_name="${QUEUES[$key]}"
  url="$(run sqs create-queue --queue-name "$queue_name" --attributes FifoQueue=true,ContentBasedDeduplication=true --query 'QueueUrl' --output text)"
  arn="$(run sqs get-queue-attributes --queue-url "$url" --attribute-name QueueArn --query "Attributes.QueueArn" --output text)"
  QUEUE_URLS[$key]="$url"
  QUEUE_ARNS[$key]="$arn"
  echo "✅ Created FIFO queue: $url"
done

# Create mock SQS queues tests can use to publish and listen to
for key in "${!TOPICS[@]}"; do
  queue_name="$key"
  url="$(run sqs create-queue --queue-name "$queue_name" --attributes FifoQueue=true,ContentBasedDeduplication=true --query 'QueueUrl' --output text)"
  arn="$(run sqs get-queue-attributes --queue-url "$url" --attribute-name QueueArn --query "Attributes.QueueArn" --output text)"
  QUEUE_URLS[$key]="$url"
  QUEUE_ARNS[$key]="$arn"
  echo "✅ Created FIFO queue: $url"
done

wait_for_topic() {
  local arn="$1"
  local name="$2"
  echo "⏳ Waiting for SNS topic to be available: ${name}"
  for i in {1..10}; do
    if run sns get-topic-attributes --topic-arn "$arn" > /dev/null 2>&1; then
      echo "✅ Topic is now available: ${name}"
      return 0
    fi
    echo "🔄 Still waiting for ${name}..."
    sleep 1
  done
  echo "⚠️  Timeout waiting for topic: ${name}"
}

# Wait for all topics to be available
for key in "${!TOPIC_ARNS[@]}"; do
  wait_for_topic "${TOPIC_ARNS[$key]}" "$key"
done

# Create loopback subscription for each topic
for key in "${!TOPICS[@]}"; do
  run sns subscribe \
    --topic-arn "${TOPIC_ARNS[$key]}" \
    --protocol sqs \
    --notification-endpoint "${QUEUE_ARNS[$key]}"
  echo "🔗 Subscribed topics queue ${QUEUE_ARNS[$key]} to topic: ${TOPIC_ARNS[$key]}"
done

# Subscribe each queue to its mock topic
for key in "${!QUEUES[@]}"; do
  run sns subscribe \
    --topic-arn "${TOPIC_ARNS[$key]}" \
    --protocol sqs \
    --notification-endpoint "${QUEUE_ARNS[$key]}"
  echo "🔗 Subscribed queue ${QUEUE_ARNS[$key]} to topic: ${TOPIC_ARNS[$key]}"
done

echo "✅ SNS and SQS setup complete."
