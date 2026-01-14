// ==UserScript==
// @name         母舰规则检定
// @author       叁崎
// @version      1.0.0
// @description  母舰TRPG规则插件，支持完整的角色卡录入、检定、自动压力计算等功能，使用 .ms help 获取帮助。
// @timestamp    2026-01-14
// @license      MIT
// @homepageURL  https://github.com/bizarreLiny/sealdice-script
// ==/UserScript==

const mstemplate = {
  name: 'MS',
  fullName: '母舰规则检定',
  authors: ['叁崎'],
  version: '1.0.0',
  updatedTime: '20260114',
  templateVer: '1.0.0',
  setConfig: {
    diceSides: 100,
    enableTip: '已切换至百分骰(d100),进入母舰模式',
    keys: ['ms', '母舰'],
    relatedExt: ['ms', 'coc7'], 
  },
  nameTemplate: {
    ms: {
      template: '{$t玩家_RAW} HP{生命值}/{生命值上限} 压力{压力}/{压力上限}',
      helpText: '自动设置母舰群名片',
    },
  },
  attrConfig: {
    top: ['力量', '速度', "智力", "战斗", "理智", "恐惧", "身体", '生命值', '压力', '压力下限'],
    ignores: ['生命值上限','压力上限'],
    showAs: {
      HP: '{生命值}/{生命值上限}',
      压力:'{压力}/{压力上限}'
    },
  },
  // 默认值
  defaults: {
    压力: 2,
    压力下限: 2,
    压力上限: 20,
    受训技能: 10,
    专家技能: 15,
    大师技能: 20,
  },
  alias: {
    生命值: ["hp","HP"],
    生命值上限: ["hpmax","hp上限","HP上限"],
    力量: ["str", "STR"],
    智力: ["int", "INT"],
    速度: ["speed"],
    战斗: ["combat","com"],
    理智: ["san", "SAN"],
    恐惧: ["fear"],
    身体: ["body"],
    压力: ["stress"],
    受训技能: ["受训"],
    专家技能: ["专家"],
    大师技能: ["大师"]
  },
  textMap: {
    'fish-test': {
      设置测试_成功: [['设置完成', 1]],
    },
  },
  textMapHelpInfo: null,
};
var helpTexts = {
  main: `母舰TRPG相关指令
使用 .set ms 切换母舰录卡模式
使用 .sn ms 自动更改群名片
使用 .ms <数量> 生成母舰角色（默认1次,最多10次）
使用 .rm <属性/豁免> 进行检定
使用 .rmb/p <属性/豁免> 进行优势[+]/劣势[-]检定
使用 .mp 进行惊恐检定
均可使用@进行代骰检定
`,
rm:`母舰属性/豁免检定:
使用 .rm <属性/豁免> 进行检定
使用 .rmb/p <属性/豁免> 进行优势[+]/劣势[-]检定
可通过 “属性+技能名” 实现组合检定，例：
  .rm 速度+零重力
检定失败时会自动计算压力。`,
mp:`惊恐检定:
使用 .mp 进行惊恐检定
 - 进行惊恐检定需投一次惊恐骰（1d20）
 - 得数大于当前压力检定成功
 - 得数小于或等于当前压力检定失败
 - 失败时根据出目自动从惊恐表中获取惊恐效果`
}

const panic = [
  `肾上腺素激增：之后 2d10 分钟内所有投骰带有 [+]，压力减少 1d5。`,
  `紧张：获得 1 压力。`,
  `神经质：获得 1 压力，所有近距乘组获得 2 压力。`,
  `不知所措：之后 1d10 分钟内所有投骰带有 [-]，压力下限提升 1。`,
  `懦弱：获得一项新状态：必须通过一次恐惧豁免才能参与暴力行为，否则就会逃跑。`,
  `受惊：获得一项新状态：恐惧症：在遭遇恐惧源时得要通过一次恐惧豁免 [-]，否则获得 1d5 压力。`,
  `梦魇：获得一项新状态：难以安睡，休息豁免带有 [-]。`,
  `失去自信：获得一项新状态：选择一项技能，失去此技能的奖励。`,
  `泄气：获得一项新状态：只要有近距乘员豁免失败，获得 1 压力。`,
  `时日无多：获得一项新状态：感觉自己受到诅咒，厄运缠身。所有关键成功变成关键失败。`,
  `多疑：之后一周内，每当有人加入你的团体（即使他们只离开了很短的时间），通过一次恐惧豁免，否则获得 1 压力。`,
  `作祟：获得一项新状态：有些东西开始会在晚上造访，包括梦中或视线边缘，很快对方就会开始提出要求。`,
  `作死：之后 24 小时里，只要遭遇陌生人或是已知敌人，你必须通过一次理智豁免，否则立刻发起攻击。`,
  `预知异象：角色立刻体验一次关于将临恐怖或是可怖事件的激烈幻觉/异象。压力下限提升 +2。`,
  `紧张症：2d10 分钟里变得毫无反应，呆若木鸡。减少 1d10 压力。`,
  `狂暴：之后 1d10 小时内，所有伤害投骰带有 [+]。所有乘组获得 1 压力。`,
  `沦陷：获得一项新状态：进行一次带有 [-] 的惊恐检定。`,
  `复合问题：按照此惊恐表投骰两次。压力下限提升 1。`,
  `心脏病发/短路（仿生人）：损伤上限降低 1。1d10 小时内所有投骰带有 [-]。压力下限提升 1。`,
  `退场：投个新角色来参加游戏。`
]

//=======function=======

function getCheckRank(dice, check) {
  if (isCriticalSuccess(dice, check)) return 2;
  if (dice <= check) return 1;
  if (isCriticalFailure(dice, check)) return -2;
  return -1;
}

function isCriticalSuccess(dice, check) {
  if (dice === 100 || dice === 0) return true;
  const tens = Math.floor(dice / 10);
  const ones = dice % 10;
  if (tens === ones && dice <= check) {
    return true;
  }
  return false;
}

function isCriticalFailure(dice, check) {
  if (dice === 99) return true;
  const tens = Math.floor(dice / 10);
  const ones = dice % 10;
  if (tens === ones && dice > check) {
    return true;
  }
  return false;
}

function makeCheck(ctx, value, dice) {
  if (!ctx || value === void 0 || dice === void 0) {
    return "检定参数错误";
  }
  const check = value;
  const formattedValue = seal.format(ctx, `${value}`);
  const simpleMode = seal.vars.intGet(ctx, '$g简易开关')[0];
  let text0 = `${dice}/${formattedValue || value}`;
  let text = "";
  if (isCriticalSuccess(dice, check)) {
    text = simpleMode == 1 ? seal.formatTmpl(ctx, "COC:判定_简短_大成功"):seal.formatTmpl(ctx, "COC:判定_大成功");
  } else if (isCriticalFailure(dice, check)) {
    text = simpleMode == 1 ? seal.formatTmpl(ctx, "COC:判定_简短_大失败"):seal.formatTmpl(ctx, "COC:判定_大失败");
    
  } else if (dice <= check) {
    text = simpleMode == 1 ? seal.formatTmpl(ctx, "COC:判定_简短_成功_普通"):seal.formatTmpl(ctx, "COC:判定_成功_普通");
  } else {
    text = simpleMode == 1 ? seal.formatTmpl(ctx, "COC:判定_简短_失败"):seal.formatTmpl(ctx, "COC:判定_失败");
  }
  text0 += " " + text;
  return text0;
}

function handleStress(ctx, mctx, isFailure) {

  let cStress = seal.vars.intGet(mctx, "压力")[0];
    
  if (!cStress && cStress == 0) cStress = parseInt(seal.format(mctx,"{压力下限}"));
  if (!isFailure) return [cStress, ""]; 

  let stressChangeText = "";
  if (cStress < 20) {
    const newStress = cStress + 1; 
    seal.vars.intSet(mctx, "压力", newStress);
    stressChangeText = `\n压力：${cStress}→${newStress}`;
    return [newStress, stressChangeText];
  } else {
    stressChangeText = `\n压力：${cStress}→${cStress} (已达上限)`;
    return [cStress, stressChangeText];
  }
}

function skillGenerator(ctx){
  const rolls = [];
  let attribute = 0;
  for (let i = 0; i < 4; i++) {
    attribute = 25 + parseInt(seal.format(ctx, "{2d10}"));
    rolls.push(attribute);
  }
  for (let i = 0; i < 3; i++) {
    attribute = 10 + parseInt(seal.format(ctx, "{2d10}"));
    rolls.push(attribute);
  }
  return rolls;
}

function drawPanic(idx){
  let text = `\n\n惊恐效果:\n`;
  if (idx != 17){
    text += panic[idx];
    return text;
  }else{
    text += panic[idx];
    text += `\n复合惊恐效果：\n`
    for (i=0; i<2; i++){
      const die = Math.floor(Math.random() * panic.length);
      text += panic[die];
      text += "\n";
    }
  }
  return text;
}

const solveCheck = (ctx, msg, cmdArgs, mode) => {
  const mctx = seal.getCtxProxyFirst(ctx, cmdArgs);
  // const currentSystem = seal.vars.strGet(mctx, "$t游戏模式")[0];
  // if (currentSystem !== "MS") {
  //   return seal.ext.newCmdExecuteResult(false);
  // }
  const val = cmdArgs.getArgN(1);
  const simpleMode = seal.vars.intGet(ctx, '$g简易开关')[0];

  
  if (!val || val === "help") {
    const ret = seal.ext.newCmdExecuteResult(true);
    ret.showHelp = true;
    return ret;
  }

  let check = 0;
  const regex = /\D/g;
  if (!parseInt(val)) {
    if (parseInt(cmdArgs.getArgN(2)) || parseInt(val.replace(regex,""))) {
      check = parseInt(cmdArgs.getArgN(2)) ? parseInt(cmdArgs.getArgN(2)) : parseInt(val.replace(regex,""));
    } else {
      check = parseInt(seal.format(mctx, `{${val}}`));
    }
  } else {
    check = parseInt(val);
  }
    
  const dice1 = parseInt(seal.format(mctx, "{1d100}"));
  let finalDice = dice1;
  let processText = ""; 

  if (mode === 0) {
    processText = `D100=`;
  } else {
    const dice2 = parseInt(seal.format(mctx, "{1d100}"));
    const rank1 = getCheckRank(dice1, check);
    const rank2 = getCheckRank(dice2, check);

    if (mode === 1) { 
      if (rank1 > rank2) finalDice = dice1;
      else if (rank2 > rank1) finalDice = dice2;
      else finalDice = Math.min(dice1, dice2); 
      processText = `[+] [d100=${dice1},${dice2}] D100=`;
    } else {
      if (rank1 < rank2) finalDice = dice1;
      else if (rank2 < rank1) finalDice = dice2;
      else finalDice = Math.max(dice1, dice2); 
      processText = `[-] [d100=${dice1},${dice2}] D100=`;
    }
  }

  const resultText = makeCheck(mctx, check, finalDice);
    
  const finalRank = getCheckRank(finalDice, check);
  const isFailure = finalRank < 0; 
    
  const [_, stressText] = handleStress(ctx, mctx, isFailure);

  const playerName = seal.format(mctx, "{$t玩家_RAW}");
  const reply = `${playerName}的“${val}”检定：${processText}${resultText}${stressText}`;
    
  seal.replyToSender(ctx, msg, reply);
  return seal.ext.newCmdExecuteResult(true);
};

//=======main=======

try {
  seal.gameSystem.newTemplate(JSON.stringify(mstemplate));
} catch (e) {
  console.log("注册游戏系统模板失败:", e);
}
let ext = seal.ext.find("母舰");
if (!ext) {
  ext = seal.ext.new("母舰", "叁崎", "1.0.0");
  seal.ext.register(ext);
}
const cmdMSHelp = seal.ext.newCmdItemInfo();
cmdMSHelp.name = "mshelp";
cmdMSHelp.help = helpTexts.main;
cmdMSHelp.solve = (ctx, msg, cmdArgs) => {
  const val = cmdArgs.getArgN(1);
  switch (val) {
    default: {
      seal.replyToSender(ctx, msg, helpTexts.main);
      return seal.ext.newCmdExecuteResult(true);
    }
  }
};
//=====检定=====
const cmdRm = seal.ext.newCmdItemInfo();
cmdRm.name = "rm";
cmdRm.help = helpTexts.rm;
cmdRm.allowDelegate = true;
cmdRm.solve = (ctx, msg, cmdArgs) => solveCheck(ctx, msg, cmdArgs, 0);

const cmdRmb = seal.ext.newCmdItemInfo();
cmdRmb.name = "rmb";
cmdRmb.help = helpTexts.rm;
cmdRmb.allowDelegate = true;
cmdRmb.solve = (ctx, msg, cmdArgs) => solveCheck(ctx, msg, cmdArgs, 1);

const cmdRmp = seal.ext.newCmdItemInfo();
cmdRmp.name = "rmp";
cmdRmp.help = helpTexts.rm;
cmdRmp.allowDelegate = true;
cmdRmp.solve = (ctx, msg, cmdArgs) => solveCheck(ctx, msg, cmdArgs, -1);

//=====数据生成=====
const cmdMs = seal.ext.newCmdItemInfo();
cmdMs.name = "ms";
cmdMs.help = helpTexts.main;
cmdMs.solve = (ctx, msg, cmdArgs) => {
  const sub = cmdArgs.getArgN(1);
  let times = 1;
  switch (sub){
    case "help": {
      const ret = seal.ext.newCmdExecuteResult(true);
      ret.showHelp = true;
      return ret;
    }
    default: {
      if (sub && sub !== "") {
        const parsed = parseInt(sub);
        if (!isNaN(parsed) && parsed > 0) {
          times = parsed;
        } else {
          seal.replyToSender(ctx, msg, "参数错误：次数必须为正整数。");
          return seal.ext.newCmdExecuteResult(true);
        }
      }
      if (times > 10) {
        seal.replyToSender(ctx, msg, "最多只能生成10次");
        return seal.ext.newCmdExecuteResult(true);
      }
      let results = '', split = '';
      for (let i = 0; i < times; i++) {
        split = (i < times - 1)?seal.formatTmpl(ctx, "COC:制卡_分隔符"):'';
        const stats = skillGenerator(ctx);
        const sum = stats.reduce((prev,cur) => prev + cur, 0);
        const hp = parseInt(seal.format(ctx, "{1d10}")) + 10;
        const cr = parseInt(seal.format(ctx, "{2d10}")) * 10;
        results += "力量:" + stats[0] + " 速度:" + stats[1] + " 智力:" + stats[2] + "\n" +
                  "战斗:" + stats[3] + " 理智:" + stats[4] + " 恐惧:" + stats[5] + "\n" +
                  "身体:" + stats[6] + " 生命值:" + hp + " 信用点:" + cr + `\n[${sum}]`;
        results += split;
      }
      const playerName = seal.format(ctx, "{$t玩家_RAW}");
      const finalMessage = `${playerName}的母舰人物作成：\n=======\n` + results;
      seal.replyToSender(ctx, msg, finalMessage);
      return seal.ext.newCmdExecuteResult(true);
    }
  }
};
//=====惊恐检定=====
const cmdMp = seal.ext.newCmdItemInfo();
cmdMp.name = "mp";
cmdMp.help = helpTexts.main;
cmdMp.solve = (ctx, msg, cmdArgs) => {
  const mctx = seal.getCtxProxyFirst(ctx, cmdArgs);
  const simpleMode = seal.vars.intGet(ctx, '$g简易开关')[0];

  const dice = parseInt(seal.format(mctx, "{1d20}"));
  const stress = parseInt(seal.format(mctx, `{压力}`));
  const playerName = seal.format(ctx, "{$t玩家_RAW}");
  let text = `${playerName}的惊恐检定：D20=${dice}/${stress} `;
  if (dice > stress){
    text += (simpleMode == 1)? seal.formatTmpl(ctx, "COC:判定_简短_成功_普通"):seal.formatTmpl(ctx, "COC:判定_成功_普通");
  }else{
    text += (simpleMode == 1)? seal.formatTmpl(ctx, "COC:判定_简短_失败"):seal.formatTmpl(ctx, "COC:判定_失败");
    text += drawPanic(dice);
  }
  seal.replyToSender(ctx, msg, text);
  return seal.ext.newCmdExecuteResult(true);
};
ext.cmdMap["ms"] = cmdMs;
ext.cmdMap["mshelp"] = cmdMSHelp;
ext.cmdMap["rm"] = cmdRm;
ext.cmdMap["rmb"] = cmdRmb;
ext.cmdMap["rmp"] = cmdRmp;
ext.cmdMap["mp"] = cmdMp;
