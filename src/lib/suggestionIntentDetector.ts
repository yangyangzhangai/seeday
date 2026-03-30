// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/store/README.md

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, '');
}

function hasZh(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

export function scoreExplicitSuggestionRequest(text: string): number {
  const normalized = normalizeText(text);
  if (!normalized || !hasZh(normalized)) return 0;

  let score = 0;

  if (/(给我|帮我|请你|麻烦你).{0,8}(建议|主意|方案|办法|方向)/.test(normalized)) score += 3;
  if (/(给点|给些|来点).{0,6}(建议|主意|方案|办法|方向)/.test(normalized)) score += 3;
  if (/(能不能|能否|可以|可不可以).{0,10}(给我|给点|给些|来点|提).{0,8}(建议|主意|方案|办法|方向)/.test(normalized)) score += 3;
  if (/帮我(规划|计划|安排|选择|决策|定计划)/.test(normalized)) score += 3;
  if (/(我该|该)(怎么办|怎么做|怎么选|做什么)/.test(normalized)) score += 3;
  if (/(我该|我应该|应该).{0,8}(先做什么|先做哪个|先做哪件|怎么做|怎么办|怎么选|选哪个)/.test(normalized)) score += 3;
  if (/(我该|我应该|应该).{0,12}还是.{0,12}/.test(normalized)) score += 3;
  if (/(告诉我|说说|说一下).{0,8}(下一步|先做什么|先做哪个|该怎么做|该怎么办)/.test(normalized)) score += 3;
  if (/接下来.{0,8}(我该|我应该|应该|先做什么|先做哪个|怎么做|怎么办|怎么选)/.test(normalized)) score += 2;
  if (/(下一步|现在)(做什么|怎么做|怎么选)/.test(normalized)) score += 2;
  if (/(建议|主意|方案|办法|规划|选择|优先级|下一步)/.test(normalized)) score += 1;
  if (/(怎么办|怎么做|怎么选|做什么|咋办|如何)/.test(normalized)) score += 1;
  if (/[？?]/.test(normalized)) score += 1;
  if (/(请|立刻|马上|具体点|直接点)/.test(normalized)) score += 1;

  if (
    /(我今天|今天我|刚刚|刚才|我在|我完成了|我记录了|打卡了)/.test(normalized)
    && !/(建议|主意|方案|规划|选择|怎么办|怎么做|做什么)/.test(normalized)
  ) {
    score -= 3;
  }

  if (/(建议书|给你建议|我建议你)/.test(normalized)) {
    score -= 2;
  }

  return score;
}

export function isExplicitSuggestionRequest(text: string): boolean {
  return scoreExplicitSuggestionRequest(text) >= 3;
}
