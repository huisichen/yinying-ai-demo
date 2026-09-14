export type CorpusItem = {
  id: string;
  category: string;
  title: string;
  text: string;
  advice: string;
  cues: string[];
  sourceName: string;
  sourceUrl: string;
  license: string;
};

export type RetrievalHit = CorpusItem & { score: number; matched: string[] };

// A compact, reviewable seed index derived from the CC BY 4.0 benchmark.
// We keep only the evidence needed by the demo instead of redistributing the
// complete benchmark. Every returned hit preserves source and licence metadata.
export const corpus: CorpusItem[] = [
  {id:'fraud-refund-01',category:'refund',title:'冒充客服退款：索要验证码',text:'以商品质量问题、退款或多倍赔付为由，要求点击链接并填写银行卡号、密码或验证码。',advice:'停止操作，通过购物平台订单页或官方客服电话自行核实；验证码绝不告诉他人。',cues:['客服','退款','赔付','链接','银行卡','验证码'],sourceName:'fraud-detect-bench-zh',sourceUrl:'https://github.com/uninhibited-scholar/fraud-detect-bench-zh',license:'CC BY 4.0'},
  {id:'fraud-refund-02',category:'refund',title:'账户注销与征信恐吓',text:'冒充金融平台客服，声称账户认证异常或不注销会影响征信，并要求把额度转到指定账户。',advice:'不要转账，不按陌生人的指示借款；退出通话后从官方应用核实。',cues:['注销','征信','客服','账户','额度','清零'],sourceName:'fraud-detect-bench-zh',sourceUrl:'https://github.com/uninhibited-scholar/fraud-detect-bench-zh',license:'CC BY 4.0'},
  {id:'fraud-logistics-01',category:'logistics',title:'快递破损理赔',text:'以快递破损、丢失或地址异常为由，要求添加私人联系方式、扫码或提供收款信息。',advice:'只在快递公司官方应用或官方客服电话内处理，拒绝陌生二维码和私聊转账。',cues:['快递','包裹','破损','丢失','理赔','客服'],sourceName:'fraud-detect-bench-zh',sourceUrl:'https://github.com/uninhibited-scholar/fraud-detect-bench-zh',license:'CC BY 4.0'},
  {id:'fraud-authority-01',category:'authority',title:'冒充公检法',text:'冒充公安、法院或监管机关，以涉嫌违法、资金核查或上网追逃制造恐慌，要求私下联系或转入安全账户。',advice:'公检法不会通过聊天软件办案，也不存在安全账户；挂断后拨打公开电话核实。',cues:['公安','法院','监管','涉嫌','安全账户','资金核查'],sourceName:'fraud-detect-bench-zh',sourceUrl:'https://github.com/uninhibited-scholar/fraud-detect-bench-zh',license:'CC BY 4.0'},
  {id:'fraud-phishing-01',category:'phishing',title:'仿冒短信与钓鱼链接',text:'用积分过期、账户失效、证书升级等理由催促点击仿冒域名并填写身份或银行卡信息。',advice:'不要点击短信里的陌生链接；直接打开官方应用或手动输入官方网址。',cues:['积分','过期','失效','认证','链接','短信'],sourceName:'fraud-detect-bench-zh',sourceUrl:'https://github.com/uninhibited-scholar/fraud-detect-bench-zh',license:'CC BY 4.0'},
  {id:'fraud-acquaintance-01',category:'acquaintance',title:'冒充熟人或家属借钱',text:'以换号、开会不便或事情紧急为由，要求向第三方账户转账，并阻止受害人电话核实。',advice:'先用原号码或当面确认；任何紧急转账都要二次核验。',cues:['换号','家人','熟人','老板','急用钱','转账'],sourceName:'fraud-detect-bench-zh',sourceUrl:'https://github.com/uninhibited-scholar/fraud-detect-bench-zh',license:'CC BY 4.0'},
  {id:'fraud-brushing-01',category:'brushing',title:'刷单返利',text:'以点赞、好评、日结兼职吸引参与，先给小额返利，再用连单、卡单或解冻为由要求继续充值。',advice:'刷单本身违法且高风险；凡是先垫付、充值才能提现的兼职都应立即停止。',cues:['兼职','刷单','点赞','返利','佣金','垫付','充值'],sourceName:'fraud-detect-bench-zh',sourceUrl:'https://github.com/uninhibited-scholar/fraud-detect-bench-zh',license:'CC BY 4.0'},
  {id:'fraud-pig-01',category:'investment',title:'虚假投资与荐股',text:'用内部消息、导师带单、稳赚不赔或高额日收益诱导在陌生平台充值，常以感情或熟人关系建立信任。',advice:'拒绝保本高收益承诺，不向陌生平台充值；投资信息通过持牌机构公开渠道核验。',cues:['投资','荐股','导师','内部消息','稳赚','虚拟货币','收益'],sourceName:'fraud-detect-bench-zh',sourceUrl:'https://github.com/uninhibited-scholar/fraud-detect-bench-zh',license:'CC BY 4.0'},
  {id:'fraud-prize-01',category:'prize',title:'中奖与免费礼品',text:'声称中奖或零元领取礼品，随后要求先付税费、运费、激活费，或填写个人信息。',advice:'未参与的抽奖不要相信；任何“先付款再领奖”都应停止。',cues:['中奖','免费','礼品','激活费','运费','缴税'],sourceName:'fraud-detect-bench-zh',sourceUrl:'https://github.com/uninhibited-scholar/fraud-detect-bench-zh',license:'CC BY 4.0'},
  {id:'fraud-loan-01',category:'loan',title:'贷款保证金与解冻费',text:'用低门槛贷款吸引申请，再以银行卡填错、资金冻结或验证还款能力为由收取保证金和解冻费。',advice:'正规贷款不会在放款前要求转账；立即停止付款并向正规机构核实。',cues:['贷款','放款','保证金','解冻','卡号','征信'],sourceName:'fraud-detect-bench-zh',sourceUrl:'https://github.com/uninhibited-scholar/fraud-detect-bench-zh',license:'CC BY 4.0'},
  {id:'legit-channel-01',category:'verification',title:'正规通知的核实特征',text:'正规服务通知通常给出可独立核验的订单、时间或官方热线，不索要密码和验证码，也不要求向个人账户转账。',advice:'不要回拨陌生来电提供的号码；从官方网站、官方应用或账单背面自行寻找联系方式。',cues:['官方渠道','核实','官方电话','订单','通知'],sourceName:'fraud-detect-bench-zh',sourceUrl:'https://github.com/uninhibited-scholar/fraud-detect-bench-zh',license:'CC BY 4.0'},
  {id:'silverfit-language-01',category:'silverfit',title:'适老表达：常用词与短句',text:'面向中高龄观众时，优先使用高频、具体、口语化词汇；一句表达一个动作，避免连续堆叠术语。',advice:'单句建议不超过二十字，关键动作至少重复一次，并把“去哪里、做什么”说清楚。',cues:['老人','银发','适老','短句','口语','字幕'],sourceName:'complete-hsk-vocabulary',sourceUrl:'https://github.com/drkameleon/complete-hsk-vocabulary',license:'MIT'}
];

function tokens(text: string) {
  const clean = text.toLowerCase().replace(/[^\p{Script=Han}a-z0-9]/gu, '');
  const chars = [...clean];
  const out = new Set<string>();
  for (const c of chars) out.add(c);
  for (let i = 0; i < chars.length - 1; i++) out.add(chars[i] + chars[i + 1]);
  for (const word of text.toLowerCase().split(/[^\p{Script=Han}a-z0-9]+/u)) if (word) out.add(word);
  return out;
}

export function retrieve(query: string, topK = 4): RetrievalHit[] {
  const q = tokens(query);
  return corpus.map(item => {
    const body = `${item.title} ${item.text} ${item.advice} ${item.cues.join(' ')}`;
    const d = tokens(body);
    let overlap = 0;
    for (const token of q) if (d.has(token)) overlap += token.length === 2 ? 2.4 : 0.35;
    const matched = item.cues.filter(cue => query.includes(cue) || [...tokens(cue)].some(t => q.has(t))).slice(0, 4);
    const cueBoost = item.cues.reduce((sum, cue) => sum + (query.includes(cue) ? 8 : 0), 0);
    const score = Math.round((overlap + cueBoost) * 100) / 100;
    return {...item, score, matched};
  }).sort((a,b) => b.score - a.score)
    .filter(hit => hit.score >= 6 || hit.id === 'silverfit-language-01')
    .slice(0, Math.max(1, Math.min(topK, 6)));
}

export function buildContext(hits: RetrievalHit[]) {
  return hits.map((h, i) => `[E${i + 1}] ${h.title}\n风险特征：${h.text}\n建议动作：${h.advice}\n来源：${h.sourceName}（${h.id}，${h.license}）`).join('\n\n');
}

