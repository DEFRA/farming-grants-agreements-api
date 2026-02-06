#!/bin/bash

# Script to receive and display messages from an SQS queue

# Set defaults for testing
QUEUE_NAME="create_agreement_fifo.fifo"
QUEUE_URL="https://sqs.eu-west-2.amazonaws.com/332499610595/create_agreement_fifo.fifo"
AWS_ENDPOINT_URL="https://sqs.eu-west-2.amazonaws.com"
AWS_REGION="eu-west-2"
MAX_MESSAGES=10
WAIT_TIME=1
USE_LOCALSTACK=false

# Show usage information
usage() {
  echo "Usage: $0 [options]"
  echo "Options:"
  echo "  -h                  Show this help message"
  echo "  -l QUEUE_URL        Set the queue URL"
  echo "  -e ENDPOINT_URL     Set the AWS endpoint URL"
  echo "  -r REGION           Set the AWS region"
  echo "  -m MAX_MESSAGES     Maximum number of messages to retrieve (default: 10)"
  echo "  -w WAIT_TIME        Wait time in seconds for long polling (default: 1)"
  echo "  -d                  Delete messages after reading"
  echo "  -L                  Use LocalStack (sets endpoint to http://localhost:4566)"
  echo "  -q QUEUE_NAME       Queue name (for use with LocalStack)"
  exit 0
}

# Process command line options
while getopts ":l:e:r:m:w:dLq:h" opt; do
  case $opt in
    l) QUEUE_URL="$OPTARG" ;;
    e) AWS_ENDPOINT_URL="$OPTARG" ;;
    r) AWS_REGION="$OPTARG" ;;
    m) MAX_MESSAGES="$OPTARG" ;;
    w) WAIT_TIME="$OPTARG" ;;
    d) DELETE_AFTER_READ=true ;;
    L) USE_LOCALSTACK=true ;;
    q) QUEUE_NAME="$OPTARG" ;;
    h) usage ;;
    \?) echo "Invalid option: -$OPTARG" >&2; exit 1 ;;
    :) echo "Option -$OPTARG requires an argument." >&2; exit 1 ;;
  esac
done

# Apply LocalStack settings if requested
if [ "$USE_LOCALSTACK" = true ]; then
  AWS_ENDPOINT_URL="http://localhost:4566"
  QUEUE_URL="$AWS_ENDPOINT_URL/000000000000/$QUEUE_NAME"
  echo "Using LocalStack configuration"
fi

echo "Checking messages on queue: $QUEUE_URL"
echo "Using endpoint: $AWS_ENDPOINT_URL"
echo "----------------------------------------"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed."
    echo "Please install jq first (brew install jq on macOS)"
    exit 1
fi

# Retrieve messages
MESSAGE_JSON=$(aws sqs receive-message \
  --queue-url "$QUEUE_URL" \
  --max-number-of-messages $MAX_MESSAGES \
  --wait-time-seconds $WAIT_TIME \
  --endpoint-url "$AWS_ENDPOINT_URL" \
  --region "$AWS_REGION" \
  --output json)

# Check if messages were found
if [ -z "$MESSAGE_JSON" ] || [ "$MESSAGE_JSON" == "{}" ]; then
  echo "No messages found in queue."
  exit 0
fi

# Parse and display messages
MESSAGES=$(echo "$MESSAGE_JSON" | jq -r '.Messages[]' 2>/dev/null)
if [ $? -ne 0 ] || [ -z "$MESSAGES" ]; then
  echo "No messages found in queue."
  exit 0
fi

MESSAGE_COUNT=$(echo "$MESSAGE_JSON" | jq -r '.Messages | length')
echo "Found $MESSAGE_COUNT messages."
echo "----------------------------------------"

echo "$MESSAGE_JSON" | jq -r '.Messages[] | "MESSAGE ID: \(.MessageId)\nRECEIPT HANDLE: \(.ReceiptHandle)\nBODY:\n\(.Body)\n----------------------------------------"'

# Delete messages if -d flag was provided
if [ "$DELETE_AFTER_READ" = true ]; then
  echo "Deleting messages..."
  echo "$MESSAGE_JSON" | jq -r '.Messages[].ReceiptHandle' | while read -r receipt_handle; do
    aws sqs delete-message \
      --queue-url "$QUEUE_URL" \
      --receipt-handle "$receipt_handle" \
      --endpoint-url "$AWS_ENDPOINT_URL" \
      --region "$AWS_REGION"
    echo "Deleted message with receipt handle: ${receipt_handle:0:20}..."
  done
fi

echo "Done."
