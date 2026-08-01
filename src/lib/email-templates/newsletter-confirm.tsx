import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

type Lang = "de" | "en" | "el";

interface Props {
  confirmUrl?: string;
  language?: Lang;
}

const COPY: Record<Lang, Record<string, string>> = {
  de: {
    preview: "Bitte bestätige deine E-Mail-Adresse für Y-Dude",
    heading: "Fast fertig!",
    intro:
      "Du möchtest benachrichtigt werden, wenn Y-Dude startet. Bestätige dazu bitte deine E-Mail-Adresse.",
    cta: "E-Mail bestätigen",
    ttl: "Der Link ist 24 Stunden gültig. Danach kannst du die Bestätigung erneut anfordern.",
    ignore:
      "Falls du dich nicht angemeldet hast, ignoriere diese E-Mail einfach — es wird nichts gespeichert.",
    fallback: "Falls der Button nicht funktioniert, öffne diesen Link:",
  },
  en: {
    preview: "Please confirm your email address for Y-Dude",
    heading: "Almost there!",
    intro:
      "You asked to be notified when Y-Dude launches. Please confirm your email address to finish.",
    cta: "Confirm email",
    ttl: "The link is valid for 24 hours. After that you can request a new confirmation.",
    ignore: "If you didn't sign up, simply ignore this email — nothing will be stored.",
    fallback: "If the button doesn't work, open this link:",
  },
  el: {
    preview: "Επιβεβαίωσε τη διεύθυνση email σου για το Y-Dude",
    heading: "Σχεδόν έτοιμο!",
    intro: "Ζήτησες να ενημερωθείς όταν ξεκινήσει το Y-Dude. Επιβεβαίωσε τη διεύθυνση email σου.",
    cta: "Επιβεβαίωση email",
    ttl: "Ο σύνδεσμος ισχύει για 24 ώρες. Μετά μπορείς να ζητήσεις νέα επιβεβαίωση.",
    ignore: "Αν δεν έκανες εγγραφή, αγνόησε αυτό το email — δεν αποθηκεύεται τίποτα.",
    fallback: "Αν το κουμπί δεν λειτουργεί, άνοιξε αυτόν τον σύνδεσμο:",
  },
};

const NewsletterConfirmEmail = ({ confirmUrl, language }: Props) => {
  const t = COPY[language && COPY[language] ? language : "de"];
  const url = confirmUrl || "https://y-dude.com/newsletter/confirm";

  return (
    <Html lang={language || "de"} dir="ltr">
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>Y-DUDE</Text>
          <Heading style={heading}>{t.heading}</Heading>
          <Text style={text}>{t.intro}</Text>
          <Section style={{ margin: "28px 0" }}>
            <Button href={url} style={button}>
              {t.cta}
            </Button>
          </Section>
          <Text style={muted}>{t.ttl}</Text>
          <Hr style={hr} />
          <Text style={muted}>{t.fallback}</Text>
          <Text style={{ ...muted, wordBreak: "break-all" }}>
            <Link href={url} style={link}>
              {url}
            </Link>
          </Text>
          <Text style={muted}>{t.ignore}</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: NewsletterConfirmEmail,
  subject: (data: Record<string, unknown>) => {
    const candidate = data?.language as Lang | undefined;
    const lang: Lang = candidate && COPY[candidate] ? candidate : "de";
    return {
      de: "Bitte bestätige deine E-Mail-Adresse – Y-Dude",
      en: "Please confirm your email address – Y-Dude",
      el: "Επιβεβαίωσε το email σου – Y-Dude",
    }[lang];
  },
  displayName: "Newsletter Double-Opt-in",
  previewData: {
    confirmUrl: "https://y-dude.com/newsletter/confirm?token=demo-token",
    language: "de",
  },
} satisfies TemplateEntry;

const main = {
  backgroundColor: "#ffffff",
  fontFamily: "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
};
const container = { padding: "32px 28px", maxWidth: "560px" };
const brand = {
  fontSize: "13px",
  letterSpacing: "3px",
  color: "#16a34a",
  fontWeight: 700 as const,
  margin: "0 0 16px",
};
const heading = { fontSize: "24px", color: "#0f172a", margin: "0 0 12px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#1f2937", margin: "0 0 8px" };
const muted = { fontSize: "13px", lineHeight: "20px", color: "#6b7280", margin: "0 0 8px" };
const button = {
  backgroundColor: "#16a34a",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600 as const,
  padding: "12px 22px",
  borderRadius: "10px",
  textDecoration: "none",
};
const hr = { borderColor: "#e5e7eb", margin: "24px 0" };
const link = { color: "#16a34a" };
