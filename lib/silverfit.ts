export type Shot = {shot:string; shotSize:string; camera:string; visual:string; dialogue:string; duration:number};

const jargon = ['赋能','抓手','闭环','底层逻辑','私域','对冲','量化','风险敞口','流动性','认证体系','联合惩戒'];

function clamp(n:number){return Math.max(0,Math.min(100,Math.round(n)))}

export function scoreSilverFit(script:string, shots:Shot[], actors:number, duration:number){
  const sentences=script.split(/[。！？!?；;\n]/).map(s=>s.trim()).filter(Boolean);
  const long=sentences.filter(s=>[...s].length>20).length;
  const veryLong=sentences.filter(s=>[...s].length>30).length;
  const jargonHits=jargon.filter(w=>script.includes(w));
  const language=clamp(96-long*5-veryLong*5-jargonHits.length*4);
  const concepts=new Set((script.match(/验证码|密码|链接|转账|官方|核实|报警|就医|用药|申请|材料/g)||[])).size;
  const infoLoad=clamp(96-Math.max(0,concepts-Math.max(3,Math.round(duration/30)+1))*6);
  const narrative=clamp(96-Math.max(0,actors-2)*6-Math.max(0,shots.length-8)*2);
  const crowded=shots.filter(s=>s.dialogue.replace(/\s/g,'').length>18&&s.duration<5).length;
  const visual=clamp(94-crowded*7);
  const overall=Math.round(language*.3+infoLoad*.25+narrative*.2+visual*.25);
  const issues:string[]=[];
  if(long)issues.push(`${long} 处台词超过 20 字`);
  if(jargonHits.length)issues.push(`包含较难词语：${jargonHits.join('、')}`);
  if(crowded)issues.push(`${crowded} 个镜头字幕停留偏短`);
  if(!issues.length)issues.push('短句、信息量与镜头节奏符合当前规则');
  return {overall,dimensions:{language,infoLoad,narrative,visual},issues,metrics:{sentenceCount:sentences.length,longSentenceCount:long,jargonHits,shotCount:shots.length}};
}

