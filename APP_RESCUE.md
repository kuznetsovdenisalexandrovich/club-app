# Аварийный режим — обязательный контракт

Первый inline-скрипт `APP_RESCUE_V1` в index.html намеренно не зависит от SDK,
основного приложения, CSS или внешнего JS. Не перемещать его после зависимостей.

Полный контракт, ограничения, права доступа, расширение для новых лид-магнитов
и диагностика: [club-bot / APP_RESCUE.md](https://github.com/kuznetsovdenisalexandrovich/club-bot/blob/main/APP_RESCUE.md).

При добавлении нового входного материала:
- сохраняйте точный target через `ClubAppRescue.target(target)`;
- при окончательном отказе вызывайте `ClubAppRescue.fail('content_error')`;
- проверьте серверный адаптер и готовность копии у конкретного бота;
- не подтверждайте готовность пустого блока или только успешного HTTP-запроса;
- проверьте `node --test tests/app_rescue.cjs` и соответствующий бот-тест.

Игры пока передаются ссылкой на их точный вход, без обещания игры внутри переписки.
Для исполнения игры в боте нужен отдельный адаптер, а не подмена фильмом.

Исправление 12.11: film_<source> и namedfilm_vN относятся к одному фильму и одной суточной выдаче. Видимый экран разрешения боту писать и подтверждённый кадр видео завершают стартовый watchdog. В тайм-ауте записываются этапы загрузки; отсутствие ready само по себе не доказывает пустой экран. Сбой отдельного материала не называется падением всего приложения.

Оплата: сервер `_checkout_issue` повторяет только do=link один раз после сетевого
тайм-аута или HTTP 502/503/504; тот же checkout и перепроверка статуса/доступа.
Не добавлять повтор списания или изменение тарифа. После окончательного отказа
обычная и промо-оплата показывают `accessLinksErrorHtml` с личкой Denis и текстом
«Привет, не получается оплатить(». Telegram поддерживает draft text; в ВК текст
показывается рядом и копируется отдельной кнопкой.

Стабилизация v586: поздний полезный старт снимает аварийную панель и polling. После content_error снять её может только подтверждённое содержимое, а не обновление профиля. Рабочие встроенные настройки допустимы при недоступности overrides. Ошибка источника с доступным Boomstream записывается в диагностику, но не объявляет окончательный отказ материала. Фактический time/progress запасного плеера подтверждает восстановление.

Стабилизация v587: при целевом входе boot загружает профиль/настройки и целевой маршрут; полный портал — при его открытии. Обычный старт портала сохраняет прежние блоки. News, urgent, support и tester рисуются независимо, старые поколения ответа не перерисовывают новый запрос. Общие in-flight проверки readiness не кэшируют завершённые значения репликации. apiRequest сохраняет deadline до конца JSON. Проверки: startup_chain.cjs + payment_chain.cjs + app_rescue.cjs; два одинаковых транспорта должны оставаться синхронными.

Стабилизация v591: после остановки уже начавшегося native-видео последний загружающийся источник получает до 20 с, включая загрузку metadata/переход к сохранённой позиции. После отказа обоих auto-источников выполняется один ограниченный проход по доступным lowUrl в 360p (8 с на первый, до 20 с на последний native loading). Только затем film_unavailable запускает общую аварийную выдачу. Пока качество остаётся 360, автоматический проход не повторяется; ручные переключения доступны. Восстановление подтверждает продвижение видео, не loadedmetadata/playing. Причину первого сетевого зависания это не устанавливает. Проверки: tests/film_player.cjs, tests/app_rescue.cjs, tests/player_diagnostics.cjs.

Диагностика v592 / backend v651 / bot v168: этапы запуска с временами и ограниченными промежуточными status; старый seq не стирает данные, поздний ready не повторяет доставку. Плеер различает хранилище и API, сохраняет буфер/перемотку и после окончательного отказа выполняет ограниченное сравнение direct/proxy. Контракт и ограничения: [VIDEO_DIAGNOSTICS.md](VIDEO_DIAGNOSTICS.md).

Записи встреч: `meeting_<event_id>` — закрытый материал. Адаптер бота link-only, без обещания копии видео. Плеер отмечает content только по кадру/восстановлению; диагностика content=meeting. Контракт backend/MEETING_RECORDINGS.md.

Стабилизация v598: перед тайм-аутом и показом помощи плеер заново проверяет currentTime — задержанный JS/timeupdate при продолжающемся native-видео не должен переключать источник. Отменённые таймеры проверяют свою идентичность; настоящая остановка сохраняет прежние ограниченные сроки и резервный проход. pause с media.error не отменяет намерение воспроизведения; явная пауза пользователя сохраняется. Регрессии: tests/film_player.cjs; связанные цепочки: app_rescue, player_diagnostics, meeting_player, startup_chain, payment_chain. Это исправляет воспроизведённые ошибки управления плеером, но не доказывает причину каждого сетевого/media_error на устройстве.

2026-11-13 v599 / backend v664: card-motion defaults are inline and checked against the canonical file; they no longer block HTML on a separate request. SDK order is unchanged. RF JSON responses retain their deadline and caller cancellation until the complete body is read; binary responses remain streamed. Keep both RF transport copies identical. clubPassEnsure owns one shared authorization request; each consumer can cancel its wait without sending its expired API request. TG/VK session and auth/pass deadlines are 12s including response body; VK bridge initialization waits at most 3.5s. Checkout ambiguous results are never replayed on another node.
Automatic foreign Railway storage fallback uses its API proxy while primary Selectel remains direct. Each source declares delivery; manifest.delivery denotes the primary strategy. Owner-only delivery override preserves explicit A/B tests. Signed URLs, namespace and access gates are unchanged. Tests: response_deadlines, startup_chain, payment_chain, content_security; backend test_hls_delivery, test_film_rescue, test_meeting_recordings. Actual 360p samples and Chrome native playback with the real app Origin were checked, including primary failure and meeting seek. This is not proof that every iOS/Android/VPN problem is solved.

2026-11-13 v600: bonus and meeting replay manifest GET/HEAD requests now use the same bounded hedged read as film manifests. A healthy readiness endpoint does not prove the specific manifest request can finish. Readiness/replication barriers and identity remain required; access denials are final. This does not race media segments or payment writes. Regression: tests/media_manifest_reserve.cjs (stalled headers/body, denied access, unready replica), plus existing payment/deadline tests.

2026-11-13 v604: native HLS may initially report an indefinite duration. Preserve the saved position until a finite VOD timeline permits seeking; retry on durationchange/canplay, do not overwrite it with reset timeupdate/seeking events or a failed source. Restoring the position alone is not evidence of a frame. Unit regression reproduces loss of1744s to0 in v603. Real Chrome native/HLS tests cover film, bonus primary failure/reserve resume and meeting seek. This does not establish the cause of every historical media_error or device stall.

2026-11-13 v605: guest film window exposes the existing shareFilm action as a secondary13px text button after the two conversion actions. It remains in normal flow and hides in PiP. Existing platform links/referral handling, startup, playback and checkout logic are unchanged. Legacy iframe fallback gets a64px reserved row only when its direct-child bot escape button exists, preventing overlap with purchase. Visual checks: light/dark,320/390/430/844/1440px,normal and unavailable media,PiP; Telegram/VK/web share and cancellation tests. Incident a9150110db remains unresolved: earlier film entry ready1.28s, later untargeted entry only first1s evidence,no ready/closed; no inferred network root cause.

2026-11-13 v606: a transient bot maintenance/state barrier returns503 before ready/closed can persist; the former one-shot acknowledgement then left a healthy app eligible for the server watchdog. Retry only ready/closed on network failure,429 or5xx, at1250ms and3000ms, maximum3 attempts, each with an8s complete-response deadline. Keep the same attempt/sequence and snapshot of stages. A newer sequence or target cancels pending retries; authorization failures and material-delivery requests are not retried. Existing useful-screen criteria and35s/60s watchdogs are unchanged. Isolated server tests reproduce503 => false watchdog and identical ready retry => no notification. Browser fault injection covers Telegram,VK and stalled VK bridge. Historical incident a9150110db is consistent with lost acknowledgement but its actual HTTP response was not retained; do not label its exact root cause proven.

2026-11-13 bot v186 / frontend v607: /content/app-rescue/diagnostics accepts at most12 strict ready/closed transport facts, authenticated by the existing TG/VK verifier. Only an existing attempt of the authenticated peer, younger than24h, can receive evidence. Unknown/foreign/expired attempts are discarded; no attempt, sequence, watchdog, ticket or delivery is created/advanced. Per-attempt history is capped12 and retained with existing attempt records. Browser allowlisted queue holds at most12 records for24h, excluding signatures, profile data, URLs, bodies and error text. Upload is asynchronous on successful rescue response or online, at most4batches per page, minimum2s spacing,8s deadline; failed telemetry has no retry loop. Known busy/halted maintenance responses expose only an enum reason via CORS header. SDK bytes now inline, exactly matching vendored telegram-web-app.js: v606 synthetic stalled SDK reproduced html/card_script-only parser block; v607 removes that network dependency. This does not prove historical device/network failure for b22926d696. Cold HTML interruption or a killed WebView can still prevent reporting. Regression covers auth/platform isolation, bounded history, storage errors, reload,503 recovery, SDK equality, checkout, startup and visual layout. Rollback frontend first, then bot; no schema migration or delivery receipt changes.

2026-11-14 v612: native networkState can change asynchronously after load/play.
At a short reserve deadline, recheck the still-loading final source and grant only
its remaining time within the existing20s loading window. Do not extend explicit
stallMs, healthy advancement, a paused/hidden/destroyed player, or loop beyond the
same source deadline. Two-source auto+360 timeout path remains bounded52s after
Play; media errors may fail earlier. Regression native_async_loading.cjs reproduces
the former8s cutoff with asynchronous networkState and checks exhaustion/pause.
Probe reason sample_low satisfies the API letters/underscore contract; sample_360
was rejected422 and dropped by legacy-schema fallback. Keep quality360 separately.
APP_BUILD aligned with app-v612. This repairs proven defects, not proof of the
historical iPhone user's transport/decoder root cause. No extra retries or user sends.

2026-11-14 v618: bounded diagnostic-only milestones play_requested/paused/visibility_hidden/visibility_visible (12/player), watchdog_late (>2s past its scheduled deadline,4/player). Playback timing, pause handling, failover and emergency delivery unchanged. Profile request vs render failures: at most2/page, enum/status only, authenticated backend diagnostics branch with no marketing or account side effects. Historical f2e47c804c root cause remains unresolved; lastProgress age alone cannot distinguish pause from suspended JS.

2026-11-14 v618 parser dependency fix: meeting-recordings.css/js, player-diagnostics.js and film-player.js are embedded byte-for-byte at their original positions. Keep canonical external files and parity test; do not change order. Browser fault injection proved any one of the4 separate requests could block main afterSDK; embedded build reaches main with all4requests unavailable. This identifies a reproducible startup failure class, not proof of the network cause for historicalmeeting_31. HTML +~36KB (~1.2%). Playback decisions unchanged.

2026-11-14 v622: shared native video sizing now fills its media rectangle with
object-fit:contain, including library bonus items (previously only funnel and
meeting contexts constrained the actual video). Library native slots keep help
in normal flow outside the media rectangle; vertical/horizontal wrappers retain
9:16/16:9 and fit viewport width/height. Expanded help no longer clips or overlaps
the title. No source, watchdog, authorization or delivery behavior changed.
Verified old CSS overflow, 20 library viewport/theme/orientation layouts, existing
player/rescue/meeting tests and full funnel fallback browser checks.

2026-11-14 v623: compact guest film window reduces the unused space below hidden
help (36px visual gap to the primary action) and scales the video down on short
viewports. Visible recovery actions retain their reserved row. Native video
controls remain unchanged; no custom seek/fullscreen controls were shipped.
Six short-window/theme browser checks keep the primary action fully visible and
exercise manual/automatic fallback. OS fullscreen in macOS Telegram remains
unconfirmed; do not claim this layout change enables it.

2026-11-14 v624: desktop fine-pointer/hover native portrait players use the card
width, with object-fit:contain preserving the picture. WebKit inline controls
can drop the complete timeline when the native video box is too narrow; CSS
must not force its controls into a portrait-width strip on desktop. Touch
layouts and PiP retain prior dimensions. No custom controls or player changes.
12 funnel viewport/theme/input checks and 20 library layouts passed; 38 tests.
Fullscreen is separate: installed Telegram 7.4.4 pins lib_webview 0948a2996df1733dc71f9374cef67347700ecb24,
which does not enable WKPreferences.elementFullscreenEnabled. System default
measured false on macOS 27.2.1. This frontend change does not enable host-level
fullscreen and is not evidence about historical VPN playback incidents.

2026-11-14 v625: film-target startup keeps portal/catalog deferred, including
library blocks moved onto home. Minimizing the film or explicitly browsing home
starts one shared in-flight hydration of portal, streams and library; the existing
video element stays in PiP. A hidden-shell film entry uses deferContent demo setup;
normal demo entry loads the real portal too. Public calendar event titles remain
visible and each guest event/replay offers a paywall button even without a join
URL. Direct guest replay entry opens paywall before protected requests; paused
members retain the existing server-checked recording route. No access grants or
backend projection changes. 28 tests plus four full browser flows (two widths,
two themes) cover deferred requests, PiP identity, catalog, previews and paywalls.

2026-11-15 v629: Android native HLS media error 4 may switch once to bundled
HLS.js when supported; native playback is never delayed by optional preload.
Position survives the switch, recovery still requires actual progress, and
source/quality retries remain bounded. Bootstrap /users/me?bootstrap=1 is a
read-only hedged request. The separate visit request runs once per session
identity with rfNoRetry; it must never be raced against the reserve. Rescue
messages and videos are not replayed by these fixes.


2026-11-15 legal baseline (app v632 / bot v205 / backend v693): promotional
film requires separate versioned data and advertising choices. Refusal/closing
does not grant access; paid service access keeps priority. Native film sends and
rescue delivery check consent before claiming any delivery receipt. Consent
pauses preserve nurture cursors, receipts and retry budgets; no chains are enabled
by this release. Film manifests require a short-lived token checked against current
choices; non-film lesson/meeting access is unchanged. UI startup waits for late
inline modules; guest shell exists before the consent modal can be dismissed.
App leave-after-refusal alerts require an actual pagehide signal and no return for
90 seconds; neither closing a dialog nor silence in a bot proves departure.

2026-11-15 v637: four-arrow fullscreen overlay expands the existing video/container without replacing media; CSS fallback and Escape restore the same element. Explicit film reload saves the current or last known position before location.reload(), preserves launch/auth/settings/choices, and is bounded to once per ten minutes per launch route. No automatic reload based on missing Boomstream events. No receipts, chain cursors or video deliveries are reset. Wife incident showed Timeweb manifest403 followed by Selectel playback; cause of403 remains under investigation. Tests: video_controls, film_player, inline_player and full frontend suite.

2026-11-15 v639: one automatic film reload after confirmed native film_unavailable, only foreground/online and once per launch per ten minutes; preserve position and all settings. Never infer Boomstream failure from silence or reload on manifest403. Requested bot video remains in app while ready=false; next click checks the existing receipt, and only confirmed handoff is cached.
Automatic reload carries only the previous diagnostic attempt UUID; the new frame/recovered event can resolve that exact film incident for the same verified Telegram recipient. Server keeps the original technical-chat message receipt and edits it; page load/play alone cannot resolve it. Late old batches cannot undo the recorded reload recovery.

2026-11-15 v640: explicit watch-in-bot navigates after response or two seconds, whichever comes first. Keep one in-flight keepalive request per identity/material; late responses update the cache without reopening chat. Confirmed queued receipts reopen without another request. Backend v699 returns425 for a missing well-formed film grant so RF transport can consult the other ready replica; existing revoked/expired grants still403. Reproduced identical fresh grant: Selectel200, Timeweb403, Timeweb200 five seconds later. No CDN/S3 permission changes.
Film manifest retries only HTTP425 for up to eight seconds of synchronization waiting, with a visible spinner; normal200 and final401/403 are immediate. The original request cancellation/deadline remains active.

2026-11-15 v641: film consent dialog starts one background warmup of bundled HLS decoder and first-party API connections; its existing poster loads concurrently. No manifest/video request or consent mutation during warmup. The synchronization spinner now reads «Загружаем фильм…».

2026-11-15 v642 / backend v700: consent-time anonymous preloading is limited to segment00000 (at most eight seconds) of the public named-film catalog, in360/720. The public startup route cannot select other segments or private namespaces. Only an authorized full manifest with matching warm_film reuses the exact cached startup URLs; normal direct delivery is unchanged when there was no matching preload. Decline/dismiss aborts unfinished downloads. Explicit accept starts native playback only after the consent write succeeds; autoplay rejection retains the normal play button. No pre-consent playback, diagnostic viewer identity, full manifest or delivery request.

2026-11-15 v643 / backend v701 supersedes film token/startup limits above: the public named-film catalog and all its HLS segments are anonymous. Stable /media/film-hls URLs have no grant, signature or expiration, and use immutable caching. Both API origins are read without account/RF wrappers; first complete valid catalog wins, loser is cancelled. Consent still gates UI playback and bot sending, not downloading public film bytes. Background sequential360p/720p prefetch continues throughout consent, stops at playback/close, and shares exact HTTP cache URLs with playback. Public proxy reads fall back between storage providers. Existing signed URLs remain supported for old clients; bonus/meeting namespaces still require membership and signatures. No chain state or message receipts changed.

2026-11-15 v644: film consent is checked before constructing its modal/backdrop. A positive saved choice continues the existing route without a dialog or shown event. Pending checks coalesce repeated film entry; late cancelled replies cannot open a modal. Network failure leaves the application visible and reports a toast, never inferring refusal. Explicit settings still open immediately. Automatic account prompt skips granted consent and active film checks.

2026-11-15 v645 / backend v702: bonus/meeting HLS keeps membership gates and
namespace-scoped expiring signatures. Ordinary new manifests use proxy delivery
for both sources; each segment can fall back between stores. Owner direct A/B
override and old signed direct links remain compatible. Shared player avoids
restoring subsecond startup timestamps on source replacement. One bounded
diagnostic comparison now starts at sustained film_stall (or final failure),
so closing before exhaustion need not erase transport evidence. No probes on
healthy playback, no duplicate comparison at exhaustion, no new delivery calls.
Bonus diagnostics are titled Bonus, not Film; existing incidents are untouched.
Boris a6b95393: free first masterclass lesson, not proof of403; initial decoding
on both routes but no advancing playback. Initial12s360/720 match both stores
and decode correctly; exact historical iOS cause remains unconfirmed.
Continuous foreground waiting per source is now capped even when seeking/metadata
callbacks re-arm timers. The budget resets only on real progression, explicit
pause/visibility suspension or source change, not on a playing callback alone.
Regression: old player stays loading with repeated seeking; fixed player exhausts
auto+360 sources within80seconds under that fault. Normal no-seek timeout path
retains its existing52second bound. No automatic refresh/delivery was added.

2026-11-16 v650: resource cleanup is scoped to invite previews, live-chat polling,
and hidden audio UI. Bonus and meeting callers explicitly request a 30-second
HLS back buffer; the funnel caller omits the option and retains the previous
HLS configuration. Funnel initialization/preload/start/fallback block remains
byte-identical to v649, protected by resource_economy.cjs. Do not apply the
buffer option or change preload to the funnel without a new instruction.
Chat polling is single-flight with a 12-second response/body deadline, aborts
on close/hide, ignores stale generations and resumes on visibility. Hidden
invite slides pause; closing unloads sources, reopening plays only the active
slide. Audio playback continues while the full UI is closed; that UI catches
up on open/visibility. Browser regressions cover actual native/HLS playback,
forward/backward seeks beyond the flushed buffer, source switch, audio seeks,
and preview close/reopen; no physical-phone battery saving percentage claimed.

2026-11-16 v651: authenticated bootstrap/catalogue reads wait for the shared 12s
account-pass operation before starting their 7s RF read budget. The caller's
absolute deadline/cancellation still covers both; public film/onboarding manifests
and preloading bypass the new hook. A scaled cold-login regression reproduced
profile cancellation before any /users/me request; it now succeeds. This is not
proof that every reported mobile failure has this cause. Caught profile failures
also call the existing bounded technical reporter; its public endpoint bypasses
auth waiting. Offline delivery remains dependent on connectivity. Consent dialog
uses fit-content height and scoped header spacing. Fullscreen control is compact
and offset to the side; player JS and funnel logic remain unchanged.

2026-11-16 v652: incident mitigation rolls back all v650 resource-economy changes
(previews, chat, audio UI and optional HLS back buffer) to the previous behavior.
The v651 cold-auth/profile diagnostic correction and requested CSS remain.
film-player.js and meeting-recordings.js exactly match yesterday f3221fd.
This rollback removes an unproven variable; it is not proof of outage cause.

2026-11-16 v653: initial native HLS at position zero may retain its first source
until 8s (previously 4s) only after valid metadata with NETWORK_LOADING and no
first playing event. Empty/no-metadata sources still switch at 4s. Explicit
stallMs, resume/seek, user pause and source exhaustion remain authoritative.
The whole no-seek native fallback path is bounded at56s in this metadata case,
otherwise52s. startup_loading_grace is bounded lifecycle evidence. Preload and
funnel initialization remain byte-identical to v645; no media URL/cache changes.
Observed v652 incident: metadata1.95s, first-source discard4.64s, fallback
recovered17.54s with intervening pause/play events. Those user/browser pauses
are not attributed to the timer; the premature-discard defect is reproduced
separately. Regression: native_start_grace, native_async_loading, film_player.


2026-11-16 v654: the read-only POST /auth/pass now uses bounded hedged delivery
like bootstrap reads. The handler verifies signed launch/session credentials and
issues a signed pass without creating a session or changing business state.
After 900ms a ready replica may answer; return barriers, final403, one shared
idempotency key, caller cancellation and the independent12s auth deadline remain.
Session creation, verification and checkout writes are not hedged. Regression
reproduces stalled headers/body with a healthy readiness endpoint: v653 waits
until the profile15s deadline without contacting the reserve; v654 loads the
profile through the reserve in0.92s in the same browser fault fixture. This is
not proof of the reported German VPN root cause. All player/preload source bytes
are unchanged. Tests: auth_pass_reserve, response_deadlines, payment_chain,
startup_chain, app_rescue, inline_player, funnel_unchanged and playback suites.

2026-11-17 v655: the first inline script installs bot-transport.js before rescue
captures fetch. Only canonical /content/* bot requests are mapped to existing
direct Selectel /club-bot and Timeweb bot endpoints. Read-only health probes
select a running main bot; signed requests are sent once, never automatically
replayed across nodes after an ambiguous response. Health is not writer authority:
existing fencing, lease, maintenance and receipt protections remain authoritative.
PDF navigation preserves the signed path/query on the selected direct node.
Primary Caddy must expose /club-bot/health (rewrite /) and /club-bot/content/*
(strip /club-bot) to 127.0.0.1:18092 before publishing this frontend. Other bot
paths are not exposed by this route. No player/preload code changed. This removes
DNS switching from these application requests, not the safe bot activation delay
or external provider callbacks. Tests: bot_transport, app_rescue and player/payment
regressions. Keep inline and standalone bot-transport.js identical.

2026-11-17 v656: explicit seeks receive a fresh bounded 8s segment-loading window; restoring the saved position after source replacement preserves its existing budget. Real advancing frames clear seek state. Startup/preload selection, cache, media element and authorization are unchanged. Tests cover repeated scrubbing beyond20s, stalled seek fallback, paused seek, and internal restoration. This repairs a reproduced premature-fallback path, not every possible device/network stall.

2026-11-17 v657: CSS fullscreen keeps ancestors above sibling sheets and removes
animated/filter containing blocks. Media nodes, playback, preload and seek JS
remain unchanged. Bonus controls have compact labels and separate close space.
Guest phone login has a direct return; subscription-denied quizzes link to the
existing access page. No payment/membership changes. Telegram desktop reproduced
the hidden player; browser CSS regression covers 320/390/844/1440 widths.
Full suite: 199 passed, one existing stall_probe failure also reproduced on
unchanged HEAD 6035628. The test was not changed; film_seek_recovery passes.

2026-11-17 v658: guest quiz screen explains access and offers the existing free
quiz. Purchase navigation dismisses material layers with their own handlers,
pauses audio without replacing its source and hides mini controls on tariff pages.
Audio cover fits short screens; magazine dialog scrolls within the viewport.
Film player, preload, seeking, membership and payment creation are unchanged.

2026-11-17 v659: audio artwork falls back from lesson square/wide image to
its stream image (same slug-prefix membership as the backend). Reuse the stream
catalog request; late delivery updates image nodes only. Broken images advance
through bounded fallbacks. No audio source, playback or seeking changes. Compact
full-player artwork remains visible on short screens. Catalog audit: 62 lessons,
23 own covers and 39 stream fallbacks, all selected image URLs loaded.


2026-11-18 v661: bonus player alone opts into adaptiveRecovery. Two native
progress timeouts within five minutes retain the position and choose 360p on
the next source; one recovered frame no longer resets this short failure history.
Manual quality selection resets it; old unrelated stalls expire. Film funnel,
preload and seek deadlines are unchanged. This improves repeated-stall recovery;
it does not establish the network cause of every iOS timeout.

2026-11-18 v663: anonymous refresh does not request
/users/me with a missing identity and does not emit a false profile_http_401.
Authenticated failures retain the existing bounded diagnostics. Playback,
manifest routing, rescue delivery and startup readiness are unchanged.
Pack entry opens an existing member-only card surface; it does not open a card
or award points until the participant explicitly chooses one.

2026-11-18 v664: card motion uses Telegram sensors only with signed initData.
Web users can explicitly request browser sensor permission; denied or absent
sensors retain pointer tilt. Card navigation reaches the mobile viewport edges.
No changes to startup, identity, video playback, or payment routes.

2026-11-18 v665: pack navigation occupies its own viewport row. Card size
tracks the available scene height; long details scroll independently. Framed
art uses the same inset window as the collection. Single/two-card packs use
their actual count. Web sensor consent is one shared dialog per app session,
with persisted decline and session-cached browser permission, never a button
under each card. Startup, payments and material playback remain unchanged.

2026-11-18 v666: both motion choices survive app reload. Saved approval starts
passive sensor listening without requesting browser permission again. It is
not evidence that OS permission is still granted: if events are unavailable,
pointer tilt remains active. No repeated consent popup on entry.

2026-11-21 v677 / bot v224: a first content frame after shell-ready sends one
new ready snapshot (with the same bounded ready retry policy). Previously
content stayed only in memory, so permission_film could miss real playback.
Permission-triggered quiet_film delivery no longer creates a false app-failure
incident; actual delivery failures and real rescue watchdog alerts remain.
Independent anonymous Railway evidence is described in CLIENT_DIAGNOSTICS.md.
No playback, source, preload, seek or payment behavior changes.

2026-11-21 v680: one early CLUB_BUILD_ID feeds startup and independent diagnostics;
parity test checks the release marker/display build. Resource failures retain only
allowlisted asset names (otherwise a fixed tag category), at most4 distinct/page,
no signed URL/query/error body. Pending telemetry retries every2s within existing
12-request/40-fact caps. Profile errors distinguish HTTP/network/timeout/invalid
response/render; a manual retry repeats only the existing bootstrap flow. No
player, payment, rescue-delivery or bot-chain changes. Historical unknown failures
remain unknown; a successful new launch does not prove the previous screen loaded.
