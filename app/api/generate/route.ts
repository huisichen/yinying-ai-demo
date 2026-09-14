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
  const lines=age.label==='活力银发'?[['周叔',`我收到“${topic}”，先看看订单记录。`],['陌生客服','现在点链接，退款马上到账。'],['周叔','订单里没有退款提醒，这个链接可疑。'],['林老师','判断得对。先关闭页面，不要填写验证码。'],['周叔',age.line],['林老师','再拨打公开的客服电话，不回拨陌生号码。'],['周叔','官方客服说，根本没有这笔退款。'],['林老师',core],['旁白',age.closing]]:age.label==='高龄银发'?[['孙奶奶',`有人说，要办“${topic.slice(0,10)}”。`],['陌生来电','点开链接。马上办。'],['小陈','奶奶，先挂电话。'],['孙奶奶','不点链接，对吗？'],['小陈','对。验证码也不说。'],['孙奶奶',age.line],['小陈','我们再打官方电话。'],['孙奶奶','先挂断。再核实。'],['旁白',age.closing]]:[['陈阿姨',`我遇到“${topic}”，现在该怎么办？`],['陌生客服','请马上操作，晚了就来不及了。'],['王社工','先停下来。不要点链接，也不要转账。'],['陈阿姨','那我先看看订单里有没有退款记录。'],['王社工','对，再从官方应用里找客服电话。'],['陈阿姨',age.line],['王社工','官方客服确认，没有这笔退款。'],['陈阿姨','我明白了，验证码也不能告诉别人。'],['旁白',age.closing]];
  const wanted=duration<=30?6:duration<=60?8:duration<=90?9:lines.length;
  const visuals=['交代人物和来电情境','手机展示虚构来电页面','人物停下操作并思考','展示订单页核对动作','社区人员加入并提醒','拨打官方公开电话','确认结果并解释风险','主人公复述关键步骤','大字口令收束'];
  const shots:Shot[]=lines.slice(0,wanted).map((line,i)=>({shot:String(i+1).padStart(2,'0'),shotSize:i===1||i===wanted-1?'特写':i===4?'双人中景':'中景',camera:'固定 / 平视',visual:visuals[i]||'人物完成核实动作',dialogue:`${line[0]}：${line[1]}`,duration:Math.max(5,Math.round(duration/wanted))}));
  const script=lines.map(x=>`${x[0]}：${x[1]}`).join('\n');
  return {title,summary:`面向${age.label}：${age.story} 在${input.location||'社区服务站'}中，通过“收到信息—识别疑点—停止操作—官方核实—复述口令”的完整过程，完成${input.goal||'风险提醒'}。`,core,lines,shots,silverfit:scoreSilverFit(script,shots,actors,duration)};
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
  const amount=duration<=30?'6—7句台词、5—6个镜头':duration<=60?'9—12句台词、8—10个镜头':duration<=90?'12—16句台词、10—12个镜头':'18—24句台词、14—18个镜头';
  const system=`你是“银映”银发短视频拍摄方案设计师。只能输出 JSON，不输出 Markdown，不生成视频。事实与风险提示必须基于给定证据；证据不足时明确写“需人工核实”。剧本必须有起因、诱导或问题、识别疑点、正确核实、结果确认、口令收束，不能只有问答提纲。不同年龄段必须改变人物的行动方式、协助关系、句子长度和重复方式，禁止只修改年龄标签。输出字段：title, summary, core, lines（二维数组：人物、台词）, shots（对象数组：shot,shotSize,camera,visual,dialogue,duration）。`;
  const prompt=`拍摄需求：${JSON.stringify(input)}\n受众适配：${age.label}；${age.story} 单句尽量不超过${age.maxChars}字。\n内容丰富度：${amount}；每个镜头必须对应具体动作或信息推进，结尾由主人公复述关键做法。\n\n检索证据：\n${context}`;
  const res=await fetch(`${base}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,temperature:.45,max_tokens:2600,messages:[{role:'system',content:system},{role:'user',content:prompt}]})});
  if(!res.ok)throw new Error(`模型服务返回 ${res.status}`);
  const data=await res.json() as any;
  const plan=parseModelJson(data?.choices?.[0]?.message?.content||'');
  if(!Array.isArray(plan?.lines)||plan.lines.length<6||!Array.isArray(plan?.shots)||plan.shots.length<5)throw new Error('模型输出不完整');
  plan.summary=`面向${age.label}：${age.story} ${plan.summary||''}`;
  return plan;
}

export async function OPTIONS(){return new Response(null,{status:204,headers:cors})}

export async function POST(request:Request){
  const started=Date.now();
  try{
    const input=await request.json() as Input;
    if(!input.topic?.trim())return new Response(JSON.stringify({error:'topic 不能为空'}),{status:400,headers:cors});
    const query=[input.topic,input.audience,input.location,input.goal].filter(Boolean).join(' ');
    const hits=retrieve(query,4),context=buildContext(hits);
    let modelResult:any=null,mode='local-rag';
    try{modelResult=await callModel(input,context);if(modelResult)mode='llm-rag'}catch(error){mode='local-rag-fallback';console.error(error)}
    const plan=modelResult||fallbackPlan(input,hits);
    const duration=numberFrom(input.duration,60),actors=numberFrom(input.actors,2);
    const shots=(plan.shots||[]) as Shot[];
    const script=(plan.lines||[]).map((x:string[])=>x.join('：')).join('\n');
    plan.silverfit=scoreSilverFit(script,shots,actors,duration);
    return new Response(JSON.stringify({plan,sources:hits.map((h,i)=>({citation:`E${i+1}`,id:h.id,title:h.title,excerpt:h.text,advice:h.advice,sourceName:h.sourceName,sourceUrl:h.sourceUrl,license:h.license,score:h.score,matched:h.matched})),trace:{mode,retriever:'hybrid-char-bigram+cue-boost',retrieved:hits.length,latencyMs:Date.now()-started}}),{headers:cors});
  }catch(error){return new Response(JSON.stringify({error:error instanceof Error?error.message:'生成失败'}),{status:500,headers:cors})}
}

