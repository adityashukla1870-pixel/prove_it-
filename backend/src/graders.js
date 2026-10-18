import { clamp, evidencePresent, extractJson, normalizeEvidenceWhitespace } from './util.js';

const rubricFor = (skill, seed) => {
  const sets = [
    [30, 25, 20, 15, 10],
    [25, 25, 20, 20, 10],
    [30, 20, 20, 20, 10],
    [25, 20, 20, 20, 15],
  ];
  const weights = sets[seed % sets.length];
  return [
    ['Task understanding', 'Interprets the goal and constraints'],
    [`${skill} fundamentals`, 'Applies the core skills needed for the work'],
    ['Practical execution', 'Presents a feasible, usable solution'],
    ['Reasoning and trade-offs', 'Explains choices, assumptions, and trade-offs'],
    ['Clear communication', 'Communicates the result in a clear, structured way'],
  ].map(([name, description], index) => ({ name, weight: weights[index], description }));
};

const hashText = (text) => [...String(text)].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);

function mockChallenge({ mode, text }) {
  const seed = hashText(text);
  const lower = text.toLowerCase();
  const skill = /sql|excel|data|statistic|dashboard/.test(lower) ? 'Data analysis'
    : /market|growth|customer|sales|brand/.test(lower) ? 'Growth strategy'
      : /design|product|app|user|interface/.test(lower) ? 'Product development'
        : /code|software|engineer|api|technical/.test(lower) ? 'Software development'
          : 'Problem solving';
  const subject = text.replace(/\s+/g, ' ').trim().split(/[.!?]/)[0].slice(0, 90) || 'the proposed work';
  const title = `${skill}: ${subject.slice(0, 54)}${subject.length > 54 ? '…' : ''}`;
  const task = mode === 'idea'
    ? `Create a practical first-step plan for this venture: “${subject}”. Identify the primary user, outline a small testable solution, and explain how you would validate it with limited time and resources. Include the key assumptions, a simple success measure, and the first two actions you would take.`
    : `Prepare a short work sample based on this role: “${subject}”. Use a realistic example to show how you would approach one important responsibility, explain your method, and describe how you would check the result. State assumptions and any trade-offs clearly.`;
  return {
    title,
    skill,
    level: ['Beginner', 'Intermediate', 'Advanced'][seed % 3],
    timeLimitMin: 30 + (seed % 16),
    task,
    rubric: rubricFor(skill, seed),
    seedQuestions: [
      `Which part of your approach best addresses ${skill.toLowerCase()} for this challenge, and why?`,
      `What assumption in your plan would you test first for “${subject.slice(0, 45)}”?`,
      'What would you change if your first result did not meet the goal?',
    ],
  };
}

function scaleRubric(rows) {
  const valid = rows.slice(0, 6).map((row) => ({
    name: String(row.name || '').trim(),
    description: String(row.description || '').trim(),
    weight: Math.max(1, Number(row.weight) || 1),
  })).filter((row) => row.name && row.description);
  if (valid.length < 4) throw new Error('AI returned fewer than four rubric criteria');
  const sum = valid.reduce((n, row) => n + row.weight, 0);
  const scaled = valid.map((row) => row.weight / sum * 100);
  const weights = scaled.map(Math.floor);
  let remaining = 100 - weights.reduce((n, value) => n + value, 0);
  [...scaled.keys()].sort((a, b) => (scaled[b] % 1) - (scaled[a] % 1)).slice(0, remaining).forEach((i) => weights[i]++);
  return valid.map((row, i) => ({ name: row.name, description: row.description, weight: weights[i] }));
}

function validateChallenge(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('AI returned an invalid challenge');
  const title = String(raw.title || '').trim();
  const skill = String(raw.skill || '').trim();
  const task = String(raw.task || '').trim();
  if (!title || !skill || task.length < 40) throw new Error('AI returned an incomplete challenge');
  const seedQuestions = (Array.isArray(raw.seedQuestions) ? raw.seedQuestions : []).map((q) => String(q).trim()).filter(Boolean).slice(0, 3);
  while (seedQuestions.length < 2) seedQuestions.push('What assumption would you test first, and why?');
  return {
    title,
    skill,
    level: ['Beginner', 'Intermediate', 'Advanced'].includes(raw.level) ? raw.level : 'Intermediate',
    timeLimitMin: Math.round(clamp(Number(raw.timeLimitMin) || 35, 30, 45)),
    task,
    rubric: scaleRubric(Array.isArray(raw.rubric) ? raw.rubric : []),
    seedQuestions,
  };
}

async function callProvider(provider, system, user) {
  const base = provider.baseUrl.replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.AI_TIMEOUT_MS) || 45000);
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: provider.model, temperature: 0.4, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || `AI provider returned ${response.status}`);
    const content = data.choices?.[0]?.message?.content;
    const text = Array.isArray(content) ? content.map((part) => part.text || '').join('') : content;
    return extractJson(text);
  } finally {
    clearTimeout(timer);
  }
}

async function structuredAI({ system, user, mock, validate }) {
  if (process.env.AI_MOCK === '1') return validate(mock());
  const providers = [
    ['AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL'],
    ['AI2_BASE_URL', 'AI2_API_KEY', 'AI2_MODEL'],
    ['AI3_BASE_URL', 'AI3_API_KEY', 'AI3_MODEL'],
  ].map(([base, key, model]) => ({ baseUrl: process.env[base], apiKey: process.env[key], model: process.env[model] }))
    .filter((provider) => provider.baseUrl && provider.apiKey && provider.model);
  // Keep local development usable from a fresh checkout. Production still
  // requires an explicitly configured provider or AI_FALLBACK_MOCK=1.
  const localNoProviderFallback = process.env.NODE_ENV !== 'production' && providers.length === 0;
  let lastError;
  for (const provider of providers) {
    try {
      return validate(await callProvider(provider, system, user));
    } catch (error) {
      lastError = error;
    }
  }
  if (process.env.AI_FALLBACK_MOCK === '1' || localNoProviderFallback) return validate(mock());
  throw new Error(lastError?.message || 'No AI provider is configured');
}

export function generateChallenge({ mode, text }) {
  const input = { mode, text };
  return structuredAI({
    system: 'Draft a practical 30-45 minute hiring or founder challenge from the provided source. Produce 4-6 rubric criteria with integer weights totaling 100, and 2-3 useful starter questions. Return only valid JSON with title, skill, level, timeLimitMin, task, rubric (name, weight, description), and seedQuestions.',
    user: JSON.stringify(input),
    mock: () => mockChallenge(input),
    validate: validateChallenge,
  });
}

function validateQuestions(raw) {
  const questions = Array.isArray(raw) ? raw : raw?.questions;
  const result = (Array.isArray(questions) ? questions : []).map((item) => String(typeof item === 'string' ? item : item.question || item.q || '').trim()).filter(Boolean).slice(0, 3);
  if (result.length < 2) throw new Error('AI returned fewer than two follow-up questions');
  return result;
}

function mockFollowups({ answer, seedQuestions = [] }) {
  const words = answer.trim().split(/\s+/).filter(Boolean);
  const snippet = words.slice(0, Math.min(5, words.length)).join(' ') || 'your proposed approach';
  const seed = hashText(answer);
  return [
    `You wrote “${snippet}”. What evidence or experience led you to that choice?`,
    `Which risk in your answer would you test first, and what result would change your plan?`,
    seedQuestions[seed % Math.max(seedQuestions.length, 1)] || 'What would you change if your first approach did not work?',
  ];
}

export function generateFollowups(challenge, answer) {
  const input = { challengeTitle: challenge.title, skill: challenge.skill, seedQuestions: challenge.seedQuestions || [], answer };
  return structuredAI({
    system: 'Write 2-3 specific follow-up questions about the candidate answer and challenge. Quote or reference details from this candidate answer, probe reasoning and evidence, and avoid generic interview questions. Return only JSON: {"questions":["..."]}.',
    user: JSON.stringify(input),
    mock: () => mockFollowups(input),
    validate: validateQuestions,
  });
}

const answerSentences = (text) => String(text || '').split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
const has = (text, pattern) => pattern.test(String(text || '').toLowerCase());
const evidenceFor = (criterion, answer) => {
  const keys = `${criterion.name} ${criterion.description}`.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 4);
  return answerSentences(answer).find((sentence) => keys.some((word) => sentence.toLowerCase().includes(word))) || '';
};

export function extractDefenseAnswers(value) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') return String(item.a ?? item.answer ?? '').trim();
      return '';
    }).filter(Boolean);
  }
  if (typeof value !== 'string') return [];
  const answerBlocks = [...value.matchAll(/(?:^|\n)Answer:\s*([\s\S]*?)(?=\n(?:Question:|$))/gi)]
    .map((match) => match[1].trim()).filter(Boolean);
  if (answerBlocks.length) return answerBlocks;
  return value.split(/\n+/).map((line) => line.replace(/^Question:\s*/i, '').trim()).filter(Boolean);
}

function mockGrade({ challenge, candidateAnswer, defendAnswers = [], defendTranscript = '', runIndex = 0 }) {
  const answer = candidateAnswer.toLowerCase();
  // Only candidate answers participate in consistency. Follow-up question
  // wording is context, not evidence about the candidate.
  const defense = extractDefenseAnswers(defendAnswers.length ? defendAnswers : defendTranscript).join(' ').toLowerCase();
  const challengeTerms = `${challenge.skill} ${challenge.task}`.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 4);
  const taskFit = challengeTerms.some((term) => answer.includes(term));
  const action = has(answer, /\b(would|will|first|build|create|test|compare|measure|check|analy[sz]e|interview|launch|track|validate|calculate|clean|query|design|review|pilot)\b/);
  const metrics = has(answer, /\b(metric|measure|track|rate|percent|%,|revenue|cost|margin|conversion|retention|repeat|accuracy|time|baseline|target|result|orders|users|sales)\b|\b\d+(?:\.\d+)?%?/);
  const assumptions = has(answer, /\b(assum|hypothes|expect|if |suppose|unknown|validate|test first)\b/);
  const tradeoffs = has(answer, /\b(trade.?off|because|instead|however|risk|limitation|constraint|alternative|cost|benefit|reliable|fallback)\b/);
  const evidence = has(answer, /\b(example|data|record|sample|source|customer|student|cook|founder|query|dashboard|result|order|payment|survey|interview)\b/);
  const alignmentTerms = defense.split(/[^a-z0-9]+/).filter((word) => word.length > 4);
  const uniqueDefenseTerms = new Set(alignmentTerms);
  const aligned = [...uniqueDefenseTerms].filter((word) => answer.includes(word)).length;
  const consistency = uniqueDefenseTerms.size ? aligned / uniqueDefenseTerms.size : 0;
  const authenticity = consistency >= 0.2 ? 'high' : consistency >= 0.08 ? 'medium' : 'low';
  const seed = hashText(candidateAnswer + defendTranscript);
  const criteria = challenge.rubric.map((item, index) => {
    const label = `${item.name} ${item.description}`.toLowerCase();
    let points = 42;
    if (taskFit) points += 12;
    if (action) points += 10;
    if (evidence) points += 8;
    if (metrics) points += /measure|metric|result|execution/i.test(label) ? 17 : 7;
    if (assumptions) points += /assum|understand|risk|reason/i.test(label) ? 15 : 5;
    if (tradeoffs) points += /reason|trade.?off|risk|analysis/i.test(label) ? 15 : 5;
    if (/reason|analysis|problem.?solv/i.test(label)) points += Math.round(consistency * 15) - 4;
    if (/communication|clear/i.test(label)) points += has(answer, /\b(first|then|finally|therefore|because)\b/) ? 10 : -3;
    const variation = ((seed + index * 7 + runIndex * 5) % 5) - 2;
    const percent = clamp(points + variation, 20, 94);
    const quote = evidenceFor(item, candidateAnswer);
    return {
      name: item.name,
      max: item.weight,
      score: Math.round(item.weight * percent / 100 * 100) / 100,
      evidence: quote ? [normalizeEvidenceWhitespace(quote)] : [],
      why: quote
        ? `The response includes a concrete statement related to ${item.name.toLowerCase()}, but could make its support more measurable.`
        : `The response did not provide a specific statement that supports ${item.name.toLowerCase()}.`,
    };
  });
  return {
    total: criteria.reduce((sum, item) => sum + item.score, 0),
    criteria,
    authenticity_signal: {
      level: authenticity,
      reasons: [authenticity === 'high' ? 'The spoken answers reused several details from the written solution.' : authenticity === 'medium' ? 'Some spoken details aligned with the written solution.' : 'The spoken answers shared few specific details with the written solution.'],
    },
    grader_confidence: 0.68 + (seed % 20) / 100,
  };
}

function explanationFor(result, rubric, evidence) {
  const candidate = normalizeEvidenceWhitespace(result?.why ?? result?.explanation ?? '');
  if (candidate.length >= 20 && candidate.length <= 600) {
    const terms = `${rubric.name} ${rubric.description}`.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 4);
    const mentionsCriterion = terms.some((term) => candidate.toLowerCase().includes(term));
    const mentionsEvidence = evidence.some((quote) => quote.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 4).some((word) => candidate.toLowerCase().includes(word)));
    if (mentionsCriterion || mentionsEvidence) return candidate;
  }
  if (evidence.length) return `The response includes an exact statement relevant to ${rubric.name.toLowerCase()}, but the model explanation was not specific enough to retain.`;
  return `Unsupported model explanation: no exact submitted-text reference was accepted for ${rubric.name.toLowerCase()}.`;
}

function safeAuthenticityReasons(signal) {
  return (Array.isArray(signal?.reasons) ? signal.reasons : []).map(String).map((reason) => (
    /cheat|fraud|plagiar|guilt|proof of misconduct/i.test(reason)
      ? 'Low alignment is not proof of misconduct; the spoken answers shared limited verifiable details with the written response.'
      : reason.slice(0, 500)
  )).filter(Boolean).slice(0, 5);
}

export function validateGrade(raw, challenge, answer) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.criteria) || !raw.criteria.length) throw new Error('AI returned an invalid grade');
  const source = Array.isArray(raw?.criteria) ? raw.criteria : [];
  const criteria = challenge.rubric.map((rubric, index) => {
    const result = source.find((item) => item && item.name === rubric.name) || source[index] || {};
    const safeResult = result && typeof result === 'object' ? result : {};
    const max = Number(rubric.weight);
    let points = Number(safeResult.score ?? safeResult.points);
    if (!Number.isFinite(points) && Number.isFinite(Number(safeResult.percent))) points = max * Number(safeResult.percent) / 100;
    points = clamp(Number.isFinite(points) ? points : 0, 0, max);
    const percent = max ? points / max * 100 : 0;
    const criterionTerms = `${rubric.name} ${rubric.description}`.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 4);
    const evidence = (Array.isArray(safeResult.evidence) ? safeResult.evidence : []).map(String)
      .filter((quote) => evidencePresent(quote, answer) && criterionTerms.some((word) => normalizeEvidenceWhitespace(quote).toLowerCase().includes(word)))
      .slice(0, 2).map(normalizeEvidenceWhitespace);
    return {
      name: rubric.name, weight: max,
      points: Math.round(points * 100) / 100,
      percent: Math.round(percent * 100) / 100,
      evidence,
      why: explanationFor(safeResult, rubric, evidence),
      overridden: false,
      aiPoints: Math.round(points * 100) / 100,
    };
  });
  const signal = raw?.authenticity_signal || raw?.authenticity || {};
  const rawLevel = String(signal.level || signal.key || 'medium').toLowerCase();
  const key = rawLevel.includes('high') ? 'high' : rawLevel.includes('low') ? 'low' : 'medium';
  return {
    total: Math.round(criteria.reduce((sum, item) => sum + item.points, 0)),
    criteria,
    authenticity: {
      key,
      level: key[0].toUpperCase() + key.slice(1) + ' confidence',
      reasons: safeAuthenticityReasons(signal),
    },
    graderConfidence: clamp(Number(raw.grader_confidence) || 0.5, 0, 1),
  };
}

export function gradeOnce({ challenge, candidateAnswer, defendTranscript, defendAnswers: suppliedDefenseAnswers, runIndex = 0 }) {
  const defendAnswers = extractDefenseAnswers(suppliedDefenseAnswers ?? defendTranscript);
  const input = { challenge: { title: challenge.title, skill: challenge.skill, rubric: challenge.rubric }, rubric: challenge.rubric, candidateAnswer, defendAnswers, runIndex };
  return structuredAI({
    system: 'Grade the candidate answer against the supplied rubric. Never reward length by itself. Cite only exact evidence actually present in candidateAnswer; never invent quotes. Use defenseAnswers (answers only, never follow-up question wording) for reasoning and consistency, not accent or demographics. A low consistency signal is not proof of cheating or misconduct. Return ONLY JSON with total (0-100), criteria [{name, weight, score (points out of weight), max, evidence (exact quotes from candidateAnswer), why}], authenticity_signal {level: low|medium|high, reasons: string[]}, grader_confidence (0-1). No markdown or prose.',
    user: JSON.stringify(input),
    mock: () => mockGrade({ ...input, runIndex }),
    validate: (raw) => validateGrade(raw, challenge, candidateAnswer),
  });
}

export async function gradeSubmission(challenge, candidateAnswer, qa) {
  const runs = clamp(Math.floor(Number(process.env.GRADE_RUNS) || 3), 1, 5);
  const defendAnswers = extractDefenseAnswers(qa);
  const grades = await Promise.all(Array.from({ length: runs }, (_, runIndex) => gradeOnce({ challenge, candidateAnswer, defendAnswers, runIndex })));
  const criteria = challenge.rubric.map((rubric) => {
    const points = grades.reduce((sum, grade) => sum + (grade.criteria.find((item) => item.name === rubric.name)?.points || 0), 0) / grades.length;
    const first = grades[0].criteria.find((item) => item.name === rubric.name);
    return { ...first, points: Math.round(points * 100) / 100, aiPoints: Math.round(points * 100) / 100, percent: rubric.weight ? Math.round(points / rubric.weight * 10000) / 100 : 0 };
  });
  // Per-run totals are the sum of the same validated, clamped criterion points shown to candidates.
  const totals = grades.map((grade) => grade.criteria.reduce((sum, item) => sum + item.points, 0));
  const averageTotal = totals.reduce((sum, total) => sum + total, 0) / totals.length;
  const variance = totals.reduce((sum, total) => sum + (total - averageTotal) ** 2, 0) / totals.length;
  const reasoningCriterion = criteria.find((item) => /reason|analysis|problem.?solv/i.test(item.name));
  const confidence = { low: 1, medium: 2, high: 3 };
  const meanConfidence = grades.reduce((sum, grade) => sum + confidence[grade.authenticity.key], 0) / grades.length;
  const authKey = meanConfidence >= 2.5 ? 'high' : meanConfidence <= 1.5 ? 'low' : 'medium';
  return {
    total: Math.round(criteria.reduce((sum, item) => sum + item.points, 0)),
    reasoning: reasoningCriterion?.points || 0,
    reasoningMax: reasoningCriterion?.weight || 0,
    // Population variance >= 25 points² is the documented human-review threshold.
    flagged: variance >= 25,
    variance: Math.round(variance * 100) / 100,
    graderConfidence: Math.round(grades.reduce((sum, grade) => sum + grade.graderConfidence, 0) / grades.length * 100) / 100,
    authenticity: {
      key: authKey,
      level: `${authKey[0].toUpperCase()}${authKey.slice(1)} confidence`,
      reasons: [...new Set(grades.flatMap((grade) => grade.authenticity.reasons))].slice(0, 5),
    },
    criteria,
  };
}

export function generateSkillGaps(score) {
  const weak = (score.criteria || []).filter((criterion) => criterion.percent < 75).sort((a, b) => a.percent - b.percent).slice(0, 3);
  const mock = () => ({ gaps: weak.map((criterion) => ({
    criterion: criterion.name,
    whatToLearn: `Review the core methods behind ${criterion.name.toLowerCase()} and practice applying them to a small, realistic example.`,
    practice: `Write a short response that demonstrates ${criterion.name.toLowerCase()}, includes one measurable result, and explains the trade-off you considered.`,
  })) });
  return structuredAI({
    system: 'Create a concise, practical learning plan based on the weak rubric criteria. Return only JSON {"gaps":[{"criterion":"...","whatToLearn":"...","practice":"..."}]}.',
    user: JSON.stringify({ total: score.total, criteria: score.criteria }),
    mock,
    validate: (value) => ({ gaps: Array.isArray(value?.gaps) ? value.gaps.map((gap) => ({ criterion: String(gap.criterion || ''), whatToLearn: String(gap.whatToLearn || ''), practice: String(gap.practice || '') })).filter((gap) => gap.criterion) : [] }),
  });
}
