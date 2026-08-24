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
import { BETA_LAUNCH_COPY, type Lang } from "./beta-launch-copy";

interface Props {
  registerUrl?: string;
  language?: Lang;
}

/** Startmail zur offenen Beta. Enthaelt keine personenbezogenen Daten ausser der Anrede-freien Ansprache. */
export const BetaLaunchEmail = ({ registerUrl, language }: Props) => {
  const t = BETA_LAUNCH_COPY[language && BETA_LAUNCH_COPY[language] ? language : "de"];
  const url = registerUrl || "https://y-dude.com/auth?mode=register";

  return (
    <Html lang={language || "de"} dir="ltr">
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>Y-DUDE</Text>
          <Heading style={heading}>{t.heading}</Heading>
          <Text style={text}>{t.intro}</Text>
          <Text style={text}>{t.concept}</Text>
          <Section style={{ margin: "28px 0" }}>
            <Button href={url} style={button}>
              {t.cta}
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={muted}>{t.fallback}</Text>
          <Text style={{ ...muted, wordBreak: "break-all" }}>
            <Link href={url} style={link}>
              {url}
            </Link>
          </Text>
          <Text style={muted}>{t.note}</Text>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: "#ffffff",
  fontFamily: "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
};
const container = { padding: "32px 28px", maxWidth: "560px" };
const brand = {
  fontSize: "13px",
  letterSpacing: "3px",
  fontWeight: 700,
  color: "#0f9d58",
  margin: "0 0 18px",
};
const heading = { fontSize: "24px", lineHeight: "32px", color: "#111827", margin: "0 0 12px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#374151", margin: "0 0 12px" };
const muted = { fontSize: "12px", lineHeight: "20px", color: "#6b7280", margin: "0 0 8px" };
const button = {
  backgroundColor: "#0f9d58",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 700,
  padding: "13px 22px",
  borderRadius: "999px",
  textDecoration: "none",
};
const link = { color: "#0f9d58" };
const hr = { borderColor: "#e5e7eb", margin: "24px 0" };
