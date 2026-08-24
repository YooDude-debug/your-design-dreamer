import { LEGAL_DATE, LEGAL_NOTICE_EN, type LegalDoc } from "./types";

/** Community/usage guidelines (English version) – mirrors src/lib/legal/guidelines.ts. */
export const GUIDELINES_DOC_EN: LegalDoc = {
  slug: "richtlinien",
  title: "Community and Usage Guidelines",
  version: "1.0",
  date: LEGAL_DATE,
  notice: LEGAL_NOTICE_EN,
  intro:
    "Y-Dude thrives on voices, slang and regions. These guidelines explain in plain language what is and isn't allowed on Y-Dude. They apply to posts, images and GIFs, SlangTags, comments, profiles, chats and the Slang Arena. They are part of the Terms of Service.",
  sections: [
    {
      title: "1. Basic rule",
      paragraphs: [
        "Treat others the way you want to be treated. Slang can be cheeky, loud and regional – but no one may be hurt, threatened or humiliated because of it.",
        "The rules apply to everything you post on Y-Dude: text, image, GIF, audio, profile information and messages.",
      ],
    },
    {
      title: "2. Prohibited content",
      paragraphs: ["Not permitted:"],
      bullets: [
        "Unlawful content of any kind",
        "Depictions or glorification of violence and calls for criminal acts",
        "Threats against persons or groups",
        "Hate and degradation based on origin, skin colour, religion, disability, gender, sexual orientation or age",
        "Extremist and terrorist content, symbols or propaganda",
        "Pornographic and sexualised content",
        "Any depiction of minors in a sexualised context – such content is removed, the account is suspended and the case is reported to the responsible authorities",
        "Intimate footage without the consent of the person depicted",
        "Self-harm or suicide presented as a request, instruction or glorification",
      ],
    },
    {
      title: "2a. Crisis notice",
      paragraphs: [
        "If you're not doing well, please reach out to professional help in your area. Y-Dude is not a crisis service.",
      ],
    },
    {
      title: "3. Interacting with each other",
      paragraphs: ["Not permitted:"],
      bullets: [
        "Harassment, bullying, stalking and targeted repeated posting at someone",
        "Insults and degrading labels directed at individuals",
        "Doxxing: publishing other people's private data, such as address, phone number, workplace, ID or account details",
        "Forwarding private chats or voice messages without consent",
        "Calls to jointly attack or report others",
      ],
    },
    {
      title: "4. Identity and authenticity",
      paragraphs: ["Not permitted:"],
      bullets: [
        "Impersonating another person, brand or authority",
        "Profiles that imitate real people and thereby deceive",
        "Providing a false date of birth to bypass the minimum age of 16",
        "Accounts recreated after a suspension",
      ],
    },
    {
      title: "5. Fraud, spam and technical abuse",
      paragraphs: ["Not permitted:"],
      bullets: [
        "Fraud, fraudulent offers, pyramid schemes, fake giveaways",
        "Phishing and requesting login credentials",
        "Links to malware or manipulated files",
        "Spam: mass identical or meaningless posts, comments, messages or SlangTags",
        "Undisclosed covert advertising",
        "Bots, scripts or automated access without the operator's permission",
        "Attacks on the platform, circumventing security or rate-limiting mechanisms, accessing other accounts' data",
      ],
    },
    {
      title: "6. Third-party content and copyright",
      paragraphs: [
        "Only post what belongs to you or for which you have permission. This applies especially to music, film clips, photos, graphics and recordings of other people's voices.",
        "If people can be seen or heard, you need their consent.",
        "For copyright complaints, you can contact the address given in the legal notice; affected content may be removed.",
      ],
    },
    {
      title: "7. Special rules for SlangTags",
      paragraphs: [
        "SlangTags are the heart of Y-Dude: short audio recordings placed on an image. That's exactly why they aren't a \"loophole\". A SlangTag may not be used to",
      ],
      bullets: [
        "hide or disguise prohibited content,",
        "circumvent moderation (e.g. saying prohibited statements only as audio),",
        "deliberately insult, threaten or ridicule others,",
        "share other people's private data,",
        "carry unlawful content,",
        "reuse copyrighted music or other recordings without permission,",
        "manipulate arena, ranking or trending systems.",
      ],
    },
    {
      title: "7a. Audio is reviewed too",
      paragraphs: [
        "SlangTags are reviewed automatically. For this purpose, the recording may be converted to text and assessed together with it. A SlangTag whose content violates these guidelines will be removed – regardless of how harmless the accompanying image looks.",
      ],
    },
    {
      title: "8. Fair voting in the Slang Arena",
      paragraphs: ["Not permitted:"],
      bullets: [
        "Multiple accounts to vote or like more than once",
        "Collusion, vote buying or vote trading",
        "Automated votes, likes or plays",
        "Artificially inflating plays, views or shares",
        "Calls to specifically vote against certain submissions in order to harm them",
      ],
    },
    {
      title: "8a. Consequences of manipulation",
      paragraphs: [
        "Manipulated votes and reach can be removed, submissions can be excluded, and accounts can be suspended.",
      ],
    },
    {
      title: "9. Rules in chats",
      paragraphs: [
        "Private messages are not a lawless space. Threats, harassment, unwanted sexual content and attempted fraud are prohibited there too.",
        "Chats are not end-to-end encrypted. Reported messages can be reviewed by moderation.",
      ],
    },
    {
      title: "10. How moderation works",
      paragraphs: [
        "New content is reviewed automatically. Suspicious content can be held back and additionally reviewed by humans.",
        "Anyone can report content using the reporting feature. Abusive reports are themselves a violation.",
        "Depending on severity, consequences include: a notice, removal of content, a warning, restriction of features, temporary suspension, or permanent suspension and deletion of the account.",
      ],
    },
    {
      title: "11. If you disagree",
      paragraphs: [
        "If content was removed or your account was restricted and you believe this was wrong, contact us via the address given in the legal notice. Decisions will then be reviewed again.",
      ],
    },
    {
      title: "12. Changes to these guidelines",
      paragraphs: [
        "These guidelines will continue to evolve as new features are introduced or new forms of abuse emerge. The version and date are stated at the beginning of this document.",
      ],
    },
  ],
};
