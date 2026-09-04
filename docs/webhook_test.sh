#!/usr/bin/env bash
# =============================================================================
# sunShift – SPINE/EEBUS Webhook Callback Test Client
# Ziel:  POST /api/spine/callback simulieren (wie die Miele Cloud es tut)
# Verwendung: ./webhook_test.sh [szenario] [device_id]
#
# Szenarien:
#   scheduled   – Gerät hat "Smart Start" aktiviert (Standardfall)
#   running     – EMS hat Startbefehl gegeben, Gerät läuft
#   inactive    – Programm abgeschlossen
#   slots       – Lastprofil-Slots (powerTimeSlot) senden
#   full        – Kompletter Ablauf: scheduled + slots in einem Call
#   status      – Aktuellen Protocol-Log abrufen (kein POST)
#
# Beispiele:
#   ./webhook_test.sh scheduled 000105666767
#   ./webhook_test.sh running   000105666767
#   ./webhook_test.sh slots     000105666767
#   ./webhook_test.sh full      000105666767
#   ./webhook_test.sh status
# =============================================================================

# --- Konfiguration -----------------------------------------------------------
BASE_URL="${SUNSHIFT_URL:-http://127.0.0.1:8091}"
CALLBACK_URL="${BASE_URL}/api/spine/callback"
PROTOCOL_URL="${BASE_URL}/api/spine/protocol-log"
SCENARIO="${1:-scheduled}"
DEVICE_ID="${2:-000105666767}"  # Standard: Spülmaschine

# --- Zeitstempel (relativ zu jetzt) -----------------------------------------
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EARLIEST=$(date -u -d "+1 hour" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v+1H +"%Y-%m-%dT%H:%M:%SZ")
START=$(date -u -d "+2 hours" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v+2H +"%Y-%m-%dT%H:%M:%SZ")
END=$(date -u -d "+4 hours" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v+4H +"%Y-%m-%dT%H:%M:%SZ")
LATEST_END=$(date -u -d "+6 hours" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v+6H +"%Y-%m-%dT%H:%M:%SZ")

# --- Hilfsfunktion -----------------------------------------------------------
post_callback() {
    local label="$1"
    local payload="$2"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  📡 SPINE Webhook Callback → ${CALLBACK_URL}"
    echo "  📋 Szenario : ${label}"
    echo "  📟 Gerät    : ${DEVICE_ID}"
    echo "  🕐 Zeit     : ${NOW}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  → Payload (gekürzt):"
    echo "${payload}" | python3 -m json.tool --indent 2 2>/dev/null | head -30 || echo "${payload}" | head -20
    echo ""
    echo "  → HTTP Response:"
    curl -s -o - -w "\n  HTTP Status: %{http_code}\n  Dauer: %{time_total}s\n" \
        -X POST "${CALLBACK_URL}" \
        -H "Content-Type: application/json" \
        -H "X-Miele-Simulation: true" \
        -H "X-Webhook-Test: sunshift-dev" \
        -d "${payload}"
    echo ""
}

# =============================================================================
#  SZENARIEN
# =============================================================================

case "${SCENARIO}" in

# ─── 1. SCHEDULED ────────────────────────────────────────────────────────────
# Nutzer drückt "Smart Start" – Gerät meldet Zeitfenster ans EMS
scheduled)
    post_callback "powerSequence – SCHEDULED (Smart Start aktiviert)" \
    "$(cat << PAYLOAD
[
  {
    "change": "createReplace",
    "deviceId": "${DEVICE_ID}",
    "feature": {
      "featureObjType": "powerSequence",
      "deviceId": "${DEVICE_ID}",
      "data": {
        "sequenceId": 13,
        "state": "scheduled",
        "startTime": "${START}",
        "endTime": "${END}",
        "earliestStartTime": "${EARLIEST}",
        "latestEndTime": "${LATEST_END}"
      }
    }
  }
]
PAYLOAD
)"
    ;;

# ─── 2. RUNNING ──────────────────────────────────────────────────────────────
# EMS hat Startbefehl gegeben, Gerät bestätigt den Start
running)
    post_callback "powerSequence – RUNNING (Gerät gestartet)" \
    "$(cat << PAYLOAD
[
  {
    "change": "createReplace",
    "deviceId": "${DEVICE_ID}",
    "feature": {
      "featureObjType": "powerSequence",
      "deviceId": "${DEVICE_ID}",
      "data": {
        "sequenceId": 13,
        "state": "running",
        "startTime": "${NOW}",
        "endTime": "${END}",
        "earliestStartTime": "${EARLIEST}",
        "latestEndTime": "${LATEST_END}"
      }
    }
  }
]
PAYLOAD
)"
    ;;

# ─── 3. INACTIVE ─────────────────────────────────────────────────────────────
# Programm fertig, Gerät geht in Ruhestand
inactive)
    post_callback "powerSequence – INACTIVE (Programm abgeschlossen)" \
    "$(cat << PAYLOAD
[
  {
    "change": "createReplace",
    "deviceId": "${DEVICE_ID}",
    "feature": {
      "featureObjType": "powerSequence",
      "deviceId": "${DEVICE_ID}",
      "data": {
        "sequenceId": 13,
        "state": "inactive",
        "startTime": null,
        "endTime": null,
        "earliestStartTime": null,
        "latestEndTime": null
      }
    }
  }
]
PAYLOAD
)"
    ;;

# ─── 4. SLOTS (powerTimeSlot – Lastprofil) ───────────────────────────────────
# Detailliertes Energieprofil: 3 Slots (Aufheizen / Spülen / Trocknen)
slots)
    post_callback "powerTimeSlot – Lastprofil (3 Slots)" \
    "$(cat << PAYLOAD
[
  {
    "change": "createReplace",
    "featureObjType": "powerTimeSlot",
    "deviceId": "${DEVICE_ID}",
    "data": {
      "slotNumber": 0,
      "defaultDuration": "PT20M",
      "power": { "number": 2200 }
    }
  },
  {
    "change": "createReplace",
    "featureObjType": "powerTimeSlot",
    "deviceId": "${DEVICE_ID}",
    "data": {
      "slotNumber": 1,
      "defaultDuration": "PT40M",
      "power": { "number": 350 }
    }
  },
  {
    "change": "createReplace",
    "featureObjType": "powerTimeSlot",
    "deviceId": "${DEVICE_ID}",
    "data": {
      "slotNumber": 2,
      "defaultDuration": "PT25M",
      "power": { "number": 900 }
    }
  }
]
PAYLOAD
)"
    ;;

# ─── 5. FULL ─────────────────────────────────────────────────────────────────
# Wie in der Realität: powerSequence + powerTimeSlot in einem einzigen Push
full)
    post_callback "FULL – powerSequence (scheduled) + powerTimeSlot [3 Slots]" \
    "$(cat << PAYLOAD
[
  {
    "change": "createReplace",
    "deviceId": "${DEVICE_ID}",
    "feature": {
      "featureObjType": "powerSequence",
      "deviceId": "${DEVICE_ID}",
      "data": {
        "sequenceId": 42,
        "state": "scheduled",
        "startTime": "${START}",
        "endTime": "${END}",
        "earliestStartTime": "${EARLIEST}",
        "latestEndTime": "${LATEST_END}"
      }
    }
  },
  {
    "change": "createReplace",
    "featureObjType": "powerTimeSlot",
    "deviceId": "${DEVICE_ID}",
    "data": {
      "slotNumber": 0,
      "defaultDuration": "PT20M",
      "power": { "number": 2200 }
    }
  },
  {
    "change": "createReplace",
    "featureObjType": "powerTimeSlot",
    "deviceId": "${DEVICE_ID}",
    "data": {
      "slotNumber": 1,
      "defaultDuration": "PT40M",
      "power": { "number": 350 }
    }
  },
  {
    "change": "createReplace",
    "featureObjType": "powerTimeSlot",
    "deviceId": "${DEVICE_ID}",
    "data": {
      "slotNumber": 2,
      "defaultDuration": "PT25M",
      "power": { "number": 900 }
    }
  }
]
PAYLOAD
)"
    ;;

# ─── 6. STATUS ───────────────────────────────────────────────────────────────
# Protocol-Log abrufen (GET, kein POST)
status)
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  📊 Protocol Log Abruf → ${PROTOCOL_URL}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    curl -s "${PROTOCOL_URL}" | python3 -m json.tool --indent 2 2>/dev/null || \
    curl -s "${PROTOCOL_URL}"
    echo ""
    ;;

# ─── HELP ────────────────────────────────────────────────────────────────────
*)
    echo ""
    echo "  Verwendung: $0 [szenario] [device_id]"
    echo ""
    echo "  Szenarien:"
    echo "    scheduled  – Smart Start aktiviert (powerSequence: scheduled)"
    echo "    running    – Gerät läuft (powerSequence: running)"
    echo "    inactive   – Programm fertig (powerSequence: inactive)"
    echo "    slots      – Lastprofil senden (powerTimeSlot, 3 Slots)"
    echo "    full       – scheduled + slots kombiniert"
    echo "    status     – Protocol-Log anzeigen (GET)"
    echo ""
    echo "  Bekannte Geräte:"
    echo "    000105666767  – Spülmaschine (Dishwasher)"
    echo "    000091093524  – Trockner (Dryer)"
    echo "    000186348553  – Waschmaschine (Washer)"
    echo ""
    echo "  Env-Variable: SUNSHIFT_URL (Standard: http://127.0.0.1:8091)"
    echo ""
    ;;
esac

echo "  ✓ Fertig. Callback-Logs: ${BASE_URL}/api/spine/callback-logs"
echo "  ✓ Protocol Inspector: ${BASE_URL}/api/spine/protocol-log"
echo ""
