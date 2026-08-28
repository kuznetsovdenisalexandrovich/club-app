/* ══════════════════════════════════════════════════════════════════════
   ПРОМО-СЛОЙ для съёмки роликов.

   Живёт ТОЛЬКО в promo-kit.html. В боевой index.html не подключается
   и на участников не влияет никак.

   Слой ничего не вырезает из приложения — он накрывает его сверху:
   перехватывает запросы к бэкенду и правит ответы по дороге. Поэтому
   при обновлении приложения он не ломается: достаточно пересобрать
   promo-kit.html скриптом promo.sh.

   ⚠️ Чтобы поменять имя, баллы или уровень в кадре — правь только блок
   PROMO ниже и заливай этот файл. Пересобирать promo-kit.html не надо,
   он ссылается на этот файл по имени.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── ЧТО ВИДНО В КАДРЕ ────────────────────────────────────────────── */
  var PROMO = {
    name: 'Аня',
    points: 6900,          // баланс к трате
    lifetimePoints: 6900,  // заработано за всё время (двигает уровень)
    level: 7,              // уровень
    nextLevelPoints: 8000, // порог следующего уровня
    monthsInClub: 8,
    subName: 'База',
    subCost: 990,

    // Кем прикидываемся на бэкенде. Это боевой аккаунт Denis'а —
    // приложение получает настоящий контент клуба, а личное подменяется ниже.
    telegramId: 161898089,

    // Имена в чате эфира, вопросах и лентах активности
    people: [
      'Марина', 'Кирилл', 'Ольга', 'Тимур', 'Настя',
      'Павел', 'Юля', 'Артём', 'Лена', 'Дима',
      'Света', 'Максим', 'Ира', 'Женя', 'Полина'
    ]
  };

  /* ── СЛУЖЕБНОЕ ────────────────────────────────────────────────────── */

  var origFetch = window.fetch.bind(window);

  function pathOf(url) {
    try {
      return new URL(url, location.href).pathname;
    } catch (e) {
      return String(url).split('?')[0];
    }
  }

  // Ответ вида Response, но с нашим телом
  function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Устойчивый выбор имени: один и тот же человек всегда получает одно имя
  function fakeName(seed) {
    var s = String(seed == null ? '' : seed);
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return PROMO.people[h % PROMO.people.length];
  }

  /* ── ПРАВКИ ОТВЕТОВ ───────────────────────────────────────────────── */

  function patchProfile(u) {
    if (!u || typeof u !== 'object') return u;

    u.found = true;
    u.is_member = true;

    u.full_name = PROMO.name;
    u.name = PROMO.name;
    u.first_name = PROMO.name;
    u.username = '';
    u.phone = '';
    u.photo_url = '';

    u.points = PROMO.points;
    u.lifetime_points = PROMO.lifetimePoints;
    u.reward_level = PROMO.level;
    u.next_level_points = PROMO.nextLevelPoints;
    u.points_to_next = Math.max(0, PROMO.nextLevelPoints - PROMO.lifetimePoints);

    var span = PROMO.nextLevelPoints || 1;
    u.progress_fraction = Math.min(1, PROMO.lifetimePoints / span);

    u.months_in_club = PROMO.monthsInClub;
    u.sub_name = PROMO.subName;
    u.cost = PROMO.subCost;

    // Всё пройдено: ни плашек «закончи регистрацию», ни красных предупреждений
    u.channel_joined = true;
    u.chat_joined = true;
    u.home_screen_added = true;
    u.tour_done = true;
    u.asked_denis = true;
    u.built_path = true;
    u.vk_access_granted = true;
    u.is_first_member_open = false;
    u.onboarding_level = 5;

    return u;
  }

  // Замена имён в списках, где это реальные люди
  function patchPeopleList(data) {
    var arr = Array.isArray(data) ? data
            : (data && Array.isArray(data.items) ? data.items
            : (data && Array.isArray(data.messages) ? data.messages : null));
    if (!arr) return data;

    arr.forEach(function (row, i) {
      if (!row || typeof row !== 'object') return;
      var seed = row.telegram_id || row.user_id || row.id || i;
      ['name', 'user_name', 'full_name', 'author', 'from_name'].forEach(function (k) {
        if (typeof row[k] === 'string' && row[k]) row[k] = fakeName(seed);
      });
      if (typeof row.username === 'string') row.username = '';
      if (typeof row.photo_url === 'string') row.photo_url = '';
    });
    return data;
  }

  /* ── ПЕРЕХВАТ ─────────────────────────────────────────────────────── */

  window.fetch = function (input, init) {
    var url = (typeof input === 'string') ? input
            : (input && input.url) ? input.url : '';
    var path = pathOf(url);

    // Вход в браузере: сессии нет — выдаём её сами, экран логина не появляется
    if (path === '/auth/me') {
      return Promise.resolve(jsonResponse({
        telegram_id: PROMO.telegramId,
        session_token: 'promo'
      }));
    }

    return origFetch(input, init).then(function (res) {
      var handler = null;

      if (path === '/users/me') handler = patchProfile;
      else if (path === '/live/chat' || path === '/questions' ||
               path === '/support/my') handler = patchPeopleList;

      if (!handler || !res.ok) return res;

      return res.clone().json().then(function (data) {
        try {
          return jsonResponse(handler(data), res.status);
        } catch (e) {
          return res;
        }
      }).catch(function () {
        return res;
      });
    });
  };

  /* ── КОСМЕТИКА ────────────────────────────────────────────────────── */

  var css = document.createElement('style');
  css.textContent = [
    /* служебное, чему не место в кадре */
    '#debug-blocks{display:none !important}',
    '.app-build,.build-tag,#app-build{display:none !important}'
  ].join('\n');
  document.head.appendChild(css);

  // Метка для отладки: видно в консоли, что слой действительно подключился
  window.__PROMO__ = PROMO;
  try { console.log('[promo] слой активен:', PROMO.name, PROMO.points, 'ур.' + PROMO.level); } catch (e) {}
})();
