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
