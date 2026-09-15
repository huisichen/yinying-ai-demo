export type Shot = {shot:string; shotSize:string; camera:string; visual:string; dialogue:string; duration:number};

const jargon = ['赋能','抓手','闭环','底层逻辑','私域','对冲','量化','风险敞口','流动性','认证体系','联合惩戒'];

function clamp(n:number){return Math.max(0,Math.min(100,Math.round(n)))}

export function scoreSilverFit(script:string, shots:Shot[], actors:number, duration:number){
  const rows=script.split('\n').map(line=>{const index=line.indexOf('：');return {role:index>=0?line.slice(0,index):'',content:(index>=0?line.slice(index+1):line).trim()}}).filter(row=>row.content);
  const spokenRows=rows.filter(row=>!['场景','画面','动作'].includes(row.role));
  const lengths=spokenRows.map(row=>[...row.content].length);
  const averageLength=lengths.length?lengths.reduce((a,b)=>a+b,0)/lengths.length:0;
  const long=lengths.filter(n=>n>24).length;
  const veryLong=lengths.filter(n=>n>32).length;
  const jargonHits=jargon.filter(w=>script.includes(w));
  const averagePenalty=averageLength<=18?0:averageLength<=22?5:averageLength<=26?11:averageLength<=32?20:32;
  const language=clamp(98-averagePenalty-long*2-veryLong*3-jargonHits.length*4);
  const concepts=new Set((script.match(/验证码|密码|链接|转账|官方|核实|报警|就医|用药|申请|材料/g)||[])).size;
  const spokenChars=lengths.reduce((a,b)=>a+b,0),maxConcepts=Math.max(5,Math.round(duration/20)+4);
  const tooDense=Math.max(0,spokenChars-duration*5),tooSparse=Math.max(0,duration*1.7-spokenChars);
  const infoLoad=clamp(98-Math.max(0,concepts-maxConcepts)*5-Math.ceil(tooDense/35)*4-Math.ceil(tooSparse/30)*4);
  const beats=[/收到|突然|遇到|发现|想要|需要/,/马上|催|来不及|困难|担心|着急|问题/,/不对|可疑|疑问|为什么|怎么|核对/,/停|关闭|查|找|准备|记录/,/官方|医生|工作人员|核实|确认|平台|社区/,/原来|确认|完成|没有|明白|解决|举报/,/记住|先.*再|不点|不说|提醒|告诉/];
  const beatHits=beats.filter(rule=>rule.test(script)).length,sceneCount=new Set((script.match(/场景[一二三四五六\d]+/g)||[])).size;
  const narrative=clamp(45+beatHits*7+(sceneCount>=3?8:sceneCount>=2?4:0)-Math.max(0,actors-3)*4);
  const expectedShots=duration<=30?8:duration<=60?15:duration<=90?18:24,totalShotSeconds=shots.reduce((sum,s)=>sum+Number(s.duration||0),0);
  const crowded=shots.filter(s=>s.dialogue.replace(/\s/g,'').length>26&&s.duration<4).length;
  const visual=clamp(98-Math.abs(shots.length-expectedShots)*2-Math.min(18,Math.abs(totalShotSeconds-duration))-crowded*5);
  const overall=Math.round(language*.3+infoLoad*.2+narrative*.3+visual*.2);
  const issues:string[]=[];
  if(long)issues.push(`${long} 句口播超过 24 字，建议继续拆句`);
  if(jargonHits.length)issues.push(`包含较难词语：${jargonHits.join('、')}`);
  if(crowded)issues.push(`${crowded} 个镜头字幕停留偏短`);
  if(sceneCount<3&&duration>=60)issues.push('一分钟内容建议至少使用三个场景推进');
  if(beatHits<6)issues.push('剧情起因、冲突、核实或结果仍有缺项');
  if(totalShotSeconds!==duration)issues.push(`分镜总时长为 ${totalShotSeconds} 秒，需调整到 ${duration} 秒`);
  if(!issues.length)issues.push('已通过 80 分合格线：语言、信息量、剧情和拍摄节奏均符合当前规则');
  return {overall,dimensions:{language,infoLoad,narrative,visual},issues,metrics:{spokenLineCount:spokenRows.length,spokenChars,averageLineLength:Math.round(averageLength*10)/10,longSentenceCount:long,jargonHits,sceneCount,beatHits,shotCount:shots.length,totalShotSeconds,passLine:80},weights:{language:.3,infoLoad:.2,narrative:.3,visual:.2}};
}

