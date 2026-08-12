import type { ComponentType } from "react";
import { template as newsletterConfirmTemplate } from "./newsletter-confirm";
import { template as betaLaunchTemplate } from "./beta-launch";


export interface TemplateEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- templates declare their own prop shapes
  component: ComponentType<any>;
  subject: string | ((data: Record<string, unknown>) => string);
  displayName?: string;
  previewData?: Record<string, unknown>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  "newsletter-confirm": newsletterConfirmTemplate,
};
