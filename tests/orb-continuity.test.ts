/**
 * ORB Core – Kontinuität: Tests der reinen Logik (ohne Datenbank, ohne Netz).
 * Grundsatz jedes Tests: VERGESSEN ≠ LÖSCHEN.
 */
import { describe, expect, it } from "vitest";
import {
  CONTINUITY_SCOPE,
  SILENCE_IS_VALID,
  THREAD_PAUSE_AFTER_MS,
  THREAD_CURIOSITY_MIN,
  THREAD_RESUME_COOLDOWN_MS,
  certaintyOf,
  continuityStateShift,
  decayThread,
  decideHandling,
  detectContradictions,
  memoryStrength,
  observeStyle,
  pauseThread,
  phrasingFor,
  polarityOf,
  reactivateThread,
  resolveThread,
  shouldResumeThread,
  styleHint,
  styleTraits,
  threadDraftFrom,
  threadKnowledgeGaps,
  threadRelevance,
  threadStatusAfter,
  EMPTY_STYLE,
  type ThoughtThread,
} from "@/lib/orb-continuity";

const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;

function thread(over: Partial<ThoughtThread> = {}): ThoughtThread {
  return {
    id: "t1",
    title: "Grafikkarte",
    topic: "hardware",
    status: "OPEN",
    known: ["Ich baue mir einen neuen Rechner mit einer stärkeren Grafikkarte"],
    unknown: ["ORB weiss den Grund nicht"],
    curiosity: 0.6,
    importance: 0.6,
    lastActivationAt: NOW,
    activationCount: 1,
    resolvedAt: null,
    nodeIds: ["n1"],
    ...over,
  };
}

describe("Gedankenfäden – Entstehung", () => {
  it("1 erzeugt einen Faden mit Titel, Bekanntem und benennbarer Lücke", () => {
    const draft = threadDraftFrom({
      content: "Ich überlege, meinen Rechner mit einer neuen Grafikkarte aufzurüsten",
      topic: "hardware",
      importance: 0.6,
    });
    expect(draft).not.toBeNull();
    expect(draft!.known[0]).toContain("Grafikkarte");
    expect(draft!.unknown.length).toBeGreaterThan(0);
  });

  it("2 erzeugt keinen Faden aus leerem Inhalt", () => {
    expect(threadDraftFrom({ content: "   ", topic: null, importance: 0.9 })).toBeNull();
  });

  it("3 begrenzt Neugier eines Fadens auf 0..1", () => {
    const d = threadDraftFrom({
      content: "Neues Thema Projekt Kamera",
      topic: null,
      importance: 1,
    })!;
    expect(d.curiosity).toBeGreaterThan(0);
    expect(d.curiosity).toBeLessThanOrEqual(1);
  });
});

describe("Gedankenfäden – Verfall ohne Löschung", () => {
  it("4 senkt Neugier über Zeit, aber nie unter die Untergrenze", () => {
    const d = decayThread(thread({ lastActivationAt: NOW - 500 * HOUR }), NOW);
    expect(d.curiosity).toBeLessThan(0.6);
    expect(d.curiosity).toBeGreaterThanOrEqual(THREAD_CURIOSITY_MIN);
  });

  it("5 lässt Bekanntes und Herkunft beim Pausieren unverändert", () => {
    const t = thread();
    const paused = pauseThread(t, NOW + 10 * HOUR);
    expect(paused.status).toBe("PAUSED");
    expect(paused.known).toEqual(t.known);
    expect(paused.nodeIds).toEqual(t.nodeIds);
  });

  it("6 pausiert einen unberührten Faden allein durch Zeitablauf", () => {
    expect(threadStatusAfter(thread(), NOW + THREAD_PAUSE_AFTER_MS + 1)).toBe("PAUSED");
  });

  it("7 lässt einen gelösten Faden gelöst", () => {
    expect(threadStatusAfter(thread({ status: "RESOLVED" }), NOW + 1000 * HOUR)).toBe("RESOLVED");
  });
});

describe("Gedankenfäden – Reaktivierung", () => {
  it("8 verstärkt statt neu anzulegen", () => {
    const t = thread({ status: "PAUSED", lastActivationAt: NOW - 20 * HOUR });
    const r = reactivateThread(t, { now: NOW, known: "Ich habe jetzt 700 Euro Budget" });
    expect(r.id).toBe(t.id);
    expect(r.status).toBe("REACTIVATED");
    expect(r.activationCount).toBe(t.activationCount + 1);
    expect(r.known.length).toBe(t.known.length + 1);
  });

  it("9 setzt einen aktiven Faden auf ACTIVE", () => {
    expect(reactivateThread(thread({ status: "OPEN" }), { now: NOW }).status).toBe("ACTIVE");
  });

  it("10 fügt gleiche Information nicht doppelt hinzu", () => {
    const t = thread();
    const r = reactivateThread(t, { now: NOW, known: t.known[0] });
    expect(r.known).toEqual(t.known);
  });
});

describe("Gedankenfäden – Klärung", () => {
  it("11 hält Verlauf und Herkunft nach der Klärung fest", () => {
    const r = resolveThread(thread(), { now: NOW, answer: "Ich will in 4K spielen" });
    expect(r.status).toBe("RESOLVED");
    expect(r.resolvedAt).toBe(NOW);
    expect(r.known.some((k) => k.includes("4K"))).toBe(true);
    expect(r.nodeIds).toEqual(["n1"]);
  });

  it("12 löscht niemals bekannte Inhalte", () => {
    const t = thread({ known: ["a", "b"] });
    expect(resolveThread(t, { now: NOW }).known).toEqual(["a", "b"]);
  });
});

describe("Gedankenfäden – Relevanz und Wiederaufnahme", () => {
  it("13 bewertet thematisch passende Fäden höher", () => {
    const passend = threadRelevance(thread(), { conversationTopics: ["hardware"], now: NOW });
    const fremd = threadRelevance(thread(), { conversationTopics: ["kochen"], now: NOW });
    expect(passend).toBeGreaterThan(fremd);
  });

  it("14 nimmt einen irrelevanten Faden nicht wieder auf", () => {
    const v = shouldResumeThread({
      thread: thread(),
      relevance: 0.05,
      curiosity: 0.9,
      lastResumeAt: null,
      now: NOW,
    });
    expect(v.resume).toBe(false);
    expect(v.reason.length).toBeGreaterThan(0);
  });

  it("15 blockiert Wiederaufnahme im Cooldown", () => {
    const v = shouldResumeThread({
      thread: thread(),
      relevance: 0.9,
      curiosity: 0.9,
      lastResumeAt: NOW - THREAD_RESUME_COOLDOWN_MS / 2,
      now: NOW,
    });
    expect(v.resume).toBe(false);
  });

  it("16 nimmt einen relevanten Faden ausserhalb des Cooldowns auf", () => {
    const v = shouldResumeThread({
      thread: thread(),
      relevance: 0.9,
      curiosity: 0.8,
      lastResumeAt: NOW - 2 * THREAD_RESUME_COOLDOWN_MS,
      now: NOW,
    });
    expect(v.resume).toBe(true);
  });

  it("17 erzeugt aus offenen Fäden Wissenslücken, aus gelösten nicht", () => {
    const offen = threadKnowledgeGaps([thread()], { curiosity: 0.8, now: NOW });
    const geloest = threadKnowledgeGaps([thread({ status: "RESOLVED" })], {
      curiosity: 0.8,
      now: NOW,
    });
    expect(offen.length).toBe(1);
    expect(offen[0].reason).toContain("Gedankenfaden");
    expect(geloest.length).toBe(0);
  });
});

describe("Sprachliche Sicherheit", () => {
  it("18 stuft eine starke, frische Erinnerung als sicher ein", () => {
    const s = memoryStrength({
      weight: 0.9,
      confidence: 0.95,
      activationCount: 4,
      lastAccessedAt: NOW,
      now: NOW,
    });
    expect(certaintyOf(s)).toBe("sicher");
  });

  it("19 stuft eine schwache alte Erinnerung als vage ein", () => {
    const s = memoryStrength({
      weight: 0.1,
      confidence: 0.4,
      activationCount: 1,
      lastAccessedAt: NOW - 2000 * HOUR,
      now: NOW,
    });
    expect(certaintyOf(s)).toBe("vage");
  });

  it("20 liefert zur Stufe eine passende Formulierungsvorgabe", () => {
    const p = phrasingFor({
      content: "Du magst Pizza",
      weight: 0.2,
      confidence: 0.5,
      activationCount: 1,
      lastAccessedAt: NOW - 800 * HOUR,
      now: NOW,
    });
    expect(p.hint.length).toBeGreaterThan(0);
    expect(["sicher", "wahrscheinlich", "vage"]).toContain(p.certainty);
  });
});

describe("Gesprächsstil", () => {
  it("21 gilt erst nach mehreren Nachrichten als Muster", () => {
    let p = EMPTY_STYLE;
    p = observeStyle(p, "hey, was geht?");
    expect(styleTraits(p).established).toBe(false);
    expect(styleHint(p)).toBeNull();
  });

  it("22 erkennt wiederkehrenden Stil nach genügend Belegen", () => {
    let p = EMPTY_STYLE;
    for (let i = 0; i < 6; i += 1) p = observeStyle(p, "hey, kurz gefragt, passt das?");
    const t = styleTraits(p);
    expect(t.established).toBe(true);
    expect(t.messages).toBe(6);
    expect(styleHint(p)).not.toBeNull();
  });

  it("23 bleibt bei gemischtem Stil unbestimmt", () => {
    let p = EMPTY_STYLE;
    for (let i = 0; i < 3; i += 1) p = observeStyle(p, "hey alter, passt");
    for (let i = 0; i < 3; i += 1)
      p = observeStyle(p, "Sehr geehrte Damen und Herren, hiermit teile ich Ihnen mit");
    expect(styleTraits(p).tone).toBe("unbestimmt");
  });
});

describe("Widersprüche", () => {
  it("24 erkennt Haltung positiv und negativ", () => {
    expect(polarityOf("Ich mag Pizza")).toBe("positiv");
    expect(polarityOf("Ich mag keine Pizza")).toBe("negativ");
    expect(polarityOf("Pizza besteht aus Teig")).toBe("neutral");
  });

  it("25 benennt eine Spannung ohne etwas aufzulösen", () => {
    const c = detectContradictions("Ich mag keine Pizza mehr", [
      { id: "n1", content: "Ich mag Pizza sehr gern", topic: "essen" },
    ]);
    expect(c.length).toBe(1);
    expect(c[0].nodeId).toBe("n1");
    expect(c[0].memory).toBe("Ich mag Pizza sehr gern");
    expect(c[0].gap.length).toBeGreaterThan(0);
  });

  it("26 meldet keinen Widerspruch bei gleicher Haltung", () => {
    expect(
      detectContradictions("Ich mag Pizza", [
        { id: "n1", content: "Ich mag Pizza gern", topic: "essen" },
      ]),
    ).toEqual([]);
  });

  it("27 meldet keinen Widerspruch bei fremdem Thema", () => {
    expect(
      detectContradictions("Ich mag keine Grafikkarten von der Marke", [
        { id: "n1", content: "Ich mag Pizza gern", topic: "essen" },
      ]),
    ).toEqual([]);
  });
});

describe("Umgang mit neuer Information", () => {
  const base = {
    importance: 0.6,
    curiosity: 0.7,
    hasGap: true,
    cooldownActive: false,
    openQuestion: false,
  };

  it("28 ignoriert unwichtige Information, ohne sie zu löschen", () => {
    const d = decideHandling({ ...base, importance: 0.05, hasGap: false });
    expect(d.handling).toBe("IGNORE");
  });

  it("29 merkt sich Information ohne Lücke nur", () => {
    expect(decideHandling({ ...base, hasGap: false }).handling).toBe("STORE_ONLY");
  });

  it("30 wartet, solange eine eigene Frage offen ist", () => {
    expect(decideHandling({ ...base, openQuestion: true }).handling).toBe("WAIT");
  });

  it("31 wartet im Cooldown", () => {
    expect(decideHandling({ ...base, cooldownActive: true }).handling).toBe("WAIT");
  });

  it("32 fragt nur bei genügender Neugier", () => {
    expect(decideHandling({ ...base, curiosity: 0.1 }).handling).toBe("STORE_ONLY");
    expect(decideHandling(base).handling).toBe("ASK");
  });

  it("33 nennt zu jeder Entscheidung einen Grund", () => {
    expect(decideHandling(base).reason.length).toBeGreaterThan(0);
  });
});

describe("Zustand und Geltungsbereich", () => {
  it("34 verschiebt den Zustand nur mit benanntem Auslöser", () => {
    const leer = continuityStateShift({
      newThread: false,
      reactivatedThread: false,
      resolvedThread: false,
      contradictions: 0,
    });
    expect(leer.curiosity).toBe(0);
    expect(leer.uncertainty).toBe(0);

    const shift = continuityStateShift({
      newThread: true,
      reactivatedThread: false,
      resolvedThread: false,
      contradictions: 1,
    });
    expect(shift.curiosity).toBeGreaterThan(0);
    expect(shift.uncertainty).toBeGreaterThan(0);
    expect(shift.reason.length).toBeGreaterThan(0);
  });

  it("35 senkt Unsicherheit bei geklärtem Faden", () => {
    const shift = continuityStateShift({
      newThread: false,
      reactivatedThread: false,
      resolvedThread: true,
      contradictions: 0,
    });
    expect(shift.uncertainty).toBeLessThanOrEqual(0);
  });

  it("36 bleibt auf den ORB-Core-Chat begrenzt und erlaubt Schweigen", () => {
    expect(CONTINUITY_SCOPE).toBe("orb_core_chat_only");
    expect(SILENCE_IS_VALID).toBe(true);
  });
});
