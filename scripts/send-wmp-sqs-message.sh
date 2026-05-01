#!/usr/bin/env bash
# Send a WMP create-agreement event to the LOCAL Floci/LocalStack SQS queue
# used by docker-compose. Matches the queue/endpoint in compose/aws.env.
#
# Prereqs:
#   1. `docker compose up` is running (farming-grants-agreements-api stack)
#   2. AWS CLI installed locally (uses dummy creds — talks to localstack)
#
# Usage:
#   ./scripts/send-wmp-sqs-message.sh                   # uses random clientRef
#   CLIENT_REF=WMP-MANUAL-001 ./scripts/send-wmp-sqs-message.sh
set -euo pipefail

# ---- Local Floci/LocalStack defaults --------------------------------------
ENDPOINT="${AWS_ENDPOINT:-http://localhost:4566}"
ACCOUNT_ID="${ACCOUNT_ID:-000000000000}"
QUEUE_NAME="${QUEUE_NAME:-create_agreement_fifo.fifo}"
QUEUE_URL="${QUEUE_URL:-${ENDPOINT}/${ACCOUNT_ID}/${QUEUE_NAME}}"

export AWS_REGION="${AWS_REGION:-eu-west-2}"
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"

# ---- Variable bits --------------------------------------------------------
CLIENT_REF="${CLIENT_REF:-WMP-$(date +%Y%m%d%H%M%S)-$RANDOM}"
MESSAGE_ID="${MESSAGE_ID:-$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid)}"
SUBMITTED_AT="${SUBMITTED_AT:-$(date -u +%Y-%m-%dT%H:%M:%S.000Z)}"

# ---- Payload (WMP) --------------------------------------------------------
# Cross-field rules enforced by the WMP Joi schema:
#   totalAgreementPaymentPence === Σ payments.agreement[].agreementTotalPence
#   totalHectaresAppliedFor   ≈ Σ landParcels[].areaHa
read -r -d '' MESSAGE <<EOM || true
{
  "id": "${MESSAGE_ID}",
  "source": "fg-gas-backend",
  "specversion": "1.0",
  "type": "cloud.defra.test.fg-gas-backend.agreement.create",
  "datacontenttype": "application/json",
  "data": {
    "clientRef": "${CLIENT_REF}",
    "metadata": {
      "clientRef": "${CLIENT_REF}",
      "sbi": "106284736",
      "crn": "1100014934",
      "frn": "1234567890",
      "submittedAt": "${SUBMITTED_AT}"
    },
    "identifiers": {
      "sbi": "106284736",
      "crn": "1100014934",
      "frn": "1234567890",
      "defraId": "manual-test"
    },
    "answers": {
      "businessDetailsUpToDate": true,
      "landRegisteredWithRpa": true,
      "landManagementControl": true,
      "publicBodyTenant": false,
      "landHasGrazingRights": false,
      "appLandHasExistingWmp": false,
      "existingWmps": [],
      "intendToApplyHigherTier": false,
      "hectaresTenOrOverYearsOld": 12.5,
      "hectaresUnderTenYearsOld": 3.25,
      "centreGridReference": "SD48414684",
      "fcTeamCode": "FC-NW-01",
      "applicant": {
        "business": {
          "name": "Example Farm Ltd",
          "reference": "SBI106284736",
          "email": "farm@example.com",
          "phone": "01234567890",
          "address": {
            "line1": "The Farm",
            "line2": "Farm Lane",
            "city": "Preston",
            "postalCode": "PR1 2AB"
          }
        },
        "customer": {
          "name": { "title": "Mr", "first": "John", "middle": "A", "last": "Doe" }
        }
      },
      "detailsConfirmedAt": "${SUBMITTED_AT}",
      "totalHectaresAppliedFor": 15.75,
      "guidanceRead": true,
      "includedAllEligibleWoodland": true,
      "applicationConfirmation": true,
      "landParcels": [
        { "parcelId": "SD4841-4684", "areaHa": 12.5 },
        { "parcelId": "SD4842-3020", "areaHa": 3.25 }
      ],
      "totalAgreementPaymentPence": 157500,
      "payments": {
        "agreement": [
          {
            "code": "WMP1",
            "description": "Produce a woodland management plan",
            "activePaymentTier": 1,
            "quantityInActiveTier": 15.75,
            "activeTierRatePence": 10000,
            "activeTierFlatRatePence": 0,
            "quantity": 15.75,
            "agreementTotalPence": 157500,
            "unit": "ha"
          }
        ]
      }
    }
  }
}
EOM

# Pick an AWS CLI: prefer local install, otherwise fall back to the
# amazon/aws-cli docker image already used by floci-init.
if command -v aws >/dev/null 2>&1; then
  AWS=(aws)
  EFFECTIVE_ENDPOINT="$ENDPOINT"
else
  echo "ℹ️  Local 'aws' CLI not found — using amazon/aws-cli via docker."
  # Talk to floci by its compose service name on the shared network.
  COMPOSE_NET="${COMPOSE_NET:-farming-grants-agreements-api_cdp-tenant}"
  EFFECTIVE_ENDPOINT="${DOCKER_AWS_ENDPOINT:-http://floci:4566}"
  EFFECTIVE_QUEUE_URL="${EFFECTIVE_QUEUE_URL:-${EFFECTIVE_ENDPOINT}/${ACCOUNT_ID}/${QUEUE_NAME}}"
  AWS=(docker run --rm --network "$COMPOSE_NET" \
    -e AWS_REGION="$AWS_REGION" \
    -e AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
    -e AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
    amazon/aws-cli)
  QUEUE_URL="$EFFECTIVE_QUEUE_URL"
fi

echo "📨 Endpoint:  $EFFECTIVE_ENDPOINT"
echo "📨 Queue URL: $QUEUE_URL"
echo "📨 clientRef: $CLIENT_REF"
echo "📨 messageId: $MESSAGE_ID"
echo

"${AWS[@]}" sqs send-message \
  --endpoint-url "$EFFECTIVE_ENDPOINT" \
  --region "$AWS_REGION" \
  --queue-url "$QUEUE_URL" \
  --message-group-id "wmp-manual" \
  --message-deduplication-id "$MESSAGE_ID" \
  --message-body "$MESSAGE"

echo
echo "✅ WMP message sent."
echo "   Tail the AS logs and look for the WMP branch:"
echo "     docker compose logs -f farming-grants-agreements-api | grep -i wmp"
echo "   Then check Mongo:"
echo "     docker compose exec mongodb mongosh --quiet --eval \\"
echo "       'db.getSiblingDB(\"fg-agreements\").versions.find({clientRef:\"$CLIENT_REF\"}).pretty()'"


