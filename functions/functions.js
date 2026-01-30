import { Markup } from "telegraf";
import userStatus from '../userStatus.json' assert { type: 'json' };
import studentSchema from '../models/student.js';
import callerScema from '../models/caller.js';
import mongoose from "mongoose";

const Caller = mongoose.model('Caller', callerScema, 'callers');
const Student = mongoose.model('Student', studentSchema, 'all_users');

const mySubjects = ['մաթեմատիկա','ռուսերեն','կենսաբանություն','քիմիա','անգլերեն','հայոց պատմություն','հայոց լեզու']

export async function noVerify(ctx) {
  const txt = `❌ ${ctx.from.first_name}, Դուք մերոնցից չեք։ Դեռ։`
  await ctx.reply(txt, Markup.inlineKeyboard([
    [Markup.button.callback('👤✅ Դառնալ մերոնցից', `verify_${ctx.from.id}`)]
  ]))
}

export async function isVerifyed(ctx){
  const caller = await Caller.findOne({id: ctx.from.id})
  if(caller){
    ctx.session = {}
    ctx.session.caller = caller
    return caller.status
  }
  return false
}

export async function getAndMarkStudentInProgress(ctx) {
  const days = {
    may3: ['մաթեմատիկա', 'կենսաբանություն', 'հայոց պատմություն'],
    may10: ['ռուսերեն', 'անգլերեն'],
    may11: ['քիմիա', 'հայոց լեզու']
  }

  const caller = ctx.session.caller
  const student = await Student.findOneAndUpdate(
    { status: 'pending',
      subjects: { $in: days.may3 }




      
    },
    { $set: { status: 'inProgress' }},
    {
      sort: { uid: 1 },
      new: true
    }
  );

  if (!student) return null;

  if (!student.callers.includes(caller.id)) {
    student.callers.push(caller.id);
    await student.save();
  }

  return student;
}

export async function confirmOrCancelorSleep(ctx, uid, stat){
  try{
    const student = await Student.findOne({uid: uid})

    if (!student) {
      await ctx.answerCbQuery('❌ Ուսանողը չի գտնվել');
      return;
    }

    if (student.subjects && student.subjects.length > 0) {
      const subjectButtons = []
      subjectButtons.push(
        stat == "confirm" ? [Markup.button.callback('✅ Հաստատել', `done_${uid}_${stat}`)]
        :stat == "cancel"? [Markup.button.callback('❌ Չեղարկել', `done_${uid}_${stat}`)]
        :stat == 'noAnswer'? [Markup.button.callback('😴 Երևի քնած է', `done_${uid}_${stat}`)]
        :stat == 'wrong'? [Markup.button.callback('📵 Սխալ համար', `done_${uid}_${stat}`)]
        :[]
      );
      
      subjectButtons.push([Markup.button.callback('◀️ Վերադառնալ', `back_${uid}`)]);
      
      await ctx.editMessageReplyMarkup({
        inline_keyboard: subjectButtons
      });
    } else {
      await ctx.answerCbQuery('Չկան առարկաներ');
    }
  }catch(e){
    console.log(e);
  }
}

export async function getStudent(ctx, uid, by = "uid") {
    try {
      const foundStudent = await Student.findOne({ [by]: String(uid) });
      if (foundStudent) {
        await ctx.reply(
          `👤 Անուն: ${foundStudent.first_name} ${foundStudent.last_name}\n` +
          `🆔 UID: ${foundStudent.uid}\n` +
          `📞 Հեռախոս: ${foundStudent.phone}\n` +
          `📚 Առարկաներ: ${foundStudent.subjects.map(item => capitalize(item)).join(', ')}\n\n`+
          `${userStatus[foundStudent.status]}`,
          Markup.inlineKeyboard([
            [Markup.button.callback('✅ Հաստատել', `confirm_${foundStudent.uid}`)],
            [Markup.button.callback('❌ Չեղարկել', `cancel_${foundStudent.uid}`)],
            [Markup.button.callback('⁉️ Չպատասխանեց', `noAnswer_${foundStudent.uid}`)],
            [Markup.button.callback('📵 Սխալ համար', `wrong_${foundStudent.uid}`)],
            [Markup.button.callback('🔄 Փոփոխություն', `change_${foundStudent.uid}`)]
          ])
        );
      } else {
        await ctx.reply('❗️Դիմորդ չի գտնվել։');
      }
    } catch (error) {
      console.error('Խնդիր getStudent-ի ժամանակ:', error);
      await ctx.reply('❌ Տեղի ունեցավ սխալ։ Խնդրում ենք փորձել նորից։');
    }
}

export async function showNextStudent(ctx) {
    const student = await getAndMarkStudentInProgress(ctx);
    if (!student) {
      await ctx.reply('❗️Դիմորդ չմնաց։');
      return;
    }
    await getStudent(ctx, student.uid);
}

export async function topCallers(ctx) {
  if(ctx.from.id == process.env.ADMIN_ID){
      try {
        const topCallers = await Caller.find({status: true}).sort({'callCount.summary': -1 });
        
        if (topCallers.length === 0) {
          return ctx.reply("😕 Տվյալներ չեն գտնվել:");
        }
        let msg = `🏆 Թոփ զանգողներ\n\n`;
        topCallers.forEach((caller, index) => {
          msg += `${index + 1}. <a href="tg://user?id=${caller.id}">${caller.name || caller.username || 'Անհայտ օգտատեր'}</a> — 📞 ${caller.callCount.summary} զանգ\n`;
        });
  
        ctx.reply(msg, { parse_mode: 'HTML' });
      } catch (e) {
        console.error('topCallers error:', e);
        ctx.reply("⚠️ Առաջացավ խնդիր, տվյալների ստացման ժամանակ։");
      }
  }
}

export async function changeSubject(ctx) {
  if (!(await isVerifyed(ctx)))
    return noVerify(ctx);
  try {
    const [, uid, item, todo ] = ctx.match
    const foundStudent = await Student.findOne({ uid: uid });
    if (foundStudent) {
      if(todo == "add"){
        foundStudent.subjects.push(item)
        await foundStudent.save()
      }
      if(todo == "remove"){
        foundStudent.subjects = foundStudent.subjects.filter((sbj) => sbj !== item)
        await foundStudent.save()
      }

      const subjectButtons = []
      mySubjects.forEach(item => {
        const isSelected = foundStudent.subjects.includes(item)
        subjectButtons.push([Markup.button.callback(`${isSelected ? "✅" : ""} ${capitalize(item)}`, `changeSubject_${foundStudent.uid}_${item}_${isSelected ? 'remove' : 'add'}`)])
      })

      subjectButtons.push([Markup.button.callback('◀️ Վերադառնալ', `back_${uid}`)]);

      await ctx.editMessageText(
        `👤 Անուն: ${foundStudent.first_name} ${foundStudent.last_name}\n` +
        `🆔 UID: ${foundStudent.uid}\n` +
        `📞 Հեռախոս: ${foundStudent.phone}\n` +
        `📚 Առարկաներ: ${foundStudent.subjects.map(item => capitalize(item)).join(', ')}\n\n` +
        `${userStatus[foundStudent.status]}`,
        {
          reply_markup: {
            inline_keyboard: subjectButtons
          }
        }
      );

    } else {
      await ctx.reply('❗️Դիմորդ չի գտնվել։');
    }
  }catch(e){
    await ctx.reply('Խնդիր բոտի աշխատանքում, fn: changeSubject(ctx)')
    console.error(e);
  }
}

export async function usersStats(ctx) {
  try {
      if(await isVerifyed(ctx)){
        const totalUsers = await Student.countDocuments();
        const pendingCount = await Student.countDocuments({ status: 'pending' });
        const confirmedCount = await Student.countDocuments({ status: 'confirmed' });
        const cancelledCount = await Student.countDocuments({ status: 'cancelled' });
        const noAnswerCount = await Student.countDocuments({ status: 'noAnswer' });
        const inProgress = await Student.countDocuments({ status: 'inProgress' });
        const wrong = await Student.countDocuments({ status: 'wrong' });
  
  
        const statsMessage = `
          Ընդհանուր - ${totalUsers} դիմորդ\n`+
          `✅ Հաստատել է - ${confirmedCount} դիմորդ\n`+
          `❌ Չեղարկել է - ${cancelledCount} դիմորդ\n`+
          `😴 Քնած է - ${noAnswerCount} դիմորդ\n`+
          `📵 Սխալ - ${wrong} դիմորդ\n`+
          `⏳ Ընթացքի մեջ - ${inProgress} դիմորդ\n`+
          `🎯 Մնաց - ${pendingCount} դիմորդ`;
  
        await ctx.reply(statsMessage);
      }else noVerify(ctx);
    } catch (error) {
      console.error(error);
      await ctx.reply('stat err');
    }
}

export async function change(ctx) {
  if (!(await isVerifyed(ctx)))
    return noVerify(ctx);
  try {
    const uid = ctx.match[1]
    const foundStudent = await Student.findOne({ uid: uid });

    if (foundStudent) {
      const subjectButtons = []
      mySubjects.forEach(item => {
        const isSelected = foundStudent.subjects.includes(item)
        subjectButtons.push([Markup.button.callback(`${isSelected ? "✅" : ""} ${capitalize(item)}`, `changeSubject_${foundStudent.uid}_${item}_${isSelected ? 'remove' : 'add'}`)])
      })

      subjectButtons.push([Markup.button.callback('◀️ Վերադառնալ', `back_${uid}`)]);

      await ctx.editMessageReplyMarkup({
        inline_keyboard: subjectButtons
      });

    } else {
      await ctx.reply('❗️Դիմորդ չի գտնվել։');
    }
  }catch(e){
    console.error(e);
  }
}

export const capitalize = txt => txt.charAt(0).toUpperCase() + txt.slice(1);