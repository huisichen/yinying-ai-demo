import {buildContext,retrieve} from '../../../lib/rag';
import {scoreSilverFit,type Shot} from '../../../lib/silverfit';

export const runtime='edge';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'content-type',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Content-Type':'application/json; charset=utf-8'
};

type Input={topic:string;audience?:string;duration?:string|number;actors?:string|number;location?:string;goal?:string};

function numberFrom(v:unknown,fallback:number){const n=Number(String(v??'').match(/\d+/)?.[0]);return Number.isFinite(n)?n:fallback}

function normalizeShotDurations(shots:Shot[],total:number){
  if(!shots.length)return shots;
  const base=Math.floor(total/shots.length),remainder=total-base*shots.length;
  return shots.map((shot,i)=>({...shot,duration:base+(i<remainder?1:0)}));
}

function ensureSceneRows(rows:unknown[],wanted:number){
  const normalized=rows.filter(Array.isArray).map(row=>{
    const pair=row as unknown[];
    const role=String(pair[0]||''),content=String(pair[1]||'');
    return role.startsWith('场景')&&role!=='场景'?['场景',`${role} · ${content}`]:[role,content];
  });
  const existing=normalized.filter(row=>row[0]==='场景').length;
  const sceneSizes:number[]=[];
  let current=-1;
  for(const row of normalized){if(row[0]==='场景'){current++;sceneSizes[current]=0}else if(current>=0)sceneSizes[current]++}
  if(existing>=wanted&&sceneSizes.slice(0,wanted).every(size=>size>=5))return normalized;
  const content=normalized.filter(row=>row[0]!=='场景');
  const names=['场景一 · 家中客厅 · 日 · 内','场景二 · 社区服务站 · 日 · 内','场景三 · 社区公共区域 · 日 · 外','场景四 · 社区活动室 · 日 · 内'];
  const result:string[][]=[];
  for(let i=0;i<wanted;i++){
    result.push(['场景',names[i]||`场景${i+1} · 社区 · 日 · 内`]);
    const start=Math.floor(i*content.length/wanted),end=Math.floor((i+1)*content.length/wanted);
    result.push(...content.slice(start,end));
  }
  return result;
}

function audienceProfile(audience=''){
  if(audience.startsWith('55'))return {label:'活力银发',story:'主人公能够独立使用手机，重点展示自主判断、主动查询订单和自行拨打官方电话；节奏稍快，但步骤必须清楚。',line:'我先关掉陌生页面，再从官方应用里查看订单。',closing:'先看订单，再找官方渠道，自己也能把事情核实清楚。',maxChars:30};
  if(audience.startsWith('80'))return {label:'高龄银发',story:'由家属或社区人员陪同确认；表达简明但必须是完整句子，避免术语和连续步骤；关键动作可换一种说法复述一次。',line:'我先不操作，等家人回来一起看看。',closing:'拿不准的时候先停下来，请家人帮忙核实。',maxChars:22};
  return {label:'中高龄银发',story:'主人公先暂停操作，再请社区工作人员一起核实；台词口语自然，关键步骤只换一种说法复述一次。',line:'我先停下来，请社区工作人员陪我一起核实。',closing:'事情越急越要稳住，先去官方渠道核实清楚。',maxChars:26};
}

function dialogueQualityIssue(rows:unknown[]){
  if(!Array.isArray(rows))return '缺少剧本行';
  const spoken=rows.filter(row=>Array.isArray(row)&&!['场景','画面','动作'].includes(String((row as unknown[])[0]))).map(row=>String((row as unknown[])[1]||'').trim()).filter(Boolean);
  if(!spoken.length)return '缺少可朗读台词';
  const commaRatio=spoken.filter(text=>/[，,]/.test(text)).length/spoken.length;
  const completeRatio=spoken.filter(text=>[...text].length>=8&&/[。！？!?]$/.test(text)).length/spoken.length;
  const endings=new Set(spoken.map(text=>text.match(/[。！？!?]$/)?.[0]).filter(Boolean)).size;
  const normalized=spoken.map(text=>text.replace(/[\s，。！？、；：,.!?;:“”'‘’]/g,''));
  const duplicates=normalized.length-new Set(normalized).size;
  const fragments=spoken.filter(text=>[...text].length<7).length;
  const issues=[];
  if(commaRatio<.25)issues.push('带逗号的自然复句不足25%');
  if(completeRatio<.75)issues.push('完整口播句不足75%');
  if(endings<2)issues.push('句末标点过于单一');
  if(duplicates)issues.push(`存在${duplicates}条完全重复台词`);
  if(fragments>Math.ceil(spoken.length*.12))issues.push('过短碎片句过多');
  return issues.join('；');
}

function fallbackPlan(input:Input,hits:ReturnType<typeof retrieve>){
  const duration=numberFrom(input.duration,60),actors=numberFrom(input.actors,2);
  const age=audienceProfile(input.audience);
  const evidence=hits[0];
  const core=evidence?.advice||'先停下来，通过正规渠道核实，再决定是否操作。';
  const title=evidence?`${evidence.title}：先核实`:(input.topic||'这件事').includes('退款')?'退款电话，先别点':`${input.topic||'这件事'}，三步讲明白`;
  const topic=(input.topic||'陌生通知').slice(0,18);
  const lines=age.label==='活力银发'?
    [['场景','场景一 · 家中客厅 · 日 · 内'],['画面','周叔整理快递盒，手机突然响起。'],['周叔',`我刚收到“${topic}”的电话。`],['陌生客服','商品有问题，现在点链接就能退款。'],['画面','屏幕跳出“三分钟内完成”的倒计时。'],['陌生客服','过时就不能退，请马上报验证码。'],['周叔','订单里没有退款通知，这事不对。'],['场景','场景二 · 社区服务站 · 日 · 内'],['周叔','林老师，帮我看看这个订单号。'],['林老师','先关掉链接，再从平台订单页核对。'],['画面','两人找到平台里的官方客服入口。'],['周叔','我自己拨官方电话，不回拨陌生号码。'],['官方客服','平台没有这笔退款，也不会索要验证码。'],['周叔','果然是假的，我把号码标记并举报。'],['场景','场景三 · 楼下宣传栏 · 日 · 外'],['画面','周叔把刚才的经历讲给两位邻居听。'],['邻居','那通电话最可疑的地方是什么？'],['周叔','一直催，还让我离开官方平台。'],['林老师',core],['邻居','我也记住，先查订单再核实。'],['周叔',age.closing],['旁白','陌生退款先停手，订单和电话都从官方渠道核实。']]:
    age.label==='高龄银发'?
    [['场景','场景一 · 家中客厅 · 日 · 内'],['画面','手机连续响起，孙奶奶戴上老花镜。'],['孙奶奶',`有人说要办“${topic.slice(0,10)}”，可我没申请过呀？`],['陌生来电','请点开这条链接，现在办理还能及时退款。'],['陌生来电','这件事不要告诉家人，否则退款就办不成了。'],['孙奶奶','既然是正规退款，为什么不能让家里人知道？'],['画面','孙奶奶没有点击，把手机放到桌上。'],['场景','场景二 · 社区服务站 · 日 · 内'],['小陈','奶奶，您先把电话挂掉，我们一起看看订单。'],['孙奶奶','我没有点开链接，这样处理对吗？'],['小陈','对，验证码和银行卡密码也不能告诉别人。'],['画面','小陈打开免提，从官方页面找号码。'],['官方客服','订单里没有退款申请，请不要继续操作陌生链接。'],['孙奶奶','幸好我先停了下来，还能请你帮我看清楚。'],['场景','场景三 · 楼道口 · 日 · 外'],['孙奶奶','刚才那个人一直催我，我觉得不对就放下了手机。'],['邻居','下次碰到这种电话，我们先做什么呢？'],['孙奶奶','先别急着操作，看不清就请家里人一起确认。'],['小陈','核实的时候要自己找官方入口，不能照着陌生人给的号码回拨。'],['邻居','我明白了，越是催得急，越要慢下来查清楚！'],['孙奶奶',age.closing],['旁白','遇到听不明白的陌生要求，停下来并找可信的人核实。']]:
    [['场景','场景一 · 家中客厅 · 日 · 内'],['画面','陈阿姨拆开快递，手机突然响起。'],['陈阿姨',`你好，你说的是“${topic}”吗？`],['陌生客服','商品有问题，点击链接可以双倍退款。'],['画面','短信弹出陌生链接和三分钟倒计时。'],['陌生客服','请马上填写验证码，晚了就失效。'],['陈阿姨','你越催，我心里越不踏实。'],['场景','场景二 · 社区服务站 · 日 · 内'],['陈阿姨','王社工，能帮我一起核实吗？'],['王社工','先停下来，不点链接，也不转账。'],['陈阿姨','订单页面里没有退款记录。'],['王社工','再从平台里面找官方客服电话。'],['画面','陈阿姨亲自拨通官方客服并打开免提。'],['官方客服','我们没有这笔退款，也不会索要验证码。'],['陈阿姨','原来对方是假客服，我现在举报这个号码。'],['场景','场景三 · 社区宣传栏 · 日 · 外'],['画面','陈阿姨向邻居复述刚学会的核实方法。'],['邻居','刚才那通电话哪里不对？'],['陈阿姨','对方催我点链接，还索要验证码。'],['王社工',core],['邻居','我也记住，先查订单再核实。'],['陈阿姨',age.closing],['旁白','遇到退款先查订单，陌生链接不点，验证码不说。']];
  const wanted=duration<=30?8:duration<=60?15:duration<=90?18:Math.min(24,lines.length-3);
  const contentLines=lines.filter(line=>line[0]!=='场景');
  const shown=Array.from({length:Math.min(wanted,contentLines.length)},(_,i)=>contentLines[Math.round(i*(contentLines.length-1)/(Math.min(wanted,contentLines.length)-1))]);
  const visuals=['家中建立人物与日常状态','手机来电打断日常','展示虚构退款话术','倒计时与验证码制造压力','主人公发现订单矛盾','转场到社区服务站','可信角色陪同核对订单','从平台寻找官方入口','拨打公开客服电话','官方客服确认骗局','主人公完成举报','转场到公共宣传区域','主人公向邻居复述方法','结尾安全提醒收束'];
  const shots:Shot[]=normalizeShotDurations(shown.map((line,i)=>({shot:String(i+1).padStart(2,'0'),shotSize:i===1||i===shown.length-1?'特写':i===5||i===11?'全景':'中景',camera:'固定 / 平视',visual:visuals[i]||'人物完成核实动作',dialogue:`${line[0]}：${line[1]}`,duration:0})),duration);
  const script=lines.map(x=>`${x[0]}：${x[1]}`).join('\n');
  return {title,summary:`面向${age.label}：${age.story} 采用“家中接到信息—社区服务站核实—公共区域复述提醒”的三场景结构，通过连续动作与转场支撑完整的${duration}秒成片。`,core,lines,shots,silverfit:scoreSilverFit(script,shots,actors,duration)};
}

function parseModelJson(text:string){
  const cleaned=text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  return JSON.parse(cleaned);
}

async function callModel(input:Input,context:string){
  const key=process.env.LLM_API_KEY;
  const base=(process.env.LLM_BASE_URL||'https://api.deepseek.com').replace(/\/$/,'');
  const model=process.env.LLM_MODEL||'deepseek-chat';
  if(!key)return null;
  const age=audienceProfile(input.audience),duration=numberFrom(input.duration,60);
  const amount=duration<=30?'12—16条剧本行、8个镜头、2个场景':duration<=60?'24—30条剧本行、15个镜头、3个场景；每场至少6条有效内容':duration<=90?'30—38条剧本行、18个镜头、3—4个场景':'42—56条剧本行、22—24个镜头、4—5个场景';
  const spoken=duration<=30?'70—100':duration<=60?'150—190':duration<=90?'230—300':'450—600';
  const system=`你是“银映”银发短视频拍摄方案设计师。只能输出 JSON，不输出 Markdown，不生成视频。事实与风险提示必须基于给定检索证据；证据不足时明确写“需人工核实”。剧本不是知识问答提纲，必须有起因、打断日常、连续施压、人物迟疑、发现矛盾、主动求助、独立核实、结果反转、事后行动和人物复述。lines 必须用["场景","场景一 · 地点 · 日/夜 · 内/外"]标出每次转场；人物行必须像["王阿姨","电话里一直催我，我想先看看订单里有没有通知。"]，画面行必须像["画面","王阿姨放下手机，拿出快递单。"]。人物台词必须是口语自然、语义完整的句子，不得把一句话机械切成“先挂断。再核实。”这样的碎片；至少四分之一的口播使用逗号连接相关分句，并自然混用句号、问号和感叹号。相邻台词要承接情绪和动作，每行提供新信息；除结尾安全提醒允许换一种说法复述一次外，不得重复相同句子、关键词串或处置步骤。绝对不能把“场景一……”填到人物台词或画面内容里。每场至少六条有效内容并承担不同任务，转场必须推动故事，禁止只换地点重复台词。不同年龄段必须改变主人公能力、协助关系、句长、节奏和复述方式，禁止只修改年龄标签。不要额外生成醒目的字幕卡。输出字段：title, summary, core, lines（二维数组：人物/场景/画面/旁白、实际内容）, shots（对象数组：shot,shotSize,camera,visual,dialogue,duration）。`;
  const prompt=`拍摄需求：${JSON.stringify(input)}\n受众适配：${age.label}；${age.story} 单句尽量不超过${age.maxChars}字。\n成片设计：${amount}；实际可朗读台词总量约${spoken}个汉字，另留动作、停顿和转场时间。60秒默认采用“家中接到信息—社区服务站核实—公共区域复述提醒”三个低成本场景；若用户给出其他地点，优先使用用户地点，并补充步行可达、易拍摄的相邻场景。每个镜头都要有具体动作或新信息，shots 的时长总和必须等于${duration}秒。\n\nRAG检索证据：\n${context}`;
  const requestPlan=async(correction='')=>{
    const res=await fetch(`${base}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,temperature:.4,max_tokens:3600,messages:[{role:'system',content:system},{role:'user',content:`${prompt}${correction}`}]})});
    if(!res.ok)throw new Error(`模型服务返回 ${res.status}`);
    const data=await res.json() as any;
    return parseModelJson(data?.choices?.[0]?.message?.content||'');
  };
  let plan=await requestPlan();
  const minLines=duration<=30?12:duration<=60?21:duration<=90?28:38,minShots=duration<=30?8:duration<=60?15:duration<=90?18:22,minScenes=duration<=30?2:duration<=90?3:4;
  if(Array.isArray(plan?.lines))plan.lines=ensureSceneRows(plan.lines,minScenes);
  let repeatedSceneText=Array.isArray(plan?.lines)?plan.lines.filter((line:unknown)=>Array.isArray(line)&&line[0]!=='场景'&&/^场景[一二三四五六\d]+/.test(String(line[1]||''))).length:0;
  let qualityIssue=dialogueQualityIssue(plan?.lines);
  if(repeatedSceneText||qualityIssue){plan=await requestPlan(`\n\n上一次输出未通过剧本质量检查：${repeatedSceneText?'把场景标题错误地写进了人物台词；':''}${qualityIssue}。请完全重写人物口播：使用有逗号、有句号、有问号的完整自然句，每行增加新信息，删除重复表达；除角色为“场景”的行外，不能出现“场景一/场景二/场景三”。`);if(Array.isArray(plan?.lines))plan.lines=ensureSceneRows(plan.lines,minScenes);repeatedSceneText=Array.isArray(plan?.lines)?plan.lines.filter((line:unknown)=>Array.isArray(line)&&line[0]!=='场景'&&/^场景[一二三四五六\d]+/.test(String(line[1]||''))).length:0;qualityIssue=dialogueQualityIssue(plan?.lines)}
  const sceneCount=Array.isArray(plan?.lines)?plan.lines.filter((line:unknown)=>Array.isArray(line)&&line[0]==='场景').length:0;
  const spokenChars=Array.isArray(plan?.lines)?plan.lines.filter((line:unknown)=>Array.isArray(line)&&!['场景','画面','动作'].includes(String(line[0]))).reduce((n:number,line:unknown)=>n+[...String((line as string[])[1]||'')].length,0):0;
  const minSpoken=duration<=30?60:duration<=60?130:duration<=90?200:400;
  if(!Array.isArray(plan?.lines)||plan.lines.length<minLines||!Array.isArray(plan?.shots)||plan.shots.length<minShots||sceneCount<minScenes||spokenChars<minSpoken||repeatedSceneText||qualityIssue)throw new Error(`模型输出不足以支撑目标时长${qualityIssue?`：${qualityIssue}`:''}`);
  plan.shots=normalizeShotDurations(plan.shots,duration);
  plan.summary=`面向${age.label}：${age.story} ${plan.summary||''}`;
  return plan;
}

export async function OPTIONS(){return new Response(null,{status:204,headers:cors})}

export async function POST(request:Request){
  const started=Date.now();
  try{
    const input=await request.json() as Input;
    if(!input.topic?.trim())return new Response(JSON.stringify({error:'topic 不能为空'}),{status:400,headers:cors});
    const query=[input.topic,input.audience,input.location,input.goal,'剧本 台词 剧情 分镜 多场景 场景转换 节奏'].filter(Boolean).join(' ');
    const hits=retrieve(query,6),context=buildContext(hits);
    let modelResult:any=null,mode='local-rag';
    try{modelResult=await callModel(input,context);if(modelResult)mode='llm-rag'}catch(error){mode='local-rag-fallback';console.error(error)}
    const fallback=fallbackPlan(input,hits);
    let plan=modelResult||fallback;
    const duration=numberFrom(input.duration,60),actors=numberFrom(input.actors,2);
    plan.shots=normalizeShotDurations((plan.shots||[]) as Shot[],duration);
    let shots=plan.shots as Shot[],script=(plan.lines||[]).map((x:string[])=>x.join('：')).join('\n'),silverfit=scoreSilverFit(script,shots,actors,duration);
    if(modelResult&&(silverfit.overall<80||Object.values(silverfit.dimensions).some(score=>score<75))){plan=fallback;mode='local-rag-quality-fallback';plan.shots=normalizeShotDurations((plan.shots||[]) as Shot[],duration);shots=plan.shots;script=(plan.lines||[]).map((x:string[])=>x.join('：')).join('\n');silverfit=scoreSilverFit(script,shots,actors,duration)}
    plan.silverfit=silverfit;
    return new Response(JSON.stringify({plan,sources:hits.map((h,i)=>({citation:`E${i+1}`,id:h.id,title:h.title,excerpt:h.text,advice:h.advice,sourceName:h.sourceName,sourceUrl:h.sourceUrl,license:h.license,score:h.score,matched:h.matched})),trace:{mode,retriever:'hybrid-char-bigram+cue-boost',retrieved:hits.length,latencyMs:Date.now()-started}}),{headers:cors});
  }catch(error){return new Response(JSON.stringify({error:error instanceof Error?error.message:'生成失败'}),{status:500,headers:cors})}
}

