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
