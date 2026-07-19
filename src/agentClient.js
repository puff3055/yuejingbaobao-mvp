function listExplicitNegatives(message) {
  const negatedClauses = [...message.matchAll(/(?:没有|没)([^。！？；但]{1,40})/g)].map((match) => match[1]).join("、");
  return [
    [/头晕/, "头晕"],
    [/发热|发烧/, "发热"],
    [/异常出血/, "异常出血"],
    [/呕吐/, "呕吐"],
  ].filter(([pattern]) => pattern.test(negatedClauses)).map(([, label]) => label);
}

export function localReply({ analysis, message, babyName, history = [] }) {
  const name = babyName || "宝宝";
  const tags = analysis?.tags?.slice(0, 3).join("、") || "你现在的感受";
  const context = analysis?.context || "你正在努力把身体感受说清楚";
  const followUp = analysis?.followUp || "这件事从什么时候开始，和以前相比有什么变化？";
  if (history.length) {
    const negatives = listExplicitNegatives(message);
    const similarity = /和(?:以前|以往)差不多|跟(?:以前|以往)差不多/.test(message);
    const functionalDetail = /(站着|走路|上课|汇报|工作|睡觉|通勤|考试).{0,10}(更|很|会).{0,8}(难受|痛|影响)|(?:难受|痛).{0,8}(站着|走路|上课|汇报|工作|睡觉|通勤|考试)/.exec(message)?.[0];
    const heard = [
      similarity ? "这次和以往的模式相似" : null,
      negatives.length ? `你目前没有提到${negatives.join("、")}` : null,
      functionalDetail ? `“${functionalDetail}”是一个会改变建议的现实限制` : null,
    ].filter(Boolean);
    if (heard.length) {
      return `谢谢你继续说，这些细节让我更明白了：${heard.join("；")}。就你目前提供的信息，我不会把它说成已经排除所有风险，但也不会重复让你回答同一组问题。接下来我会先给你一个能配合当下安排、随时可以停下的选择。——${name}`;
    }
    return `我把你刚补充的内容接在前面了，不会当成一段新的、无关的记录。现在最重要的是：${context.replace(/[。！？]+$/, "")}。如果我理解错了，你可以直接纠正我；我会据此调整下一步。——${name}`;
  }
  const opening = message.length > 80 ? "你说了不少重要细节，我先替你收拢一下。" : "我听见了，我先不急着给结论。";
  const contextSentence = /[。！？]$/.test(context) ? context : `${context}。`;
  return `${opening}${contextSentence}我先记下了：${tags}。${followUp} 你可以按自己的方式继续说，不需要一次讲完整。——${name}`;
}

export async function requestAgentReply({ message, history = [], analysis, babyName, context = {} }) {
  const fallback = { reply: localReply({ analysis, message, babyName, history }), mode: "local" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: history.slice(-10).map(({ role, content }) => ({ role, content })),
        context,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return fallback;
    const payload = await response.json();
    if (!payload?.reply || typeof payload.reply !== "string") return fallback;
    return { reply: payload.reply.trim(), mode: "connected", model: payload.model || null };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
