import {
  LEGAL_DATE_V31,
  LEGAL_NOTICE_EN,
  REVIEW_LAWYER_EN,
  REVIEW_TECH_EN,
  type LegalDoc,
} from "./types";

/** Terms of Service (English version) – mirrors src/lib/legal/terms.ts. */
export const TERMS_DOC_EN: LegalDoc = {
  slug: "agb",
  title: "Terms of Service",
  version: "3.1",
  date: LEGAL_DATE_V31,
  notice: LEGAL_NOTICE_EN,
  intro:
    "These terms govern the use of the Y-Dude platform. They describe the platform's actual feature set. Points that still require legal clarification are explicitly marked.",
  sections: [
    {
      title: "1. Scope",
      paragraphs: [
        'These Terms of Service ("Terms") govern the use of the Y-Dude platform by registered and non-registered users.',
        'Y-Dude is a platform for creating, uploading, sharing and discovering user-generated content, in particular images and GIFs, short audio recordings ("SlangTags"), texts, comments, direct messages, as well as participation in the Slang Arena and the Slang Globe view.',
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
        "Y-Dude provides a platform on which users can publish their own content, discover content from others and offer or buy items in the integrated marketplace \u201cY-Dude Market\u201d. The core features are free of charge; individual additional features are paid (section 3a). The current feature set includes:",
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
        "Y-Dude Market: listings, price offers, purchase handling, payment, shipping or pickup (sections 3b to 3k)",
        "Paid additional features: promotion of listings in the Market and subscriptions with extended features",
      ],
    },
    {
      title: "3a. Free core use and paid additional features",
      paragraphs: [
        "Registration and the use of the core social features (profile, posts, SlangTags, feed, interactions, chats, Arena, Globe) are free of charge. There is no entitlement to permanently free use or to a specific feature set.",
        "The only features that currently cost money are: the time-limited promotion of listings in Y-Dude Market (section 3e) and subscriptions with extended features. These additional features are marked as paid and only take effect after a package has been selected and the payment process has been completed.",
        "Prices, durations and the scope of each package are shown during the payment process. These Terms do not set any prices.",
        `Consumer information, conclusion of contract, cancellation and right of withdrawal for these paid additional features: ${REVIEW_LAWYER_EN}`,
      ],
    },
    {
      title: "3b. Y-Dude Market – role of the platform",
      paragraphs: [
        "Y-Dude Market is a marketplace integrated into the platform. Users can publish their own items as listings there and buy items from other users.",
        "Y-Dude is not the seller of the items offered and does not become a party to the purchase contract. The purchase contract is concluded exclusively between the listing user (seller) and the purchasing user (buyer). Y-Dude provides the technical infrastructure for listing, search, contact, price offers, transaction handling and initiation of payment.",
        "Listings are not checked for accuracy, authenticity, condition, marketability or lawfulness before publication. All details about the item, price, condition, location, delivery type and shipping costs come from the seller.",
        "Performance of the purchase contract, defects, warranty, transfer of ownership, taxes and levies are the sole responsibility of seller and buyer.",
        `Legal classification of the intermediary role and liability privileges for brokered offers: ${REVIEW_LAWYER_EN}`,
      ],
    },
    {
      title: "3c. Seller details and seller profile",
      paragraphs: [
        "Each listing shows the seller's user profile and the details entered by the seller: title, description, images, price, willingness to negotiate, condition, delivery type as well as place and postal code area.",
        "Sellers can additionally create a seller profile and state there whether they sell privately, commercially or professionally, and add a company name, description, logo and website.",
        "Anyone selling commercially or professionally acts as a trader and must fulfil the statutory information obligations applicable to them (including identity, address, contact details, price information, warranty, right of withdrawal) themselves.",
        `A mandatory declaration of trader status, a visible label on the listing and a display of statutory trader details are currently not implemented technically (the seller type is a voluntary self-declaration in the seller profile): ${REVIEW_TECH_EN}`,
      ],
    },
    {
      title: "3d. Purchase handling, prices and payment in the Market",
      paragraphs: [
        "A purchase is processed as a transaction with its own reference number. The transaction records the item price, shipping costs, quantity, total amount, currency and the type of handover (shipping or pickup) in binding form.",
        "Prices are set by the seller. If an item is marked as negotiable, buyers can submit a price offer; if the seller accepts it, the agreed amount is recorded in the transaction.",
        "Payment is processed via the payment service provider Stripe. The buyer is guided into a payment process provided by Stripe. Payment method and card data are processed exclusively by Stripe; Y-Dude does not receive or store complete payment data (section 3f).",
        "A payment is only deemed made once Y-Dude receives a signature-verified confirmation from Stripe. Only then does the transaction change to the paid status, the item is marked as sold and shipping or pickup is released.",
        "As long as there is no confirmed payment, there is no claim to handover of the item.",
      ],
    },
    {
      title: "3e. Platform fee and promotion of listings",
      paragraphs: [
        "A platform fee may apply to transactions in the Market. It is calculated when the transaction is created from the stored fee settings (percentage share and/or fixed amount) and is shown separately in the transaction: platform fee, payment fee and the amount remaining for the seller.",
        "The amounts applicable in each case are shown in the transaction overview. These Terms do not set fee rates; the fee settings can be changed by the operator and apply to transactions created afterwards.",
        "Sellers can promote listings for a fee. Promotion packages have a fixed duration and a price shown during the payment process; the promotion only starts after confirmed payment and ends automatically when the duration expires.",
        "Promoted listings are ranked higher in lists and search results and are labelled \u201cFeatured\u201d. The number of promoted listings per result page is limited. The order of the remaining listings is based on search match, recency and distance.",
        `Payout of the seller's share as well as invoicing for platform fees and promotions are currently not implemented in an automated way: ${REVIEW_TECH_EN}`,
      ],
    },
    {
      title: "3f. Payment service provider and payment data",
      paragraphs: [
        "Payments for Market purchases, promotions and subscriptions are processed via Stripe. In this respect Stripe acts as an independent payment service provider and processes payment data under its own terms and privacy notices (available at stripe.com).",
        "The details required for the payment process are transmitted to Stripe: amount, currency, item designation, transaction reference, customer identifier and email address.",
        "For payments, Y-Dude only stores technical records: the provider's session and payment identifiers, amount, currency, payment status and time. Card numbers, account details or complete payment method data are neither collected nor stored by Y-Dude.",
        "Payment confirmations are processed exclusively via a signature-verified notification from Stripe; duplicate notifications have no effect.",
      ],
    },
    {
      title: "3g. Shipping, pickup and completion",
      paragraphs: [
        "For shipping, the buyer provides a delivery address. It is made available to the seller solely for performance of the purchase contract and must not be used for other purposes. The seller can enter a carrier and tracking number; shipping costs are set by the seller in the listing.",
        "For pickup, the buyer receives a single-use pickup code after confirmed payment. Place and time of handover are arranged by buyer and seller themselves.",
        "Shipping, delivery, confirmation of receipt and completion of the transaction are confirmed in the transaction view and logged. Completion serves traceability and does not replace statutory claims.",
        "Y-Dude does not owe transport and assumes no transport risk.",
      ],
    },
    {
      title: "3h. Right of withdrawal in the Market",
      paragraphs: [
        "If a user sells as a trader to a consumer, the consumer is generally entitled to a statutory right of withdrawal. The trading seller is obliged to inform about this and to provide the statutory withdrawal instructions including the model withdrawal form.",
        "For sales between private individuals there is no statutory right of withdrawal.",
        "For the operator's paid additional features (promotion, subscription), statutory consumer rights apply vis-\u00e0-vis the operator.",
        `Withdrawal instructions, model withdrawal form, notes on the early expiry of the right of withdrawal for digital services and the technical labelling of trading sellers are currently not implemented: ${REVIEW_LAWYER_EN}`,
      ],
    },
    {
      title: "3i. Reversal, refunds and disputes",
      paragraphs: [
        "As long as a payment has not been confirmed, the transaction can be cancelled; the listing is then released again.",
        "After confirmed payment, the buyer can request a refund in the transaction view and state a reason. Buyer and seller can likewise report a dispute with reasons.",
        "Refund requests and disputes are reviewed and decided by the operator; status and decision are logged in the transaction.",
        `The actual repayment of an approved amount is not triggered automatically by the platform but must be initiated via the payment service provider; deadlines and responsibilities for this: ${REVIEW_TECH_EN}`,
        "A decision by the operator on a refund request is an internal platform measure and does not replace statutory claims between buyer and seller.",
      ],
    },
    {
      title: "3j. Prohibited offers",
      paragraphs: [
        "Only items which the seller is entitled to dispose of and whose sale is legally permitted may be offered in the Market. In particular, the following are not permitted:",
      ],
      bullets: [
        "stolen, misappropriated items or items originating from criminal offences",
        "counterfeit goods and infringements of trade mark, copyright or personality rights",
        "weapons, ammunition, explosives, fireworks and items prohibited under weapons law",
        "narcotics, prescription medicines, doping agents and food supplements that are not marketable",
        "tobacco, alcohol and other age-restricted goods without a permissible age check",
        "live animals, protected species and products made from them",
        "human organs, blood, body parts and bodily fluids",
        "pornographic content, sexual services and media harmful to minors",
        "unconstitutional, extremist or hate-inciting items and symbols",
        "access credentials, user accounts, personal data records as well as software and media licences in breach of their terms",
        "official documents, identity papers, certificates, uniforms and service badges",
        "lock-picking tools, manipulation devices, surveillance devices and malware",
        "hazardous substances, chemicals and radioactive materials without the required permit",
        "financial products, means of payment, crypto assets and vouchers with a recognisable risk of fraud",
        "invented or non-existent items, misleading prices and listings that merely serve to circumvent platform fees",
        "medical, healing or efficacy claims without a permissible basis",
      ],
    },
    {
      title: "3k. Reporting problematic offers and measures",
      paragraphs: [
        "Problematic listings and sellers can be reported; the platform's reporting system provides dedicated report types for listings and sellers. Reports are reviewed; the result and any measure are logged.",
        `A reporting function directly in the listing and in the seller profile is not yet implemented; until then, reports should be sent to the contact address stated in the imprint: ${REVIEW_TECH_EN}`,
        "In the event of breaches of this section or of the community guidelines, listings can be removed or blocked, ongoing transactions can be halted and the user account can be suspended or deleted. Sections 9 to 11a apply accordingly.",
        "Where criminal offences are suspected, information may be passed on to the competent authorities.",
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
      title: "10. Reporting content (Art. 16 DSA)",
      paragraphs: [
        "Any user can report posts, SlangTags, comments, profiles, messages and Market listings through the reporting function. Reports can also be sent by e-mail to the contact address in the legal notice.",
        "Reports are confirmed, stored and reviewed. The reporting person is informed in the app about the outcome (removed, hidden, warning, account suspension or no action).",
        "Abusive or manifestly unfounded reporting is not permitted; the frequency of reports is technically limited. In case of repeated abuse the reporting function can be temporarily restricted.",
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
      title: "11a. Statement of reasons, appeal and complaint handling (Art. 17, 20 DSA)",
      paragraphs: [
        "For every measure against their own content or account, affected users receive a statement of reasons in the app. It names the type of measure, the affected content, the reason in plain language (e.g. rule violation, hate speech, harassment, spam, fraud, copyright, legal order) and whether the decision was automated or made manually.",
        'The personal moderation history is available at any time in the account under "Moderation".',
        "An appeal with the user's own reasoning can be lodged there within 180 days of any measure. Appeals are reviewed by a person, not solely automated. The outcome (measure upheld or overturned) is communicated with reasons in the app; if the appeal succeeds, the measure is reversed.",
        "Irrespective of this, users may turn to a certified out-of-court dispute settlement body under Art. 21 DSA or to a court. Decisions and appeals are stored for 730 days as evidence.",
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
        'The platform itself, its software, design, brands, logos and names (in particular "Y-Dude", "SlangTag", "Slang Arena", "Slang Globe") are protected. Use beyond the intended use of the platform is not permitted without consent.',
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
        "The core features of the platform are provided free of charge. Currently subject to a charge are the promotion of listings in Y-Dude Market and subscriptions with extended features; these contracts are concluded between the user and the operator and are billed via Stripe (sections 3a, 3e, 3f).",
        "Purchase contracts for items in Y-Dude Market are concluded exclusively between buyer and seller (section 3b). Consumer information including withdrawal instructions must be provided by the respective seller insofar as they act as a trader (sections 3c, 3h).",
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
