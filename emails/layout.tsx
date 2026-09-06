import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

/** Penpal tokens from apps/web/src/index.css — keep email chrome on the same palette. */
const canvas = "#faf8f5";
const ink = "#2a2318";
const muted = "#5a4d3a";
const faint = "#8a7e6e";
const rule = "#d4c8b0";
const amber = "#eab308";
const onAmber = "#1a1a1a";
const header = "#2a2318";

const markSrc = "https://hotly.com/apple-touch-icon.png";
const wordmarkSrc = "https://hotly.com/images/new-logo.png";
const hotlyHome = "https://hotly.com";

interface HotlyLayoutProps {
  preview: string;
  heading: string;
  actionUrl: string;
  actionLabel: string;
  children: ReactNode;
}

export function HotlyLayout({ preview, heading, actionUrl, actionLabel, children }: HotlyLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: canvas, margin: 0, padding: "32px 12px", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <Container style={{ maxWidth: "520px", margin: "0 auto" }}>
          <Section style={{ backgroundColor: header, borderRadius: "16px 16px 0 0", padding: "28px 32px", textAlign: "center" }}>
            <Img src={markSrc} width="40" height="40" alt="" style={{ display: "inline-block", borderRadius: "8px", verticalAlign: "middle" }} />
            <Img
              src={wordmarkSrc}
              width="120"
              height="53"
              alt="Hotly"
              style={{ display: "inline-block", verticalAlign: "middle", marginLeft: "12px" }}
            />
          </Section>
          <Section style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "0 0 16px 16px", border: `1px solid ${rule}`, borderTop: "none" }}>
            <Text style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "24px", lineHeight: "1.3", color: ink, margin: "0 0 16px" }}>
              {heading}
            </Text>
            {children}
            <Section style={{ textAlign: "center", margin: "28px 0 8px" }}>
              <Button
                href={actionUrl}
                style={{
                  backgroundColor: amber,
                  color: onAmber,
                  fontWeight: 600,
                  fontSize: "16px",
                  lineHeight: "1",
                  padding: "16px 28px",
                  borderRadius: "16px",
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                {actionLabel}
              </Button>
            </Section>
            <Text style={{ fontSize: "13px", lineHeight: "1.5", color: faint, margin: "16px 0 0", wordBreak: "break-all" }}>
              Or paste this link:{" "}
              <Link href={actionUrl} style={{ color: muted }}>
                {actionUrl}
              </Link>
            </Text>
            <Hr style={{ borderColor: rule, margin: "28px 0 16px" }} />
            <Text style={{ fontSize: "13px", lineHeight: "1.5", color: faint, margin: 0, textAlign: "center" }}>
              <Link href={hotlyHome} style={{ color: muted, fontWeight: 600, textDecoration: "none" }}>
                Powered by Hotly
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const bodyText = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: muted,
  margin: "0 0 12px",
};
