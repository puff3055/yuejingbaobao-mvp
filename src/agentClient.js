import { selectEvidencePackets } from "./agentKnowledge.js";

function shortTask(message, analysis) {
  if (/下午.{0,6}(?:会|会议|汇报)/.test(message)) return "下午还有会";
  if (/上午.{0,6}(?:会|会议|汇报)/.test(message)) return "上午还有会";
  if (/今晚.{0,6}(?:会|工作|考试|答辩)/.test(message)) return "今晚还有安排";
  return analysis?.taskDetail || "今天还有必须完成的事";
}

function rememberedReply(memory) {
  if (!memory) return null;
  const action = memory.actionTitle || "那个办法";
  if (memory.effect === "none") return `上回「${action}」没有帮到妳，我不会再把它放在前面。今天想换一个办法吗？`;
  if (memory.effect === "helped") return `上回「${action}」确实让妳轻了一点，我一直替妳留着。今天还方便用它吗？`;
  return `上回「${action}」有一点帮助，我替妳留着这个结果。今天的处境和那次相近吗？`;
}

function firstReply({ analysis, message }) {
  const hasPain = analysis?.tags?.some((tag) => /疼痛|头痛|腰背/.test(tag));
  const hasConstraint = analysis?.tags?.includes("现实任务不能取消");
  if (hasPain && hasConstraint) {
    return `偏偏${shortTask(message, analysis)}……这次的痛，会让妳很难走动、坐着或集中注意吗？`;
  }
  if (hasPain) return "疼痛已经占住妳不少力气了。它会影响妳走动、坐着或睡觉吗？";
  if (analysis?.tags?.includes("初潮准备")) return "第一次月经如果在学校到来，妳最担心哪一件事？";
  if (analysis?.tags?.includes("长期变化整理")) return "这些年的身体经验还在。妳最想先找回哪一段变化？";
  if (analysis?.intent === "knowledge") return "这条说法听起来很肯定。我替妳看看它有多少证据、又漏掉了什么。";
  return "妳不用先把话整理好。这个变化最早是什么时候出现的？";
}

function nextReply({ analysis, message, memory, evidence = [] }) {
  if (/(走不动|走动(?:也|或)?(?:很)?困难|走动或坐着都很困难|无法走|站不住|不能站|痛醒|无法睡)/.test(message)) {
    return "已经影响到基本活动了。这次和妳熟悉的那种痛相似，还是明显不一样？";
  }
  if (/(很难集中|难集中|无法集中|不能集中|坐着.{0,5}(难受|痛))/.test(message)) {
    const recalled = rememberedReply(memory);
    return recalled || "注意力已经被痛占走了。过去有什么办法，曾让妳松一点吗？";
  }
  if (/热敷|热水袋|暖宝宝/.test(message)) {
    if (/没用|没有用|更痛|更不舒服|烫伤/.test(message)) return "温热没有帮到妳，这次不再把它放在前面。妳更想减轻疼痛，还是先让下午的安排容易一点？";
    if (/有用|有效|舒服|缓解|好一点/.test(message)) return "温热曾让妳松一点，我替妳留着这段经验。今天手边方便用吗？";
  }
  if (analysis?.intent === "knowledge" && evidence.length) {
    const claim = evidence[0].claim.replace(/[。；].*$/, "");
    return `资料里较确定的是：${claim}。这仍不能直接说明妳个人一定如此。`;
  }
  const recalled = rememberedReply(memory);
  if (recalled) return recalled;
  if (/和(?:以前|以往)差不多|没有明显变化|没明显变化/.test(message)) return "这次仍像妳熟悉的疼法。妳过去试过什么，确实有一点帮助？";
  if (/不确定|好像有变化|不太一样/.test(message)) return "这点变化值得认真看。它是突然出现，还是慢慢变得更明显的？";
  return analysis?.followUp || "还有哪一件事，会真正改变妳接下来怎么安排？";
}

function turnFor({ analysis, message, history = [], memory = null, evidence = [] }) {
  if (!history.length) {
    const reply = firstReply({ analysis, message });
    if (analysis?.intent === "knowledge" && evidence.length) {
      const claim = evidence[0].claim.replace(/[。；].*$/, "");
      return {
        kind: "answer",
        reply: `资料里较确定的是：${claim}。这仍不能直接说明妳个人一定如此。`,
        quickReplies: [],
      };
    }
    const hasPain = analysis?.tags?.some((tag) => /疼痛|头痛|腰背/.test(tag));
    const hasConstraint = analysis?.tags?.includes("现实任务不能取消");
    return {
      kind: "question",
      reply,
      quickReplies: hasPain && hasConstraint
        ? ["主要很难集中", "走动或坐着都很困难"]
        : hasPain
          ? ["还能活动，但很难受", "已经影响走路或睡觉"]
          : [],
    };
  }

  if (/(走不动|走动(?:也|或)?(?:很)?困难|走动或坐着都很困难|无法走|站不住|不能站|痛醒|无法睡|影响走路|影响睡觉)/.test(message)) {
    return { kind: "assessment", reply: nextReply({ analysis, message, memory, evidence }), quickReplies: [] };
  }

  if (/(主要很难集中|还能活动，但很难受|很难集中|难集中|无法集中|不能集中|坐着.{0,5}(难受|痛))/.test(message)) {
    return {
      kind: "question",
      reply: "这次和妳熟悉的那种痛相似吗，还是明显不一样？",
      quickReplies: ["和以前差不多", "明显不一样"],
    };
  }

  if (/(和(?:以前|以往)差不多|没有明显变化|没明显变化)/.test(message)) {
    const recalled = rememberedReply(memory);
    if (memory?.effect === "none") return { kind: "question", reply: recalled, quickReplies: [] };
    if (recalled) return { kind: "action", reply: recalled, quickReplies: [] };
    return {
      kind: "action",
      reply: "这次仍像妳熟悉的疼法。小潮把一个可能少费力的办法放在这里，妳看看合不合此刻。",
      quickReplies: [],
    };
  }

  if (/(明显不一样|不确定|好像有变化|不太一样)/.test(message)) {
    return { kind: "assessment", reply: nextReply({ analysis, message, memory, evidence }), quickReplies: [] };
  }

  const reply = nextReply({ analysis, message, memory, evidence });
  const asksQuestion = /[？?]/.test(reply);
  return { kind: asksQuestion ? "question" : analysis?.intent === "knowledge" ? "answer" : "conversation", reply, quickReplies: [] };
}

export function localReply({ analysis, message, history = [], memory = null, evidence = [] }) {
  return turnFor({ analysis, message, history, memory, evidence }).reply;
}

export async function requestAgentReply({ message, history = [], analysis, context = {}, memory = null, knowledgeClaims = [] }) {
  const localEvidence = selectEvidencePackets(knowledgeClaims, message);
  const localTurn = turnFor({ analysis, message, history, memory, evidence: localEvidence });
  const fallback = {
    ...localTurn,
    mode: context.allowRemote ? "local" : "device",
    evidence: localEvidence,
  };
  if (!context.allowRemote) return fallback;
  const requestBody = JSON.stringify({
    message,
    history: history.slice(-10).map(({ role, content }) => ({ role, content })),
    context: { ...context, requestedTurnKind: localTurn.kind },
  });
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 24000);
      try {
        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
          signal: controller.signal,
        });
        if (!response.ok) {
          if (attempt === 0 && response.status >= 500) {
            await new Promise((resolve) => setTimeout(resolve, 450));
            continue;
          }
          break;
        }
        const payload = await response.json();
        if (!payload?.reply || typeof payload.reply !== "string") {
          if (attempt === 0 && payload?.retryable) {
            await new Promise((resolve) => setTimeout(resolve, 450));
            continue;
          }
          break;
        }
        return {
          reply: payload.reply.trim(),
          kind: typeof payload.kind === "string" ? payload.kind : /[？?]/.test(payload.reply) ? "question" : localTurn.kind,
          quickReplies: Array.isArray(payload.quickReplies) ? payload.quickReplies : localTurn.quickReplies,
          mode: "connected",
          model: payload.model || null,
          evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
        };
      } catch {
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 450));
          continue;
        }
      } finally {
        clearTimeout(timer);
      }
    }
    return {
      ...fallback,
      reply: `刚刚联网没有接稳。这一小句是我在设备里先接住的：${fallback.reply}`,
    };
  } catch {
    return { ...fallback, reply: `刚刚联网没有接稳。这一小句是我在设备里先接住的：${fallback.reply}` };
  }
}
