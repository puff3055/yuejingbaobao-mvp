function listExplicitNegatives(message) {
  const negatedClauses = [...message.matchAll(/(?:没有|没)([^。！？；但]{1,40})/g)].map((match) => match[1]).join("、");
  return [
    [/头晕/, "头晕"],
    [/发热|发烧/, "发热"],
    [/异常出血/, "异常出血"],
    [/呕吐/, "呕吐"],
  ].filter(([pattern]) => pattern.test(negatedClauses)).map(([, label]) => label);
}

export function localReply({ analysis, message, babyName, history = [], context = {} }) {
  const name = babyName || "宝宝";
  const tags = analysis?.tags?.slice(0, 3).join("、") || "妳现在的感受";
  const situation = analysis?.context || "妳正在努力把身体感受说清楚";
  const followUp = analysis?.followUp || "这件事从什么时候开始，和以前相比有什么变化？";
  const needs = (context.needs || []).slice(0, 2).join("、");
  const style = context.communicationStyle || "quiet";
  const sign = style === "playful" ? `我会陪妳把这件事一点点拆开。——${name}` : style === "clear" ? `先抓重点，我们再决定下一步。——${name}` : `妳可以慢慢说，我在。——${name}`;
  if (history.length) {
    const negatives = listExplicitNegatives(message);
    const similarity = /和(?:以前|以往)差不多|跟(?:以前|以往)差不多/.test(message);
    const functionalDetail = /(站着|走路|上课|汇报|工作|睡觉|通勤|考试).{0,10}(更|很|会).{0,8}(难受|痛|影响)|(?:难受|痛).{0,8}(站着|走路|上课|汇报|工作|睡觉|通勤|考试)/.exec(message)?.[0];
    const heard = [
      similarity ? "这次和以往的模式相似" : null,
      negatives.length ? `妳目前没有提到${negatives.join("、")}` : null,
      functionalDetail ? `“${functionalDetail}”是一个会改变建议的现实限制` : null,
    ].filter(Boolean);
    if (heard.length) {
      return style === "clear"
        ? `我抓到三个重点：${heard.join("；")}。这些信息还不能排除所有风险。接下来先看一个配合当下安排、随时可以停下的选择。——${name}`
        : `谢谢妳继续说，这些细节让我更明白了：${heard.join("；")}。就妳目前提供的信息，我不会把它说成已经排除所有风险，也不会让妳重复回答同一组问题。接下来我们先看一个能配合当下安排、随时可以停下的选择。——${name}`;
    }
    return `我把妳刚补充的内容接在前面了。现在最重要的是：${situation.replace(/[。！？]+$/, "")}。如果我理解错了，妳可以直接纠正我。${sign}`;
  }
  const opening = message.length > 80 ? "妳说了不少重要细节，我先替妳收拢一下。" : style === "clear" ? "我听见了，先抓重点。" : style === "playful" ? "我听见啦，我们把线索一颗颗捡起来。" : "我听见了，先陪妳把这件事放稳。";
  const contextSentence = /[。！？]$/.test(situation) ? situation : `${situation}。`;
  const needSentence = needs ? `妳希望我重点支持“${needs}”，我会把它放在接下来的提问里。` : "";
  return `${opening}${contextSentence}我先记下了：${tags}。${needSentence}${followUp} ${sign}`;
}

export async function requestAgentReply({ message, history = [], analysis, babyName, context = {} }) {
  const fallback = { reply: localReply({ analysis, message, babyName, history, context }), mode: context.allowRemote ? "local" : "device" };
  if (!context.allowRemote) return fallback;
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
