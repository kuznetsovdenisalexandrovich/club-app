# Independent client evidence — v677

The first inline block includes client-diagnostics.js byte-for-byte before the
rescue controller. It captures fetch before API wrappers and sends anonymous
facts to the existing Railway bot gateway /client-diagnostics. No business
requests are forwarded by this endpoint. No identity, signed launch, URL,
exception text, stack, IP or user agent is included in payloads. Platform edge
logging remains governed by Railway.

Random rescue/player attempt IDs correlate facts with authenticated RF records;
player facts include the current rescue attempt as parent. Railway facts are
untrusted client claims and never authorize delivery, access or state changes.
The endpoint accepts only fixed enums/bounded numbers, <=12 records/16KiB,
120 requests/minute/process, 48 records/attempt/day, <=4096 budget entries.
Accepted facts appear in deployment logs, plus a volatile 512-record/24h ring
readable only with the existing private gateway link secret. Railway log
retention applies; the ring is lost on restart. No new database or migration.

Client: <=40 facts, <=24 queued, <=12 POST attempts/page, 4s request deadline.
No persistent browser queue; new evidence/online/pagehide triggers bounded
flushes, no periodic retry loop. Errors never block startup or playback.
One parallel set of 3 read-only probes (Selectel API, Selectel bot, Railway)
only after rescue transport failure, actual rescue failure, player reporting
failure, sustained stall or final unavailable. Each has a 3.5s complete-body
deadline. These are diagnostic requests, never player source changes.

HTTP0/network cannot distinguish DNS/TLS/CORS/VPN/filtering. A successful
Railway report with failed RF probes proves different reachability at that
time, not deliberate blocking. No report cannot prove the HTML failed.

Rollout: gateway first, then bot v224, then frontend v677. Preserve live HA
modules when packaging the gateway; its live sources may differ from the
local backend ops tree. No Timeweb deployment or configuration change.
Tests: client_diagnostics, app_rescue, player_diagnostics and existing startup/
film/preload/seek/payment suites; gateway schema/bounds/independent intake;
bot permission_film and real rescue/delivery dedup.
