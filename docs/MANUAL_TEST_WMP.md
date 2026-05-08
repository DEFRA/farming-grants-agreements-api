# Manual Test: WMP Create Agreement (local)

End-to-end smoke test for the WMP create-agreement flow against the local
docker-compose stack (Floci + LocalStack + MongoDB + Agreements Service).

## 1. Prerequisites

- Docker / Docker Compose installed
- AWS CLI installed locally (talks to LocalStack with dummy credentials)
- `uuidgen` available (or Linux `/proc/sys/kernel/random/uuid` fallback — the
  script handles both)
- This repo cloned, working dir = `farming-grants-agreements-api/`

## 2. Bring the stack up

The Agreements Service container itself is gated behind the `full` compose
profile, so include it explicitly:

```bash
cd farming-grants-agreements-api
docker compose --profile full up -d
```

(First run will build the AS image — a few minutes. Subsequent runs are fast.)

> ⚠️ The `farming-grants-agreements-api` service is gated behind the `full`
> compose profile — a plain `docker compose up -d` will only start
> Floci + MongoDB and the AS itself will NOT run. Always pass
> `--profile full` (and use it again for `logs` / `down`).

Wait for the services to settle (first run builds the image, ~1–3 min;
subsequent runs ~20–40s). You can watch the AS come up:

```bash
docker compose --profile full logs -f farming-grants-agreements-api | head -n 50
```

Or block until it's healthy:

```bash
until curl -sf http://localhost:3555/health >/dev/null; do echo "waiting…"; sleep 2; done && echo "✅ up"
```

## 3. Send a WMP message onto the SQS queue

A helper script is provided that posts a valid WMP `agreement.create` event
to the local LocalStack FIFO queue used by the AS:

```bash
./scripts/send-wmp-sqs-message.sh
```

It generates a fresh `clientRef` (prefixed `WMP-…`) and `messageId` each
run. To pin them:

```bash
CLIENT_REF=WMP-MANUAL-001 \
MESSAGE_ID=11111111-2222-3333-4444-555555555555 \
./scripts/send-wmp-sqs-message.sh
```

Output ends with the `clientRef` and `messageId` it used — keep these for
the verification step.

## 4. Verify the AS picked it up (logs)

```bash
docker compose logs -f farming-grants-agreements-api | grep -iE 'wmp|agreement'
```

You should see the WMP branch fire (the `if (isWmp(payload))` dispatch in
`create-offer.js`) and a successful insert via `createAgreementWithVersions`
with `ignorePayments: false`.

## 5. Verify the agreement is in Mongo

> ℹ️ The Mongo database is named **`farming-grants-agreements-api`** (driven
> by `mongo.databaseName` in `src/config/index.js`). Older docs referring to
> `fg-agreements` are out of date.

Replace `WMP-MANUAL-001` with the `clientRef` printed by the script:

```bash
docker compose exec mongodb mongosh --quiet --eval \
  'db.getSiblingDB("farming-grants-agreements-api").versions.find({clientRef:"WMP-MANUAL-001"}).pretty()'
```

Expected:

- `status: "offered"`
- `scheme: "WMP"`
- `payment` populated (NOT `null`)
- `payment.frequency: "OneOff"`
- `payment.payments[0].paymentDate: null` (paid on signature)
- `payment.agreementTotalPence === 157500` (matches the fixture sum)

Also check the parent agreement doc. **Note**: `findOrCreateAgreement`
matches on `sbi` only, so if SBI `106284736` (the fixture's SBI) already
exists in seed data, the new WMP version attaches to the existing
agreement and you won't find an `agreements` row by the WMP `clientRef`.
Look it up by `sbi` instead:

```bash
docker compose exec mongodb mongosh --quiet --eval \
  'db.getSiblingDB("farming-grants-agreements-api").agreements.find({sbi:"106284736"}).pretty()'
```

## 6. Confirm Land Grants was NOT called (AC4)

There is no outbound HTTP to `land-grants-api` during create. If the
`land-grants-api` service is in the compose stack you can confirm by
tailing its logs and seeing **no** `calculatePaymentsBasedOnParcelsWithActions`
hit during the WMP flow:

```bash
docker compose logs --since=1m land-grants-api | grep -i payment || echo "✅ no land-grants calls"
```

## 7. (Optional) Test the GET path

Pull the agreement back via the API and confirm the persisted payment is
returned verbatim (no Land Grants lookup). Replace the agreement number
with the one stored in Mongo:

```bash
curl -sS http://localhost:3555/agreements/<agreementNumber> | jq '.payment.frequency, .payment.agreementTotalPence'
```

## 8. (Optional) Test accept

```bash
curl -sS -X POST http://localhost:3555/agreements/<agreementNumber>/accept | jq '.status, .payment.frequency'
# expect: "accepted", "OneOff" — payment subdoc unchanged
```

## 9. Re-run / cleanup

The schema enforces dedup on `notificationMessageId` (the script's
`MESSAGE_ID`). Re-running the script picks a fresh id by default; pass
the same `MESSAGE_ID` to test the dedup path.

To wipe and start fresh:

```bash
docker compose --profile full down -v
docker compose --profile full up -d
```

## Common gotchas

- **Cross-field validation failure** — if you edit the payload inline,
  remember `totalAgreementPaymentPence` MUST equal the sum of
  `payments.agreement[].agreementTotalPence`, and `totalHectaresAppliedFor`
  MUST equal the sum of `landParcels[].areaHa` (±0.01).
- **`clientRef` doesn't start with `wmp`** — the WMP branch won't trigger
  and the legacy `createOffer` path will reject the payload (no
  `application.parcels[]`).
- **Queue URL mismatch** — if you've changed `compose/aws.env`, override
  `QUEUE_NAME` / `QUEUE_URL` env vars when invoking the script.
