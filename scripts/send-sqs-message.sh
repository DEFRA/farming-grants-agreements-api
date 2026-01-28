#!/bin/bash

# Set defaults for local testing
QUEUE_URL="https://sqs.eu-west-2.amazonaws.com/332499610595/create_agreement_fifo.fifo"
AWS_ENDPOINT_URL="https://sqs.eu-west-2.amazonaws.com"
AWS_REGION="eu-west-2"

# Message payload
read -r -d '' MESSAGE << EOM
{
  "id":"xxxx-xxxx-xxxx-xxxx",
  "source":"fg-gas-backend",
  "specVersion":"1.0",
  "type":"cloud.defra.test.fg-gas-backend.agreement.create",
  "datacontenttype":"application/json",
  "data":{
    "clientRef":"ref-1234",
    "code":"frps-private-beta",
    "createdAt":"2023-10-01T12:00:00Z",
    "submittedAt":"2023-10-01T11:00:00Z",
    "agreementName":"Joe's farm funding 2025",
    "identifiers":{
      "sbi":"106284736",
      "frn":"1234567890",
      "crn":"1234567890",
      "defraId":"1234567890"
    },
    "answers":{
      "scheme":"FPTT",
      "year":2025,
      "hasCheckedLandIsUpToDate":true,
      "actionApplications":[
        {
          "parcelId":"9238",
          "sheetId":"SX0679",
          "code":"CSAM1",
          "appliedFor":{
            "unit":"ha",
            "quantity":20.23
          }
        }
      ]
    }
  }
}
EOM

echo "Sending message to queue: $QUEUE_URL"

# Send message to SQS
aws sqs send-message \
  --queue-url "$QUEUE_URL" \
  --message-body "$MESSAGE" \
  --endpoint-url "$AWS_ENDPOINT_URL" \
  --region "$AWS_REGION"

echo "Message sent successfully!"
