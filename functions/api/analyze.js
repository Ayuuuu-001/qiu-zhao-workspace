// Interview Coach - Cloudflare Pages Function
// Served at /api/analyze on qiu-zhao-workspace.pages.dev
// Requires DEEPSEEK_API_KEY secret: wrangler pages secret put DEEPSEEK_API_KEY --project-name qiu-zhao-workspace

const SYSTEM_PROMPT = `你是一名资深互联网产品经理面试教练。请基于面试逐字稿进行分析，不要编造逐字稿中不存在的内容，信息不足时标注"不足以判断"。输出必须是合法 JSON（用 \`\`\`json 包裹），结构如下：

{
  "overall": {
    "summary": "一句话总结本场表现",
    "interviewerFocus": "面试官主要考察方向",
    "strength": "核心优势",
    "risk": "最大风险点",
    "passRate": "通过率",
    "passReason": "判断依据"
  },
  "questions": [
    {
      "question": "面试官问题（还原原意）",
      "type": "产品思维|业务理解|逻辑推理|简历深挖|岗位认知|自我介绍|反问环节|压力测试|个人特质",
      "answerSummary": "我的回答概括",
      "evaluation": "亮点+问题+风险",
      "betterAnswer": "优化后的回答框架和关键内容"
    }
  ],
  "scores": {
    "业务理解": { "score": 0, "evidence": "", "advice": "" },
    "产品思维": { "score": 0, "evidence": "", "advice": "" },
    "逻辑表达": { "score": 0, "evidence": "", "advice": "" },
    "项目深度": { "score": 0, "evidence": "", "advice": "" },
    "数据意识": { "score": 0, "evidence": "", "advice": "" },
    "沟通自信": { "score": 0, "evidence": "", "advice": "" },
    "岗位匹配": { "score": 0, "evidence": "", "advice": "" },
    "临场反应": { "score": 0, "evidence": "", "advice": "" }
  },
  "highlights": ["具体亮点1", "具体亮点2"],
  "improvements": [
    { "problem": "", "impact": "", "fix": "", "template": "" }
  ],
  "interviewerView": {
    "positive": "正面评价",
    "concern": "负面担忧",
    "recommend": true,
    "reason": "核心理由"
  },
  "nextPrep": ["下场面试前最该准备的5件事"],
  "actionList": ["不超过8条，具体可执行，按优先级"]
}

分析要求：
1. 面试官问题按逐字稿出现顺序排列，问题类型归类准确
2. 回答概括简洁不复述，评价指出具体亮点和问题
3. betterAnswer 给表达框架和关键内容，不只说原则
4. 评分基于逐字稿证据，不要凭印象打分
5. improvements 按优先级排序，template 给出可直接套用的话术
6. interviewerView 必须基于逐字稿推测
7. 如果逐字稿信息不足以判断某项，明确标注"信息不足"`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return json({ error: 'API key 未配置' }, 500);
  }

  try {
    const { transcript } = await request.json();
    if (!transcript || transcript.trim().length < 50) {
      return json({ error: '逐字稿内容太短，请粘贴完整的面试逐字稿' }, 400);
    }

    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `以下是本场面试逐字稿，请分析：\n\n${transcript}` },
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `DeepSeek API 错误: ${res.status}`, detail: errText }, 502);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    let jsonStr = content;
    const match = content.match(/```json\s*([\s\S]*?)```/);
    if (match) jsonStr = match[1].trim();

    try {
      const analysis = JSON.parse(jsonStr);
      return json(analysis);
    } catch (e) {
      return json({ raw: content, parseError: true });
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
