import { LEGAL_DATE, LEGAL_NOTICE_EN, REVIEW_LAWYER_EN, type LegalDoc } from "./types";

/** Terms of Service (English version) – mirrors src/lib/legal/terms.ts. */
export const TERMS_DOC_EN: LegalDoc = {
  slug: "agb",
  title: "Terms of Service",
  version: "3.0",
  date: LEGAL_DATE,
  notice: LEGAL_NOTICE_EN,
  intro:
    "These terms govern the use of the Y-Dude platform. They describe the platform's actual feature set. Points that still require legal clarification are explicitly marked.",
  sections: [
    {
      title: "1. Scope",
      paragraphs: [
        "These Terms of Service (\"Terms\") govern the use of the Y-Dude platform by registered and non-registered users.",
        "Y-Dude is a platform for creating, uploading, sharing and discovering user-generated content, in particular images and GIFs, short audio recordings (\"SlangTags\"), texts, comments, direct messages, as well as participation in the Slang Arena and the Slang Globe view.",
        "By registering or using the platform, the user accepts these Terms.",
      ],
    },
    {
      title: "2. Operator",
      paragraphs: [
        "The platform is operated by the person named in the legal notice. Until a company is founded, operation is carried out by the operator named in the legal notice.",
      ],
    },
    {
      title: "3. Description of services",
      paragraphs: [
        "Y-Dude provides a free platform on which users can publish their own content and discover content from others. The current feature set includes:",
      ],
      bullets: [
        "A user account with a profile and adjustable visibility of individual profile fields",
        "Posts with image/GIF, description, hashtags and up to five placeable SlangTags",
        "SlangTags: short audio recordings with meaning, examples, region and language",
        "A feed with local, global, trending and followed views",
        "Likes, comments, saving, sharing, connections and followers",
        "Direct messages (chats) including chat SlangTags",
        "Slang Arena (community voting on briefs) and Slang Globe (map view)",
        "Reporting of content as well as automated and manual moderation",
        "Optional push notifications",
      ],
    },
    {
      title: "3a. Free of charge use",
      paragraphs: [
        "Use of the features described is currently free of charge. There is no entitlement to permanently free use or to a specific feature set.",
        `Should paid features be offered in the future, separate terms and consumer information will be required: ${REVIEW_LAWYER_EN}`,
      ],
    },
    {
      title: "4. Minimum age (16 years)",
      paragraphs: [
        "Y-Dude may only be used from the age of 16.",
        "The date of birth must be provided during registration. It is checked server-side; if the age is under 16, registration cannot be completed.",
        "Anyone who provides an incorrect date of birth during registration is in breach of these Terms; the account may be suspended and deleted.",
      ],
    },
    {
      title: "5. Registration and user account",
      paragraphs: ["A user account is required for most features. The user undertakes to"],
      bullets: [
        "provide truthful information, in particular regarding the date of birth,",
        "keep their login credentials confidential and not pass them on,",
        "not create another account to circumvent a suspension,",
        "use only email addresses belonging to themselves,",
        "not operate automated accounts (bots) without the operator's express permission.",
      ],
    },
    {
      title: "5a. Refusal of registrations",
      paragraphs: [
        `The operator may refuse registrations, in particular in the event of breaches of these Terms or indications of abuse: ${REVIEW_LAWYER_EN}`,
      ],
    },
    {
      title: "6. User content",
      paragraphs: [
        "Users can upload images, GIFs, audio recordings, texts, comments, SlangTags and messages. By uploading content, the user confirms that",
      ],
      bullets: [
        "they hold all rights required for the content,",
        "no rights of third parties are infringed (in particular copyright, trademark, personality and data protection rights),",
        "any depicted or audible persons have given their consent where required,",
        "the content does not violate the law or the community guidelines.",
      ],
    },
    {
      title: "6a. Responsibility for content",
      paragraphs: [
        "The user remains responsible for their content. The community guidelines are part of these Terms and bindingly describe which content and behaviour are impermissible.",
      ],
    },
    {
      title: "7. Audio uploads and SlangTags",
      paragraphs: [
        "SlangTags are short audio recordings that can be linked to and placed on a post image. The technical framework (in particular length and number per post) is specified by the platform.",
        "Only recordings for which the user holds all necessary rights may be uploaded. Uploading copyrighted music without authorisation is prohibited.",
        "SlangTags may not be used to disguise prohibited content, circumvent moderation, insult or threaten others, spread private data, carry unlawful content, unlawfully reuse third-party protected content, or manipulate arena and ranking systems.",
      ],
    },
    {
      title: "8. Chats",
      paragraphs: [
        "Direct messages are intended for communication between users. They are not end-to-end encrypted; further details are set out in the privacy policy.",
        "The rules on impermissible content also apply in chats. Reported messages may be reviewed.",
      ],
    },
    {
      title: "9. Moderation",
      paragraphs: [
        "Content can be reviewed automatically (also with the help of external AI services) and manually. In particular, images, audio recordings including transcripts, texts, profile information and comments are reviewed.",
        "The result of the review may be approval, provisional hold, or blocking of content. There is no entitlement to automatic approval or to a specific review duration.",
        "Automated decisions can be reviewed and corrected by moderation. Affected users can contact the operator via the contact address given in the legal notice.",
      ],
    },
    {
      title: "10. Reporting content",
      paragraphs: [
        "Any user can report posts, SlangTags, comments, profiles and messages. Reports are stored and reviewed.",
        "Abusive reporting is not permitted; the frequency of reports is technically limited.",
        `Additional requirements for reporting and complaint procedures (including the Digital Services Act): ${REVIEW_LAWYER_EN}`,
      ],
    },
    {
      title: "11. Measures in case of violations",
      paragraphs: [
        "In the event of violations of these Terms, the community guidelines or the law, the operator may – graded according to severity – in particular:",
      ],
      bullets: [
        "hide, restrict or delete content,",
        "hold content back for review,",
        "issue warnings,",
        "restrict features,",
        "temporarily or permanently suspend the account,",
        "delete the account.",
      ],
    },
    {
      title: "11a. Information and objection",
      paragraphs: [
        "Affected users are informed within the app about material measures relating to their content and can object via the contact address given in the legal notice.",
        `Scope of statement-of-reasons and information obligations as well as deadlines: ${REVIEW_LAWYER_EN}`,
      ],
    },
    {
      title: "12. Rights to user content",
      paragraphs: [
        "The user retains all rights to their content.",
        "By uploading content, the user grants the operator a simple, non-exclusive, non-transferable and free-of-charge licence to use the content exclusively to operate the platform, in particular to store it, technically process it (e.g. format conversion and thumbnails), moderate it, and display it to users authorised under the visibility settings.",
        "Use of the content for the operator's own advertising or passing it on to third parties for their own purposes does not take place.",
        "The licence ends upon deletion of the content or account; excluded are technically caused backup copies for the duration of the backup cycle and moderation logs for traceability.",
        "If a user voluntarily participates in a brief in the Slang Arena, the participation terms displayed there of the commissioning company additionally apply to the submitted entry. A transfer of rights only takes place to the extent expressly described there and accepted by the user.",
      ],
    },
    {
      title: "13. Operator's rights to the platform",
      paragraphs: [
        "The platform itself, its software, design, brands, logos and names (in particular \"Y-Dude\", \"SlangTag\", \"Slang Arena\", \"Slang Globe\") are protected. Use beyond the intended use of the platform is not permitted without consent.",
      ],
    },
    {
      title: "14. Availability, beta phase and changes to the platform",
      paragraphs: [
        "The platform is in a beta phase. Features may be incomplete, errors may occur and data from the testing phase may be removed.",
        "The operator may further develop, change or discontinue features to the extent reasonable for the user. Registered users will be informed about material changes.",
        "There is no entitlement to permanent availability; maintenance and disruptions are possible.",
      ],
    },
    {
      title: "15. Termination of use",
      paragraphs: [
        "The user can stop using the service at any time and completely delete their account in the settings. Deletion requires confirmation with the user's own password and removes profile, content, media, interactions, messages and the login account.",
        "An export of one's own data can be requested prior to deletion.",
        `Operator's termination rights, deadlines and requirements for termination notices: ${REVIEW_LAWYER_EN}`,
      ],
    },
    {
      title: "16. Liability",
      paragraphs: [
        "Users are solely responsible for content they upload. The operator is not obliged to generally monitor content prior to publication; the automated review used does not replace complete control.",
        `Scope, limitation and indemnification of liability as well as liability for data loss: ${REVIEW_LAWYER_EN}`,
      ],
    },
    {
      title: "17. Consumer information",
      paragraphs: [
        "The platform is currently provided free of charge and without entering into a paid contract.",
        `Required consumer information including right of withdrawal, dispute resolution and consumer arbitration body: ${REVIEW_LAWYER_EN}`,
      ],
    },
    {
      title: "18. Changes to these Terms",
      paragraphs: [
        "The operator may change these Terms to the extent necessary and reasonable for the user. Registered users will be informed about material changes.",
        `Procedure, deadlines and consent requirements for changes: ${REVIEW_LAWYER_EN}`,
      ],
    },
    {
      title: "19. Final provisions",
      paragraphs: [
        "Should any provision of these Terms be or become invalid, the remaining provisions shall remain unaffected.",
        `Applicable law and place of jurisdiction: ${REVIEW_LAWYER_EN}`,
      ],
    },
  ],
};
