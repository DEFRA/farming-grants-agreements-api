#!/usr/bin/env bash
# Logs SQS messages to LocalStack logs, with continuous queue discovery.
set -euo pipefail

: "${ENABLE_SQS_LOGGER:=1}"                 # 1=on, 0=off
: "${SQS_LOGGER_DELETE:=0}"                 # 1=delete after printing (safer default: 0)
: "${SQS_LOGGER_SHOW_FULL_BODY:=0}"         # 1=print full JSON payload
: "${SQS_LOGGER_QUEUE_FILTER:=}"            # regex: include only matching queue names
: "${SQS_LOGGER_EXPECT_TYPES:=}"            # comma list of CloudEvent types to show
: "${SQS_LOGGER_ACCEPT_TOPIC_ARNS:=}"       # comma list of allowed SNS TopicArns
: "${SQS_LOGGER_WAIT_TIME:=20}"             # long-poll seconds (1..20)
: "${SQS_LOGGER_MAX_MSGS:=10}"              # batch size (1..10)
: "${SQS_LOGGER_DISCOVERY_INTERVAL:=5}"     # seconds between queue discovery scans

export AWS_REGION="${AWS_REGION:-eu-west-2}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-eu-west-2}"
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"

[[ "$ENABLE_SQS_LOGGER" != "1" ]] && { echo "ℹ️  SQS logger disabled"; exit 0; }

echo "🛰️  Starting SQS receipt logger (delete=${SQS_LOGGER_DELETE}, show_full_body=${SQS_LOGGER_SHOW_FULL_BODY})..."

normalize_qurl() {
  # Rebuild to localhost:4566 while preserving /{account}/{queue}
  # Works for weird hosts like sqs.eu-west-2.127.0.0.1:4566
  local in="$1"
  local acct name
  acct="$(echo "$in" | awk -F/ '{print $(NF-1)}')"
  name="$(echo "$in" | awk -F/ '{print $NF}')"
  echo "http://localhost:4566/${acct}/${name}"
}

to_regex() {
  local list="${1:-}"
  [[ -z "$list" ]] && { echo ""; return; }
  local IFS=','; read -ra arr <<<"$list"
  local out=""
  for v in "${arr[@]}"; do
    v="${v//\./\\.}"; v="${v//\*/.*}"; v="${v//\?/\.}"
    out+="^${v}\$|"
  done
  echo "${out%|}"
}
TYPES_RX="$(to_regex "$SQS_LOGGER_EXPECT_TYPES")"
TOPICS_RX="$(to_regex "$SQS_LOGGER_ACCEPT_TOPIC_ARNS")"

ATTACHED_NAMES=""

is_attached() { [[ " $ATTACHED_NAMES " == *" $1 "* ]]; }
mark_attached() { ATTACHED_NAMES="$ATTACHED_NAMES $1"; }

have_python=0; command -v python3 >/dev/null 2>&1 && have_python=1

poll_queue() {
  local qurl="$1"
  local qname; qname="$(basename "$qurl")"
  local qurl_norm; qurl_norm="$(normalize_qurl "$qurl")"

  # Optional filter by name
  if [[ -n "$SQS_LOGGER_QUEUE_FILTER" ]] && ! [[ "$qname" =~ $SQS_LOGGER_QUEUE_FILTER ]]; then
    echo "🙈 Skipping queue (filter): $qname"
    return 0
  fi

  mark_attached "$qname"
  (
    echo "📡 Logger attached to queue: $qname ($qurl)"
    while true; do
      resp="$(awslocal sqs receive-message \
        --queue-url "$qurl_norm" \
        --wait-time-seconds "${SQS_LOGGER_WAIT_TIME}" \
        --max-number-of-messages "${SQS_LOGGER_MAX_MSGS}" \
        --message-attribute-names All \
        --attribute-names All \
        --output json 2>/_tmp_err || true)"

      if [[ -s /_tmp_err ]]; then
        echo "⚠️  receive-message error on $qname: $(cat /_tmp_err)"
        : > /_tmp_err
      fi

      if [[ "$have_python" -eq 1 ]]; then
        out="$(python3 - "$qurl_norm" "$qname" "$SQS_LOGGER_SHOW_FULL_BODY" "$SQS_LOGGER_DELETE" "$TYPES_RX" "$TOPICS_RX" <<'PY' || true
import sys, json, datetime, re
qurl, qname, show_full_body, do_delete, types_rx, topics_rx = sys.argv[1:7]
show_full_body = (show_full_body == "1")
do_delete = (do_delete == "1")
types_re = re.compile(types_rx) if types_rx else None
topics_re = re.compile(topics_rx) if topics_rx else None
now = lambda: datetime.datetime.utcnow().isoformat(timespec="seconds")+"Z"
data = json.loads(sys.stdin.read() or "{}")
msgs = data.get("Messages") or []
to_delete = []
def parse_body(body_text):
    try: obj = json.loads(body_text)
    except Exception: return (None, None, False)
    if isinstance(obj, dict) and "Message" in obj and "TopicArn" in obj:
        inner_text = obj.get("Message",""); topic_arn = obj.get("TopicArn")
        try: inner = json.loads(inner_text)
        except Exception: inner = inner_text
        return (topic_arn, inner, True)
    return (None, obj, False)
for m in msgs:
    rid = m.get("ReceiptHandle"); mid = m.get("MessageId"); body = m.get("Body","")
    attrs = m.get("MessageAttributes") or {}; sattrs = m.get("Attributes") or {}
    topic_from_attr = sattrs.get("TopicArn") or (attrs.get("TopicArn",{}) or {}).get("StringValue")
    topic_arn, obj, enveloped = parse_body(body)
    effective_topic = topic_arn or topic_from_attr or "-"
    if topics_re and effective_topic != "-" and not topics_re.search(effective_topic): continue
    ce = obj if isinstance(obj, dict) else None
    is_ce = bool(ce and {"id","type","time","data"}.issubset(ce.keys()))
    if types_re and is_ce and not types_re.search(str(ce.get("type",""))): continue
    ts = now()
    if is_ce:
        ce_id = ce.get("id"); ce_type = ce.get("type"); ce_time = ce.get("time")
        payload = ce.get("data") if isinstance(ce.get("data"), dict) else {}
        agr = payload.get("agreementNumber"); status = payload.get("status"); corr = payload.get("correlationId")
        head = f"[SQS][{ts}] RECEIVED CloudEvent on {qname} id={ce_id} type={ce_type}"
        if effective_topic and effective_topic != "-": head += f" topic={effective_topic}"
        print(head)
        if any([agr, status, corr]):
            print(f"[SQS]  details: agreementNumber={agr} status={status} correlationId={corr}")
        if show_full_body:
            print(json.dumps(ce, ensure_ascii=False))
    else:
        head = f"[SQS][{ts}] RECEIVED on {qname} id={mid}"
        if effective_topic and effective_topic != "-": head += f" topic={effective_topic}"
        print(head)
        if show_full_body:
            try: print(json.dumps(obj, ensure_ascii=False))
            except Exception: print(body.strip())
    if attrs:
        try: print(f"[SQS]  msgAttributes: {json.dumps(attrs, separators=(',',':'))}")
        except Exception: pass
    if do_delete and rid: to_delete.append(rid)
for rh in to_delete:
    print("::DELETE::"+rh)
PY
)"
      else
        out="$(echo "$resp" | awk '
          /"MessageId":/ { mid=$0; gsub(/.*"MessageId": *"|".*/, "", mid); }
          /"Body":/      { body=$0; sub(/.*"Body": *"/,"",body); sub(/",?$/,"",body); print "[SQS] RECEIVED on '"$qname"' id=" mid "\n" body }
        ')"
        dels="$(echo "$resp" | sed -n 's/.*"ReceiptHandle": *"\([^"]*\)".*/::DELETE::\1/p')"
        out="$out"$'\n'"$dels"
      fi

      while IFS= read -r line; do
        [[ "$line" == ::DELETE::* ]] || continue
        rh="${line#::DELETE::}"
        awslocal sqs delete-message --queue-url "$qurl_norm" --receipt-handle "$rh" >/dev/null 2>&1 || true
      done <<< "$out"

      while IFS= read -r line; do
        [[ "$line" == ::DELETE::* ]] && continue
        [[ -n "$line" ]] && echo "$line"
      done <<< "$out"
    done
  ) &
}

discover_and_attach() {
  local first=1
  while true; do
    urls_line="$(awslocal sqs list-queues --query 'QueueUrls' --output text 2>/dev/null || true)"
    if [[ -n "$urls_line" ]]; then
      # shellcheck disable=SC2206
      urls=($urls_line)
      echo "🔎 Discovery: found ${#urls[@]} queue(s)."
      for url in "${urls[@]}"; do
        qname="$(basename "$url")"
        is_attached "$qname" || poll_queue "$url"
      done
    else
      echo "🔎 Discovery: found 0 queues."
    fi
    if [[ $first -eq 1 && -z "$urls_line" ]]; then
      echo "⏳ Waiting for SQS queues to appear (scanning every ${SQS_LOGGER_DISCOVERY_INTERVAL}s)..."
    fi
    first=0
    sleep "${SQS_LOGGER_DISCOVERY_INTERVAL}"
  done
}

discover_and_attach &
echo "✅ SQS receipt logger running."
