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

function fallbackPlan(input:Input,hits:ReturnType<typeof retrieve>){
  const duration=numberFrom(input.duration,60),actors=numberFrom(input.actors,2);
  const evidence=hits[0];
  const core=evidence?.advice||'先停下来，通过正规渠道核实，再决定是否操作。';
  const title=(input.topic||'这件事').includes('退款')?'退款电话，先别点':`${input.topic||'这件事'}，三步讲明白`;
  const lines=[
    ['陈阿姨',`我遇到“${(input.topic||'陌生通知').slice(0,16)}”，现在该怎么办？`],
    ['陌生来电','请马上操作，晚了就来不及了。'],
    ['王社工','先停下来。不要点链接，也不要转账。'],
    ['陈阿姨','我去官方应用里，再核实一次。'],
    ['王社工',core]
  ];
  const shots:Shot[]=lines.map((line,i)=>({shot:String(i+1).padStart(2,'0'),shotSize:i===1||i===4?'特写':'中景',camera:'固定 / 平视',visual:i===0?'长者接到陌生信息':i===1?'手机屏幕只展示虚构界面':i===2?'社区工作人员示意暂停':i===3?'两人通过官方渠道核实':'大字提示卡收束',dialogue:`${line[0]}：${line[1]}`,duration:i===4?8:7}));
  const script=lines.map(x=>`${x[0]}：${x[1]}`).join('\n');
  return {title,summary:`在${input.location||'社区服务站'}中，通过“遇到问题—暂停操作—官方核实—记住动作”的单线叙事，完成${input.goal||'风险提醒'}。`,core,lines,shots,silverfit:scoreSilverFit(script,shots,actors,duration)};
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
  const system=`你是“银映”银发短视频拍摄方案设计师。只能输出 JSON，不输出 Markdown。不要生成视频。事实与风险提示必须基于给定证据；证据不足时明确写“需人工核实”。语言面向银发观众：短句、口语、单线叙事、动作明确。输出字段：title, summary, core, lines（二维数组：人物、台词）, shots（对象数组：shot,shotSize,camera,visual,dialogue,duration）。`;
  const prompt=`拍摄需求：${JSON.stringify(input)}\n\n检索证据：\n${context}`;
  const res=await fetch(`${base}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,temperature:.35,messages:[{role:'system',content:system},{role:'user',content:prompt}]})});
  if(!res.ok)throw new Error(`模型服务返回 ${res.status}`);
  const data=await res.json() as any;
  return parseModelJson(data?.choices?.[0]?.message?.content||'');
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

