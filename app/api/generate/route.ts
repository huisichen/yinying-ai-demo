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
  if(existing>=wanted)return normalized;
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
  if(audience.startsWith('55'))return {label:'活力银发',story:'主人公能够独立使用手机，重点展示自主判断、主动查询订单和自行拨打官方电话；节奏稍快，但步骤必须清楚。',line:'我先关掉陌生页面，再从官方应用查订单。',closing:'先看订单，再找官方渠道，自己也能核实。',maxChars:24};
  if(audience.startsWith('80'))return {label:'高龄银发',story:'由家属或社区人员陪同确认；每句只说一个动作，避免术语和连续步骤；关键口令至少重复两次，并使用更大的提示字幕。',line:'我先不动，找家人一起看。',closing:'先挂断。找人帮忙。再核实。',maxChars:14};
  return {label:'中高龄银发',story:'主人公先暂停操作，再请社区工作人员一起核实；一句一个动作，关键步骤复述一次。',line:'我先停下来，请社区工作人员一起核实。',closing:'不着急，不点链接，先去官方渠道核实。',maxChars:20};
}

function fallbackPlan(input:Input,hits:ReturnType<typeof retrieve>){
  const duration=numberFrom(input.duration,60),actors=numberFrom(input.actors,2);
  const age=audienceProfile(input.audience);
  const evidence=hits[0];
  const core=evidence?.advice||'先停下来，通过正规渠道核实，再决定是否操作。';
  const title=evidence?`${evidence.title}：先核实`:(input.topic||'这件事').includes('退款')?'退款电话，先别点':`${input.topic||'这件事'}，三步讲明白`;
  const topic=(input.topic||'陌生通知').slice(0,18);
  const lines=age.label==='活力银发'?
    [['场景','场景一 · 家中客厅 · 日 · 内'],['画面','周叔整理快递盒，手机突然响起。'],['周叔',`我刚收到“${topic}”的电话。`],['陌生客服','商品有问题，现在点链接就能退款。'],['画面','屏幕跳出“三分钟内完成”的倒计时。'],['陌生客服','过时就不能退，请马上报验证码。'],['周叔','订单里没有退款通知，这事不对。'],['场景','场景二 · 社区服务站 · 日 · 内'],['周叔','林老师，帮我看看这个订单号。'],['林老师','先关掉链接，再从平台订单页核对。'],['画面','两人找到平台里的官方客服入口。'],['周叔','我自己拨官方电话，不回拨陌生号码。'],['官方客服','平台没有这笔退款，也不会索要验证码。'],['周叔','果然是假的，我把号码标记并举报。'],['场景','场景三 · 楼下宣传栏 · 日 · 外'],['画面','周叔把刚才的经历讲给两位邻居听。'],['林老师',core],['周叔',age.closing],['旁白','陌生退款先停手，订单和电话都从官方渠道核实。']]:
    age.label==='高龄银发'?
    [['场景','场景一 · 家中客厅 · 日 · 内'],['画面','手机连续响起，孙奶奶戴上老花镜。'],['孙奶奶',`有人说，要办“${topic.slice(0,10)}”。`],['陌生来电','点开链接。马上办。'],['陌生来电','不要告诉家人。'],['孙奶奶','为什么不能告诉家人？'],['画面','孙奶奶没有点击，把手机放到桌上。'],['场景','场景二 · 社区服务站 · 日 · 内'],['小陈','奶奶，先挂电话。'],['孙奶奶','不点链接，对吗？'],['小陈','对。验证码也不说。'],['画面','小陈打开免提，从官方页面找号码。'],['官方客服','没有这笔退款。不要继续操作。'],['孙奶奶','先挂断。找人帮忙。再核实。'],['场景','场景三 · 楼道口 · 日 · 外'],['孙奶奶','刚才有人催我点链接，我没有点。'],['小陈',core],['孙奶奶',age.closing],['旁白','看不清、听不明、被催促时，先停下来找人帮忙。']]:
    [['场景','场景一 · 家中客厅 · 日 · 内'],['画面','陈阿姨拆开快递，手机突然响起。'],['陈阿姨',`你好，你说的是“${topic}”吗？`],['陌生客服','商品有问题，点击链接可以双倍退款。'],['画面','短信弹出陌生链接和三分钟倒计时。'],['陌生客服','请马上填写验证码，晚了就失效。'],['陈阿姨','你越催，我心里越不踏实。'],['场景','场景二 · 社区服务站 · 日 · 内'],['陈阿姨','王社工，能帮我一起核实吗？'],['王社工','先停下来，不点链接，也不转账。'],['陈阿姨','订单页面里没有退款记录。'],['王社工','再从平台里面找官方客服电话。'],['画面','陈阿姨亲自拨通官方客服并打开免提。'],['官方客服','我们没有这笔退款，也不会索要验证码。'],['陈阿姨','原来对方是假客服，我现在举报这个号码。'],['场景','场景三 · 社区宣传栏 · 日 · 外'],['画面','陈阿姨向邻居复述刚学会的核实方法。'],['王社工',core],['陈阿姨',age.closing],['旁白','遇到退款先查订单，陌生链接不点，验证码不说。']];
  const wanted=duration<=30?8:duration<=60?12:duration<=90?16:Math.min(24,lines.length-3);
  const contentLines=lines.filter(line=>line[0]!=='场景');
  const shown=Array.from({length:Math.min(wanted,contentLines.length)},(_,i)=>contentLines[Math.round(i*(contentLines.length-1)/(Math.min(wanted,contentLines.length)-1))]);
  const visuals=['家中建立人物与日常状态','手机来电打断日常','展示虚构退款话术','倒计时与验证码制造压力','主人公发现订单矛盾','转场到社区服务站','可信角色陪同核对订单','从平台寻找官方入口','拨打公开客服电话','官方客服确认骗局','主人公完成举报','转场到公共宣传区域','主人公向邻居复述方法','大字安全口令收束'];
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
  const amount=duration<=30?'12—16条剧本行、8个镜头、2个场景':duration<=60?'18—24条剧本行、12个镜头、3个场景':duration<=90?'26—34条剧本行、16个镜头、3—4个场景':'40—52条剧本行、22—24个镜头、4—5个场景';
  const spoken=duration<=30?'70—100':duration<=60?'150—190':duration<=90?'230—300':'450—600';
  const system=`你是“银映”银发短视频拍摄方案设计师。只能输出 JSON，不输出 Markdown，不生成视频。事实与风险提示必须基于给定检索证据；证据不足时明确写“需人工核实”。剧本不是知识问答提纲，必须有起因、打断日常、连续施压、人物迟疑、发现矛盾、主动求助、独立核实、结果反转、事后行动和人物复述。lines 必须用["场景","场景一 · 地点 · 日/夜 · 内/外"]标出每次转场；还可用“画面”“动作”“旁白”描述可拍的表情、走动、手机操作和现场反应。每场都有明确任务，转场必须推动故事，禁止只换地点重复台词。每行承接上一行并增加新信息。不同年龄段必须改变主人公能力、协助关系、句长、节奏和复述方式，禁止只修改年龄标签。输出字段：title, summary, core, lines（二维数组：人物/场景/画面/旁白、内容）, shots（对象数组：shot,shotSize,camera,visual,dialogue,duration）。`;
  const prompt=`拍摄需求：${JSON.stringify(input)}\n受众适配：${age.label}；${age.story} 单句尽量不超过${age.maxChars}字。\n成片设计：${amount}；实际可朗读台词总量约${spoken}个汉字，另留动作、停顿和转场时间。60秒默认采用“家中接到信息—社区服务站核实—公共区域复述提醒”三个低成本场景；若用户给出其他地点，优先使用用户地点，并补充步行可达、易拍摄的相邻场景。每个镜头都要有具体动作或新信息，shots 的时长总和必须等于${duration}秒。\n\nRAG检索证据：\n${context}`;
  const res=await fetch(`${base}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,temperature:.55,max_tokens:3600,messages:[{role:'system',content:system},{role:'user',content:prompt}]})});
  if(!res.ok)throw new Error(`模型服务返回 ${res.status}`);
  const data=await res.json() as any;
  const plan=parseModelJson(data?.choices?.[0]?.message?.content||'');
  const minLines=duration<=30?12:duration<=60?18:duration<=90?26:38,minShots=duration<=30?8:duration<=60?12:duration<=90?16:22,minScenes=duration<=30?2:duration<=90?3:4;
  if(Array.isArray(plan?.lines))plan.lines=ensureSceneRows(plan.lines,minScenes);
  const sceneCount=Array.isArray(plan?.lines)?plan.lines.filter((line:unknown)=>Array.isArray(line)&&line[0]==='场景').length:0;
  const spokenChars=Array.isArray(plan?.lines)?plan.lines.filter((line:unknown)=>Array.isArray(line)&&!['场景','画面','动作'].includes(String(line[0]))).reduce((n:number,line:unknown)=>n+[...String((line as string[])[1]||'')].length,0):0;
  const minSpoken=duration<=30?60:duration<=60?130:duration<=90?200:400;
  if(!Array.isArray(plan?.lines)||plan.lines.length<minLines||!Array.isArray(plan?.shots)||plan.shots.length<minShots||sceneCount<minScenes||spokenChars<minSpoken)throw new Error('模型输出不足以支撑目标时长');
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
    const plan=modelResult||fallbackPlan(input,hits);
    const duration=numberFrom(input.duration,60),actors=numberFrom(input.actors,2);
    plan.shots=normalizeShotDurations((plan.shots||[]) as Shot[],duration);
    const shots=plan.shots as Shot[];
    const script=(plan.lines||[]).map((x:string[])=>x.join('：')).join('\n');
    plan.silverfit=scoreSilverFit(script,shots,actors,duration);
    return new Response(JSON.stringify({plan,sources:hits.map((h,i)=>({citation:`E${i+1}`,id:h.id,title:h.title,excerpt:h.text,advice:h.advice,sourceName:h.sourceName,sourceUrl:h.sourceUrl,license:h.license,score:h.score,matched:h.matched})),trace:{mode,retriever:'hybrid-char-bigram+cue-boost',retrieved:hits.length,latencyMs:Date.now()-started}}),{headers:cors});
  }catch(error){return new Response(JSON.stringify({error:error instanceof Error?error.message:'生成失败'}),{status:500,headers:cors})}
}

