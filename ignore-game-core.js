/* Scenario trainer, v1. No AI, remote calls, payment claims or participant writes. */
(function(root){
  'use strict';
  const steps=['Вернуть контакт','Узнать сомнение','Предложить шаг'];
  const hints=[
    'Саша, привет! Вспомнил про твою задачу: заявки есть, а до оплаты не доходят. Собрал пример разбора такой переписки. Прислать?',
    'Что больше всего смущает в разборе? Какой результат тебе нужен, чтобы он был полезен?',
    'Понимаю. Давай пришлю пример с конкретными репликами для клиента, а ты решишь, подходит ли такой формат. Прислать?'
  ];
  function fresh(){return {version:1,step:0,turns:0,done:false,success:false,draft:'',hint:false,checks:[],messages:[{who:'client',text:'Хорошо, я завтра оплачу',old:true}],coach:'Попробуй напомнить об оплате. Ты продаёшь разбор переписки: Саша хочет доводить больше заявок до покупки.'};}
  function classify(text,step){
    const t=text.toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();
    if(/(не пишите|не пиши|отстань|пошел|иди на|иди ты|лох|идиот)/u.test(t))return 'hostile';
    if(/(когда.{0,20}(оплат|заплат|перевед)|вы.{0,8}обещали|ты.{0,8}обещал|жду.{0,12}(оплат|деньг)|где.{0,8}деньг|ну что.{0,12}(оплат|деньг)|срочно.{0,15}(оплат|заплат)|оплати(те)?\s+(сейчас|уже)|обязан|должны оплат)/u.test(t))return 'pressure';
    if(step===0){
      if(/(пример|разбор|иде[яю]|наш[её]л|нашла|полез|подсказ|переписк|решени|вариант)/u.test(t)&&/(присла|отправ|покаж|посмотр|интерес|подел|задач|помо|заяв|хоч)/u.test(t))return 'value';
      if(/(актуал|как дела|как у (тебя|вас)|получил|получилось|есть ли вопросы|что.{0,20}(смущает|мешает|останавливает))/u.test(t))return 'contact';
    }
    if(step===1 && /(что.{0,35}(смуща|останавл|меша|важн|нужн)|како[йегую].{0,22}(результат|сомнен|ожидан|опасен)|чего.{0,15}(опаса|ожида)|в чем.{0,15}(сомнен|причин)|расскажи|почему|сомнева)/u.test(t))return 'question';
    if(step===2 && /(пример|фрагмент|реплик|переписк|созвон|покаж|пришлю|присла|встреч)/u.test(t) && /(\?|давай|можем|предлага|если.{0,12}(хоч|удоб)|соглас|решишь|решите)/u.test(t))return 'step';
    return 'unknown';
  }
  function igSubmit(previous,text){
    const value=String(text).trim();
    if(previous.done||!value||value.length>600)return {state:previous,accepted:false};
    const s=JSON.parse(JSON.stringify(previous)),kind=classify(value,s.step);
    s.draft='';s.hint=false;s.turns++;s.messages.push({who:'you',text:value});
    if(kind==='hostile'){
      s.messages.push({who:'client',text:'Не хочу продолжать в таком тоне.'});
      s.coach='В этом сценарии разговор закончился. В разборе посмотрим, как вернуть контакт без конфликта.';s.done=true;
    }else if(kind==='pressure'){
      s.messages.push({who:'status',text:'Прочитано. Ответа пока нет.'});
      s.coach='Здесь клиент снова замолчал: напоминание о деньгах не дало повода ответить. Попробуй вернуться к его задаче, а не к обещанию оплатить.';
    }else if(kind==='unknown'){
      s.messages.push({who:'status',text:'Сценарная пауза'});
      s.coach='Для этой формулировки пока нет сценарного ответа. Это не оценка твоего сообщения. Попробуй написать иначе или возьми подсказку.';
    }else{
      const replies=[
        kind==='value'?'Привет! Да, покажи. Только я пока сомневаюсь насчёт самого разбора.':'Привет! Да, задача актуальна. Только я пока сомневаюсь насчёт самого разбора.',
        'Не хочу снова купить теорию. Мне нужны конкретные фразы: что отвечать, когда спрашивают цену и исчезают.',
        'Да, пришли такой пример. Посмотрю и решу, подходит ли мне разбор.'
      ];
      s.messages.push({who:'client',text:replies[s.step]});s.checks.push(kind);s.step++;
      s.coach=['','Контакт появился. Теперь выясни, что именно смущает Сашу.','Теперь понятна причина сомнения. Предложи маленький следующий шаг, который поможет принять решение.','Ты вернул диалог и договорился о конкретном действии. Оплаты пока нет — клиент ещё выбирает.'][s.step];
      if(s.step===3){s.done=true;s.success=true;}
    }
    if(!s.done&&s.turns>=6){s.done=true;s.coach='На этом остановим попытку и посмотрим разбор. Клиент пока не согласился на следующий шаг.';}
    return {state:s,accepted:true,kind};
  }
  function valid(s){return !!s&&s.version===1&&Number.isInteger(s.step)&&s.step>=0&&s.step<=3&&Number.isInteger(s.turns)&&s.turns>=0&&s.turns<=6&&typeof s.done==='boolean'&&typeof s.success==='boolean'&&(!s.success||(s.done&&s.step===3))&&Array.isArray(s.messages)&&s.messages.length<=13&&s.messages.every(x=>x&&['client','you','status'].includes(x.who)&&typeof x.text==='string'&&x.text.length<=600)&&typeof s.draft==='string'&&s.draft.length<=600&&typeof s.coach==='string'&&Array.isArray(s.checks);}
  const api={fresh,submit:igSubmit,valid,steps,hints,classify};root.IgnoreGameCore=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
