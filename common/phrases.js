/* SubLingo — устойчивые выражения и фразовые глаголы.
   Строка: «слова|перевод». Знак ~ — между словами может стоять 1–2 слова (figure it out, turn the light off).
   Первое слово ищется по начальной форме (went → go), остальные — буквально. */
var SL = (typeof SL !== 'undefined') ? SL : {};
(function (SL) {
  'use strict';

  const RAW = `
give up|сдаться; бросить (занятие)
give ~ back|вернуть, отдать обратно
give in|уступить, сдаться
give ~ away|отдать, раздать; выдать (секрет)
give out|раздавать; отказать, иссякнуть
give ~ a hand=give someone a hand|помочь
get up|встать (с кровати)
get out|выйти, выбраться; убирайся
get in|сесть (в машину), войти; попасть (в беду)
get on|сесть (в транспорт); ладить
get off|выйти (из транспорта), слезть
get back|вернуться; вернуть
get over|пережить, оправиться от
get away|уйти, сбежать
get away with|остаться безнаказанным
get along|ладить, уживаться
get through|пройти через, пережить; дозвониться
get by|справляться, сводить концы с концами
get into|попасть, ввязаться; увлечься
get to|добраться до; получить возможность
get rid of|избавиться от
get used to|привыкнуть к
get ~ together|собраться (вместе)
get it|понять (got it — понял, ясно)
go on|продолжать; происходить (what's going on — что происходит)
go out|выходить (гулять); погаснуть
go out with|встречаться (с кем-то)
go back|вернуться
go away|уйти, исчезнуть
go ahead|давай, вперёд; продолжай
go off|сработать (будильник); взорваться; уйти
go over|просмотреть, повторить
go through|пройти через, пережить; просмотреть
go up|подниматься, расти
go down|спускаться, снижаться
go wrong|пойти не так
come on|давай!, ну же
come back|вернуться
come in|войти, заходи
come up|возникнуть, всплыть
come up with|придумать
come out|выйти; стать известным
come over|зайти (в гости)
come across|случайно встретить, наткнуться
come along|пойти вместе; продвигаться
come down|спуститься; снизиться
come from|быть родом из, происходить от
come true|сбыться
look for|искать
look after|присматривать, заботиться
look ~ up|найти (в словаре, в интернете); посмотреть вверх
look out|осторожно!, берегись
look forward to|ждать с нетерпением
look like|быть похожим, выглядеть как
look into|разобраться, изучить
look around|осмотреться
look back|оглянуться, вспомнить прошлое
look up to|уважать, равняться на
find ~ out|узнать, выяснить
figure ~ out|понять, разобраться, выяснить
work ~ out|получиться; тренироваться; решить
work on|работать над
turn ~ on|включить
turn ~ off|выключить
turn ~ up|сделать громче; появиться
turn ~ down|убавить; отказать
turn around|обернуться, развернуться
turn into|превратиться в
turn out|оказаться
put ~ on|надеть; включить
put ~ off|отложить
put ~ away|убрать (на место)
put ~ down|положить; опустить
put up with|терпеть, мириться с
put ~ out|потушить
take ~ off|снять (одежду); взлететь
take ~ out|вынуть; пригласить (куда-то)
take care of|позаботиться о
take ~ back|забрать обратно; взять слова назад
take over|взять на себя, захватить
take after|быть похожим на (родителя)
take place|происходить, состояться
take part in|участвовать в
take it easy|не напрягайся, расслабься
pick ~ up|поднять; забрать (кого-то); взять трубку
set ~ up|устроить, настроить; подставить
set off|отправиться в путь
make ~ up|выдумать; помириться; накраситься
make up for|возместить, загладить
make sure|убедиться, проследить
make sense|иметь смысл, быть понятным
make out|разобрать (что-то); целоваться
make fun of|высмеивать, издеваться
break up|расстаться; разойтись
break down|сломаться; расплакаться
break into|вломиться
break out|вспыхнуть, начаться; сбежать
bring ~ up|поднять (тему); растить
bring ~ back|вернуть, принести обратно
call ~ back|перезвонить
call off|отменить
calm down|успокоиться
cheer up|взбодриться, не унывай
check ~ out|посмотреть, заценить; выписаться
check in|зарегистрироваться; проведать
clean ~ up|убрать, прибрать
cut ~ off|отрезать; перебить
cut down on|сократить (потребление)
deal with|разобраться с, справиться с
end up|в итоге оказаться
fall apart|развалиться
fall asleep|заснуть
fall down|упасть
fall for|влюбиться; купиться на
fall behind|отстать
fill ~ in|заполнить (форму); ввести в курс дела
fill ~ out|заполнить (анкету)
fit in|вписаться, прижиться
freak out|психануть, перепугаться
grow up|вырасти, повзрослеть
hang out|тусоваться, проводить время
hang on|подожди; держись
hang up|повесить трубку
hold on|подожди; держись
hold ~ back|сдерживать
hurry up|поторопись
keep on|продолжать
keep up with|успевать за, не отставать
keep up|не отставать; продолжать
keep away|держаться подальше
knock ~ out|вырубить
let ~ down|подвести, разочаровать
let ~ go|отпустить
let ~ in|впустить
let ~ know=let someone know|сообщить, дать знать
log in|войти (в аккаунт)
mess up|напортачить, испортить
mess with|связываться с, трогать
mix ~ up|перепутать
move on|двигаться дальше, отпустить прошлое
move in|въехать, поселиться
move out|съехать
pass out|потерять сознание
pass away|скончаться
pay ~ back|вернуть долг; отомстить
pay attention|обращать внимание
pay off|окупиться; расплатиться
point out|указать, заметить
pull over|остановиться у обочины
pull off|провернуть, суметь сделать
run away|убежать
run into|столкнуться, случайно встретить
run out of|закончиться (о запасе)
run out|закончиться, иссякнуть
show up|появиться, прийти
show off|выпендриваться, хвастаться
shut up|замолчи, заткнись
shut ~ down|закрыть, выключить
sit down|сесть
stand up|встать
stand out|выделяться
stand for|означать; терпеть
stand by|быть рядом, поддерживать
stay up|не ложиться спать
stay away|держаться подальше
slow down|замедлиться, сбавь темп
sort ~ out|уладить, разобраться
speak up|говорить громче; высказаться
stick to|придерживаться
stick around|остаться, побыть рядом
think ~ over|обдумать
throw ~ away|выбросить
throw up|блевать, тошнить
try ~ on|примерить
try ~ out|попробовать, испытать
wake up|проснуться
warm up|разогреться, размяться
watch out|осторожно!, берегись
wear out|изнашиваться; утомиться
wind up|в итоге оказаться
wipe out|уничтожить
write ~ down|записать
count on|рассчитывать на
depend on|зависеть от
rely on|полагаться на
belong to|принадлежать
care about|заботиться о, переживать за
believe in|верить в
catch up|догнать; наверстать
used to|раньше (бывало); be used to — привык к
be about to|вот-вот, сейчас (собираюсь)
be supposed to|должен (по плану), предполагается
have to|должен, приходится
have got to|должен, надо
got to|должен, надо
had better|лучше бы (тебе), стоит
would rather|предпочёл бы, лучше бы
can't help|не могу не…, ничего не поделать
can't wait|не терпится
by the way|кстати
kind of|вроде, как бы; what kind of — какой
sort of|вроде, как бы
at least|по крайней мере
at all|вообще, совсем (с отрицанием)
in fact|на самом деле
after all|в конце концов; всё-таки
of course|конечно
as well as|а также
as well|тоже, также
so far|пока что, до сих пор
right away|сразу же
right now|прямо сейчас
no way|ни за что; не может быть
never mind|неважно, забудь
no matter|неважно, независимо от
in order to|чтобы
as long as|пока; при условии что
as soon as|как только
even though|хотя, несмотря на то что
even if|даже если
on purpose|нарочно
by accident|случайно
at first|сначала
at last|наконец-то
in case|на случай если
all of a sudden|внезапно
all the time|всё время
from now on|отныне, с этого момента
once in a while|время от времени
every now and then|время от времени
up to you|решать тебе
what's up|как дела?, что случилось?
how come|как так?, почему
what if|а что если
in front of|перед, впереди
instead of|вместо
because of|из-за
according to|согласно, по словам
thanks to|благодаря
in the end|в конце концов, в итоге
on the other hand|с другой стороны
for example|например
for instance|например
as if|как будто
as though|как будто
so that|чтобы, так что
such as|такой как, например
a little bit|немного, чуть-чуть
a bit|немного
a lot of|много
a lot|много, очень
lots of|много
a couple of|пара, несколько
each other|друг друга
one another|друг друга
more or less|более-менее
sooner or later|рано или поздно
over and over|снова и снова
little by little|понемногу
on the way|по пути; в пути
on my way|уже иду, в пути
on time|вовремя
in time|вовремя, успеть
out of nowhere|из ниоткуда
by the time|к тому времени как
as a matter of fact|вообще-то, на самом деле
to be honest|честно говоря
in general|в целом
at the moment|в данный момент
all right|хорошо, ладно
you know|знаешь, ну (вставное)
i mean|то есть, я имею в виду
i guess|наверное, думаю
come to think of it|если подумать
`;

  // неправильные формы, которых нет в общем лемматизаторе
  const IRR = { found: 'find', fell: 'fall', fallen: 'fall', left: 'leave', felt: 'feel', spoke: 'speak', spoken: 'speak', saw: 'see', seen: 'see', led: 'lead', hid: 'hide', hidden: 'hide', lit: 'light', stuck: 'stick', hung: 'hang', shook: 'shake', woke: 'wake', woken: 'wake', wound: 'wind', ran: 'run', knew: 'know', known: 'know', did: 'do', done: 'do', does: 'do', had: 'have', has: 'have', went: 'go', gone: 'go', got: 'get', gotten: 'get', made: 'make', took: 'take', taken: 'take', came: 'come', gave: 'give', given: 'give', put: 'put', set: 'set', let: 'let', cut: 'cut', shut: 'shut', held: 'hold', kept: 'keep', brought: 'bring', thought: 'think', caught: 'catch', threw: 'throw', thrown: 'throw', wore: 'wear', worn: 'wear', broke: 'break', broken: 'break', paid: 'pay', grew: 'grow', grown: 'grow', sat: 'sit', stood: 'stand', wrote: 'write', written: 'write', 'gonna': 'go' };
  const CONTR = { "'m": ['be'], "'re": ['be'], "'s": ['be', 'have'], "'ve": ['have'], "'d": ['had', 'would'], "'ll": ['will'] };
  const BE = new Set(['am', 'is', 'are', 'was', 'were', 'been', 'being', 'be']);
  const DET = new Set(['the', 'a', 'an', 'my', 'your', 'his', 'her', 'our', 'their', 'its', 'this', 'that', 'these', 'those', 'some']);

  const byFirst = new Map();
  RAW.trim().split('\n').forEach(row => {
    const bar = row.indexOf('|');
    if (bar < 0) return;
    let head = row.slice(0, bar).trim(), canon = null;
    const eq = head.indexOf('=');
    if (eq > 0) { canon = head.slice(eq + 1).trim(); head = head.slice(0, eq); }
    const parts = head.trim().toLowerCase().split(/\s+/);
    const words = [], gaps = [];
    parts.forEach(w => { if (w === '~') gaps[words.length] = true; else words.push(w); });
    const e = { words, gaps, canon: canon || words.join(' '), gloss: row.slice(bar + 1).trim() };
    if (!byFirst.has(words[0])) byFirst.set(words[0], []);
    byFirst.get(words[0]).push(e);
  });
  for (const list of byFirst.values()) list.sort((a, b) => b.words.length - a.words.length);

  function firstKeys(low) {
    const keys = [low];
    const lem = SL.lemma ? SL.lemma(low) : low;
    if (lem !== low) keys.push(lem);
    if (IRR[low]) keys.push(IRR[low]);
    if (BE.has(low)) keys.push('be');
    const m = /^(.+?)('m|'re|'s|'ve|'d|'ll)$/.exec(low);
    if (m) keys.push(...CONTR[m[2]]);
    return [...new Set(keys)];
  }

  /* Найти выражения в токенах SL.tokenize. Возвращает [{a, b, canon, gloss}] — индексы токенов (включительно). */
  SL.findExpr = function (toks) {
    const W = [];
    toks.forEach((t, i) => { if (t.t === 'w') W.push({ i, low: t.text.toLowerCase().replace(/[’‘`]/g, "'") }); });
    if (W.length < 2) return [];
    // между соседними словами — знак препинания? тогда выражение не перескакивает
    const brk = [];
    for (let j = 0; j < W.length - 1; j++) {
      const between = toks.slice(W[j].i + 1, W[j + 1].i);
      brk[j] = between.some(t => t.t === 'n' || (t.t === 's' && /[.,!?;:…"“”()\[\]—–]/.test(t.text)));
    }
    const out = [];
    let j = 0;
    while (j < W.length - 1) {
      let best = null;
      for (const key of firstKeys(W[j].low)) {
        for (const e of (byFirst.get(key) || [])) {
          if (best && best.e.words.length >= e.words.length) continue;
          let pos = j, ok = true, gapUsed = false;
          for (let k = 1; k < e.words.length && ok; k++) {
            if (pos + 1 < W.length && !brk[pos] && W[pos + 1].low === e.words[k]) { pos++; continue; }
            ok = false;
            if (e.gaps[k]) {
              for (let g = 1; g <= 2 && !ok; g++) {
                const n = pos + 1 + g;
                if (n >= W.length) break;
                let clean = true;
                for (let q = pos; q < n; q++) if (brk[q]) clean = false;
                if (clean && W[n].low === e.words[k]) { pos = n; ok = true; gapUsed = true; }
              }
            }
          }
          if (!ok) continue;
          // «put it on the table» — частица оказалась предлогом
          if (gapUsed && pos + 1 < W.length && !brk[pos] && DET.has(W[pos + 1].low)) continue;
          best = { e, end: pos };
        }
      }
      if (best) {
        out.push({ a: W[j].i, b: W[best.end].i, canon: best.e.canon, gloss: best.e.gloss });
        j = best.end + 1;
      } else j++;
    }
    return out;
  };
})(SL);
