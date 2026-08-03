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
import { COPY, type Lang } from "./newsletter-confirm-copy";

interface Props {
  confirmUrl?: string;
  language?: Lang;
}

export const NewsletterConfirmEmail = ({ confirmUrl, language }: Props) => {
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

export default NewsletterConfirmEmail;
