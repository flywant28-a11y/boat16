/* =========================================================
   Материалы Равиля Кандинского из Telegram (закреп t.me/ravilcandi/10562).
   Файлы на сайте не лежат — по ссылке открывается пост в Telegram.
   Скачанный PDF можно подключить в приложении («materials → подключить файлы»):
   он сохранится в этом браузере и откроется без интернета.
     { id, title, note, url, kind: 'pdf' | 'video' | 'post', file?: имя PDF в посте, size?,
       topics?: [id тем] или sections?: [раздел] — где показывать в шпоре }
   ========================================================= */
window.MATERIALS = {
  author: 'Равиль Кандинский',
  channel: 'https://t.me/ravilcandi',
  post: 'https://t.me/ravilcandi/10562',
  groups: [
    {
      title: 'Главные файлы',
      items: [
        { id: 'shpora', kind: 'pdf', title: 'Шпора по всем темам ОГЭ', note: 'основная теория на 4 и 5', url: 'https://t.me/ravilcandi/7449', file: 'Шпора со всеми темами от Равиля.pdf', size: '94,6 МБ' },
        { id: 'terms', kind: 'pdf', title: 'Все термины по разделам ОГЭ', note: 'понятия для задания 1', url: 'https://t.me/ravilcandi/8762', file: 'все термины по разделам.pdf', size: '49,3 МБ' },
        { id: 'medvedev', kind: 'pdf', title: 'Учебник Медведева кратко', note: 'вся теория 6–9 класса на 30 страницах', url: 'https://t.me/ravilcandi/12295', file: 'учебник Медведева – кратко.pdf', size: '0,6 МБ' },
        { id: 'newbook', kind: 'pdf', title: 'Новый учебник по обществу ОГЭ', note: 'Медведев, 9 класс', url: 'https://t.me/ravilcandi/11811', file: 'Обществознание_9_класс_Д_А_Медведев_1.pdf', size: '39,5 МБ' },
        { id: 'all9', kind: 'pdf', title: 'Всё обществознание за 9 класс', url: 'https://t.me/ravilcandi/9078', file: 'Все обществознание 9 класса.pdf', size: '37,3 МБ' },
        { id: 'dict', kind: 'post', title: 'Словарь всех терминов для ОГЭ', url: 'https://t.me/ravilcandi/6875' }
      ]
    },
    {
      title: 'По разделам',
      items: [
        { id: 'duh', kind: 'pdf', title: 'Вся духовная культура и экономика', url: 'https://t.me/ravilcandi/9937', file: 'духовка и экономика.pdf', size: '24 МБ', sections: ['Сфера духовной культуры', 'Экономика'] },
        { id: 'nalogi', kind: 'post', title: 'Шпора по налогам', url: 'https://t.me/ravilcandi/11805', topics: ['nalogi'] },
        { id: 'politika', kind: 'pdf', title: 'Вся политика на ОГЭ за 30 минут', url: 'https://t.me/ravilcandi/6381', file: 'КЗ_Вся политика на ОГЭ за 30 минут.pdf', size: '6,5 МБ', sections: ['Политика'] },
        { id: 'partii', kind: 'post', title: 'Карточки по политическим партиям', url: 'https://t.me/ravilcandi/7076', topics: ['partii'] },
        { id: 'formy', kind: 'post', title: 'Разбор форм государства', url: 'https://t.me/ravil_candi/9725', topics: ['formy'] },
        { id: 'polnomochiya', kind: 'post', title: 'Все полномочия органов государственной власти', url: 'https://t.me/ravilcandi/10106', topics: ['prezident', 'parlament', 'pravitelstvo', 'sudy', 'federaciya'] },
        { id: 'pravo', kind: 'pdf', title: 'Основы права', url: 'https://t.me/ravilcandi/7201', file: 'КЗ_Основы права.pdf', size: '7,1 МБ', sections: ['Право'] }
      ]
    },
    {
      title: 'Задания ФИПИ',
      items: [
        { id: 'fipi-var1', kind: 'post', title: 'Разбор 1-го варианта сборника ФИПИ', url: 'https://t.me/ravilcandi/9337' },
        { id: 'fipi-razbor', kind: 'post', title: 'Разбор заданий ФИПИ', url: 'https://t.me/ravilcandi/10613' },
        { id: 'z20', kind: 'pdf', title: 'Тренажёр по понятиям (№20 КИМ)', note: 'ответы в конце', url: 'https://t.me/ravilcandi/11077', file: 'Тренажёр №20 КИМ.pdf', size: '11,2 МБ' },
        { id: 'z6', kind: 'pdf', title: 'Все задания №6 КИМ с ФИПИ', note: 'с ответами', url: 'https://t.me/ravilcandi/11029', file: 'Все задания №6 КИМ с ФИПИ.pdf', size: '28,1 МБ' },
        { id: 'z5', kind: 'pdf', title: 'Все задания №5 КИМ с ФИПИ', note: '136 реальных заданий с ответами', url: 'https://t.me/ravilcandi/10760', file: 'Все задания №5 КИМ с ФИПИ.pdf', size: '63,4 МБ' },
        { id: 'z12', kind: 'pdf', title: 'Топ-5 типов заданий №12', url: 'https://t.me/ravilcandi/10851', file: 'КЗ. Топ 5 заданий №12 ОГЭ.pdf', size: '3,8 МБ' }
      ]
    },
    {
      title: 'Подборки',
      items: [
        { id: 'theory5', kind: 'post', title: 'Подборка теории для пятёрки', url: 'https://t.me/ravilcandi/6496' },
        { id: 'part2', kind: 'post', title: 'Подборка роликов для 2 части', url: 'https://t.me/ravilcandi/7839' },
        { id: 'zero', kind: 'post', title: 'Для тех, кто начинает с нуля', url: 'https://t.me/ravilcandi/7486' }
      ]
    },
    {
      title: 'Видеоразборы',
      items: [
        { id: 'v-demo27', kind: 'video', title: 'Разбор демоверсии ОГЭ 2027', url: 'https://youtu.be/r4GgHH2oALs', yt: 'r4GgHH2oALs' },
        { id: 'v-grade8', kind: 'video', title: 'Все темы за 8 класс', url: 'https://youtu.be/a3lS-bTNHYc', yt: 'a3lS-bTNHYc' },
        { id: 'v-all8', kind: 'video', title: 'Всё обществознание 8 класса для ОГЭ', url: 'https://youtu.be/rF7vh97_wsc', yt: 'rF7vh97_wsc' },
        { id: 'v-topics', kind: 'video', title: 'Темы, которые точно будут на ОГЭ', url: 'https://youtu.be/du7h3o6g3EI', yt: 'du7h3o6g3EI' },
        { id: 'v-plan', kind: 'video', title: 'План подготовки к ОГЭ', url: 'https://youtu.be/Cf7nYPbUumA', yt: 'Cf7nYPbUumA' }
      ]
    }
  ]
};
