import express from 'express';
import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import studentSchema from './models/student.js';
import callerScema from './models/caller.js';
import mongoose from 'mongoose';
import { Markup } from 'telegraf';
import comments from './comments.json' assert { type: 'json' };

import { session } from 'telegraf';
import {
  noVerify,
  isVerifyed,
  confirmOrCancelorSleep,
  getStudent,
  showNextStudent,
  capitalize,
  topCallers,
  changeSubject,
  usersStats,
  change
} from './functions/functions.js'


dotenv.config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const admin = process.env.ADMIN_ID
const port = process.env.PORT || 3000;

bot.use(session());

const Caller = mongoose.model('Caller', callerScema, 'callers');
const Student = mongoose.model('Student', studentSchema, 'all_users');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Connection error:', err));

bot.start(async (ctx) => {
  let caller = await Caller.findOne({ id: ctx.from.id });
  if (!caller) {
    caller = new Caller({
      id: ctx.from.id,
      name: `${ctx.from.first_name} ${ctx.from.last_name || ''}`.trim(),
      username: ctx.from.username || '',
      status: false
    });
    await caller.save();
  }

  if(caller.status){
    await ctx.reply(`Ինչ էլ հավես ունես, ${ctx.from.first_name} ջան...\nԼավ, կպի գործիդ:`,
      Markup.inlineKeyboard([
        Markup.button.callback('👨‍💻Կպնել գործին', 'calling')
      ])
    )
  }else noVerify(ctx)
});

bot.command('ip', async(ctx) =>{
  fetch('https://api.ipify.org?format=json')
  .then(res => res.json())
  .then(data => {
    ctx.reply(data.ip);
  })
  .catch(err => {
    ctx.reply('err')
  });
})



bot.command('id', async(ctx) =>  ctx.reply(ctx.from.id, {reply_to_message_id: ctx.message.message_id}))

bot.command('add', async (ctx) => {
  if (ctx.from.id == admin) {
    const uid = ctx.message.text.split(' ').slice(1)[0];
    if (!uid) {
      return ctx.reply("⚠️ Պետք է նշեք UID-ը։ Օրինակ՝ /add 123456", {reply_to_message_id: ctx.message.message_id});
    }

    const caller = await Caller.findOne({id: uid})
    const activeCount = await Caller.countDocuments({ status: true });

    if(!caller){
      return ctx.reply("Այդ օգտատերը դեռ մուտք չի գործել բոտ", {reply_to_message_id: ctx.message.message_id})
    }

    if (!caller.status){
      caller.status = true;
      await caller.save();
      
      await bot.telegram.sendMessage(uid, '🎉 Դուք նույնականացված եք', 
        Markup.inlineKeyboard([
          Markup.button.callback('👨‍💻Կպնել գործին', 'calling')
        ])
      );
      await bot.telegram.sendMessage(uid,
        `Կարող եք օգտագործել հետևյալ հրամանները։\n\n`+
        `/stats - ընդհանուր վիճակագրություն։\n`+
        `/find (UID կամ համար) - դիմորդին գտնելու համար։\n`+
        `/id - ձեր Telegram id-ը ստանալու համար։`
      );
      await ctx.reply(`✅ <a href="tg://user?id=${caller.id}">${caller.name || caller.username || 'Անհայտ օգտատեր'}</a> նույնականացված է:\n📊 Ընդհանուր ${activeCount + 1} զանգող։`, 
        {
          reply_to_message_id: ctx.message.message_id,
          parse_mode: 'HTML'
        });
    } else {
      await ctx.reply(`🤔 <a href="tg://user?id=${caller.id}">${caller.name || caller.username || 'Անհայտ օգտատեր'}</a> արդեն նույնականացված էր\n📊 Ընդհանուր ${activeCount} զանգող։`, {
        reply_to_message_id: ctx.message.message_id,
        parse_mode: 'HTML'
      });
    }
  } else {
    ctx.reply("⛔ Դուք չունեք դրա իրավունքը", {reply_to_message_id: ctx.message.message_id});
  }
});
bot.command('remove', async (ctx) =>{
  if(ctx.from.id == admin){
    const uid = ctx.message.text.split(' ').slice(1)[0];

    if (!uid) {
      return ctx.reply("⚠️ Պետք է նշեք UID-ը։ Օրինակ՝ /add 123456", {reply_to_message_id: ctx.message.message_id});
    }

    const caller = await Caller.findOne({id: uid})
    const activeCount = await Caller.countDocuments({ status: true });

    if(caller){
      caller.status = false;
      await caller.save()
      await bot.telegram.sendMessage(uid, '💔 Դուք ապանույնականացվել եք')
      await ctx.reply(`✅ <a href="tg://user?id=${caller.id}">${caller.username || caller.name || 'Անհայտ օգտատեր'}</a>-ը ապանույնականացված է:\n📊 Ընդհանուր ${activeCount - 1} զանգող։`, 
        {
          reply_to_message_id: ctx.message.message_id,
          parse_mode: 'HTML'
        })
    }else{
      await ctx.reply(`🤔 <a href="tg://user?id=${caller.id}">${caller.username || caller.name || 'Անհայտ օգտատեր'}</a>-ը չկար ցուցակում\nԸնդհանուր ${activeCount} զանգող։`, 
        {
          reply_to_message_id: ctx.message.message_id,
          parse_mode: 'HTML'        
        })
    }

  }else ctx.reply("⛔ Դուք չունեք դրա իրավունքը", {reply_to_message_id: ctx.message.message_id})
});
bot.command('stats', async (ctx) => usersStats(ctx)
)
bot.command('find', async (ctx) => {
  if(await isVerifyed(ctx)){
    const args = ctx.message.text.split(' ').slice(1);
    const text = args[0]?.trim();

    if (!text) {
      return ctx.reply('⚠️ Գրեք UID կամ հեռախոսահամար:\nՕրինակ՝ `/find 1234` կամ `/find +374XXXXXXXX`', { parse_mode: 'Markdown' });
    }

    if (/^\d{4}$/.test(text)) {
      const uid = parseInt(text, 10);
      await getStudent(ctx, uid, "uid");
    } else if (/^\+374\d{8}$/.test(text)) {
      const phone = text;
      await getStudent(ctx, phone, 'phone');
    } else {
      await ctx.reply("❌ Սխալ ձևաչափ։ Օգտագործեք 4-նիշ UID կամ +374XXXXXXXX ձևաչափով հեռախոսահամար։");
    }
  }else noVerify(ctx)
});
bot.command('me', async (ctx)=>{
  try {
    const caller = await Caller.findOne({id: ctx.from.id})

    if(!caller)
      return ctx.reply('❗ Դուք չկաք ցուցակում', {reply_to_message_id: ctx.message.message_id})
    ctx.reply(
      `📊 Դուք զանգահել եք ${caller.callCount.summary} դիմորդի, որոնցից\`\n\n`+
      `✅ ${caller.callCount.confirmed} դիմորդ հաստատել է\n` +
      `❌ ${caller.callCount.cancelled} դիմորդ չեղարկել է\n` +
      `😴 ${caller.callCount.noAnswer} դիմորդ քնած է`,
      `📵 ${caller.callCount.wrong} դիմորդ սխալ համարով է`,
      
      {reply_to_message_id: ctx.message.message_id}
    )
  } catch (e) {
    console.log(e);
  }
})
bot.command('topCallers', async (ctx) => topCallers(ctx));

bot.action('next', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageReplyMarkup(null);
  await showNextStudent(ctx);
})
bot.action(/^confirm_(.+)$/, async (ctx) => {
  if (!(await isVerifyed(ctx))){
    await ctx.editMessageReplyMarkup(null);
    return noVerify(ctx);
  }
  
  const uid = ctx.match[1]
  confirmOrCancelorSleep(ctx, uid, 'confirm')
});
bot.action(/^cancel_(.+)$/, async (ctx) => {
  if (!(await isVerifyed(ctx))){
    await ctx.editMessageReplyMarkup(null);
    return noVerify(ctx);
  }
  const uid = ctx.match[1]
  await confirmOrCancelorSleep(ctx, uid, 'cancel')
});

bot.action(/^wrong_(.+)$/, async (ctx) => {
  if (!(await isVerifyed(ctx))){
    await ctx.editMessageReplyMarkup(null);
    return noVerify(ctx);
  }
  const uid = ctx.match[1]
  await confirmOrCancelorSleep(ctx, uid, 'wrong')
});

bot.action(/^noAnswer_(.+)$/, async (ctx) => {
  if (!(await isVerifyed(ctx))){
    await ctx.editMessageReplyMarkup(null);
    return noVerify(ctx);
  }
  const uid = ctx.match[1]
  await confirmOrCancelorSleep(ctx, uid, 'noAnswer')
});
bot.action(/^done_(.+)_(.+)$/, async (ctx)=> {
  if (!(await isVerifyed(ctx))){
    await ctx.editMessageReplyMarkup(null);
    return noVerify(ctx);
  }
  try{
    const uid = ctx.match[1];
    const stat = ctx.match[2]
    const student = await Student.findOne({uid: uid});
    const caller = await Caller.findOne({id: ctx.from.id});

    const newText = 
    `👤 Անուն: ${student.first_name} ${student.last_name}\n` +
    `🆔 UID: ${student.uid}\n` +
    `📞 Հեռախոս: ${student.phone}\n` +
    `📚 Առարկաներ: ${student.subjects.map(item => capitalize(item)).join(', ')}\n\n`+
    `${
      stat == "confirm" ? '✅ Հաստատված է' 
      : stat == "cancel" ? '❌ Չեղարկված է' 
      : stat == "wrong" ? "📵 Սխալ համար"
      : "😴 Քնած ա"
    }`;
  
    await ctx.editMessageText(newText, Markup.inlineKeyboard([
      Markup.button.callback('Հաջորդը ⏭️', 'next')
    ]));

    if(stat === "confirm")
      student.status = 'confirmed'
    else if(stat === "cancel") 
      student.status = 'cancelled'
    else if(stat === 'noAnswer')
      student.status = 'noAnswer'
    else if(stat === 'wrong')
      student.status = 'wrong'

    caller.callCount.summary =  caller.callCount.summary + 1
    caller.callCount[student.status] = caller.callCount[student.status] + 1;
    
    await ctx.answerCbQuery(
      comments[stat][Math.floor(Math.random() * comments[stat].length)]
    );
    
    caller.markModified('callCount');
    await student.save()
    await caller.save()
  }catch(e){
    console.error("Err", e);
  }
});
bot.action(/^back_(.+)$/, async (ctx) => {
  if (!(await isVerifyed(ctx))){
    await ctx.editMessageReplyMarkup(null);
    return noVerify(ctx);
  }
  try {
    const uid = ctx.match[1];
    const student = await Student.findOne({uid: uid});
    
    if (!student) {
      await ctx.answerCbQuery('❌ Ուսանողը չի գտնվել');
      return;
    }

    await ctx.editMessageReplyMarkup({
      inline_keyboard: [
        [Markup.button.callback('✅ Հաստատել', `confirm_${student.uid}`)],
        [Markup.button.callback('❌ Չեղարկել', `cancel_${student.uid}`)],
        [Markup.button.callback('⁉️ Չպատասխանեց', `noAnswer_${student.uid}`)],
        [Markup.button.callback('📵 Սխալ համար', `wrong_${student.uid}`)],
        [Markup.button.callback('🔄 Փոփոխություն', `change_${student.uid}`)]
      ]
    });

  } catch (error) {
    console.error('Խնդիր back action-ի ժամանակ:', error);
    await ctx.answerCbQuery('❌ Տեղի ունեցավ սխալ');
  }
});
bot.action(/^verify_(.+)$/, async (ctx) => {
  const uid = ctx.match[1]
  const message = `🛡️ Նույնականացման համար փոխանցեք ձեր id-ն ադմինիստրատորին\n\n 🔐 <code>${uid}</code>`
  await ctx.editMessageReplyMarkup({
    inline_keyboard: []
  })
  bot.telegram.sendMessage(uid, message, {parse_mode: 'HTML'})
});
bot.action(/^change_(.+)$/, async (ctx) => change(ctx ));
bot.action(/^changeSubject_(.+)_(.+)_(.+)/, async (ctx) => changeSubject(ctx));

bot.action('calling', async (ctx) => {
  await ctx.editMessageReplyMarkup(null);
  if(await isVerifyed(ctx)){
    await showNextStudent(ctx);
  }else noVerify(ctx)
});
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx?.reply('Առաջացավ խնդիր բոտի աշխատանքում');
});
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

bot.launch()
  .then(() => console.log('Bot is running'))
  .catch(err => {
    console.error('Bot launch failed:', err);
    process.exit(1);
});


process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));