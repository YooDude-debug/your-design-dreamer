import { LEGAL_DATE_V31, LEGAL_NOTICE_EN, REVIEW_TECH_EN, type LegalDoc } from "./types";

/**
 * Privacy policy (English version) – describes the data flow actually
 * implemented in the code. Mirrors src/lib/legal/privacy.ts section by section.
 */
export const PRIVACY_DOC_EN: LegalDoc = {
  slug: "datenschutz",
  title: "Privacy Policy",
  version: "3.1",
  date: LEGAL_DATE_V31,
  notice: LEGAL_NOTICE_EN,
  intro:
    "This privacy policy describes the data flow actually implemented on the Y-Dude platform. Statements about legal bases, exact retention periods, data processing agreements, third-country transfers and the need for a data protection impact assessment are explicitly marked as pending review.",
  sections: [
    {
      title: "1. Data controller",
      paragraphs: [
        "The controller responsible for processing personal data within the meaning of the General Data Protection Regulation (GDPR) is the operator of the Y-Dude platform named in the legal notice: Y-Dude UG i.G., Wuhlestraße 7a, 12683 Berlin, Deutschland, Tidymagic@gmail.com.",
        `Appointment of a data protection officer: ${REVIEW_TECH_EN}`,
      ],
    },
    {
      title: "2. General information and legal bases",
      paragraphs: [
        "We process personal data exclusively in accordance with applicable data protection law, in particular the GDPR.",
        `The assignment of individual processing activities to the legal bases under Art. 6 GDPR (performance of a contract, legitimate interest, consent, legal obligation) is still to be finally determined: ${REVIEW_TECH_EN}`,
      ],
    },
    {
      title: "3. Registration and authentication",
      paragraphs: [
        "For a user account we process the data provided during registration. Authentication is carried out via the authentication service of our backend provider (Supabase).",
        "In particular, the following is processed:",
      ],
      bullets: [
        "Username",
        "Email address",
        "Password (stored exclusively as a cryptographic hash, never in plain text)",
        "Date of birth (verification of the minimum age of 16, stored in the profile)",
        "Confirmation and session information (email confirmation, login session, password reset token)",
        "Timestamps of registration, last activity and presence status (online, busy, offline)",
      ],
    },
    {
      title: "4. Profile data",
      paragraphs: [
        "Additional information can voluntarily be added to the profile. Visibility (public, connections only, private) can be set for each of these fields. The following may be processed:",
      ],
      bullets: [
        "Display name, bio, pronouns, real name (optional, can be hidden)",
        "Profile and cover picture",
        "Location/region, origin, languages, travel plans",
        "Interests, hobbies, favourite music, movies, games, sports",
        "Linked external profiles (website, Instagram, TikTok, YouTube, Twitch, Discord)",
        "Level and experience points, visibility and display settings",
      ],
    },
    {
      title: "5. Posts, media and SlangTags",
      paragraphs: [
        "Users can create content. It is stored and displayed within the platform according to the chosen visibility. This includes:",
      ],
      bullets: [
        "Posts with title, description, region, hashtags",
        "Images and GIFs as well as their placement data on the post image",
        "SlangTags: short audio recordings with name, meaning, example sentences, region and language",
        "Comments and replies",
        "Counters for likes, comments, shares, views and saves",
      ],
    },
    {
      title: "5a. Unprocessed original media",
      paragraphs: [
        "When an image is uploaded for a post, in addition to the optimised display version, we also store the unprocessed original file in the platform's protected media storage.",
        "The purpose is traceability for reports and moderation decisions as well as regenerating the display versions.",
        "Access is technically restricted: users can access their own files, and beyond that only the platform's administration and moderation. When a post or account is deleted, the original files are deleted as well.",
      ],
    },
    {
      title: "6. Interactions: likes, votes, plays, saves, sharing",
      paragraphs: [
        "Interactions are stored with a reference to the account so that counters are kept correct, duplicate ratings are prevented and users can undo their own interactions. The following is recorded:",
      ],
      bullets: [
        "Likes on posts, comments and SlangTags",
        "Ratings (up/down) on SlangTags",
        "Plays of SlangTags and arena entries",
        "Saving, sharing and views of posts",
        "Connections (requests, acceptance, rejection) and follower relationships",
      ],
    },
    {
      title: "6a. Visibility of interactions",
      paragraphs: [
        "Who liked a post is only visible to the extent the post is visible to the requesting person and the people concerned have not set their likes to private. In the Slang Arena, votes, likes and plays are limited to the user's own interaction as well as the creator or the commissioning company and moderation.",
      ],
    },
    {
      title: "7. Chats and messages",
      paragraphs: [
        "Direct messages and chat SlangTags are stored on the platform's servers so they can be retrieved by the participating users. Access is technically limited to the members of the respective conversation.",
        "Messages are not end-to-end encrypted. Transmission is encrypted (HTTPS); technical access by the platform operator cannot be ruled out, for example in the case of reports or for security reasons.",
        "Content, sender, conversation, timestamp as well as delivery and read timestamps are stored.",
      ],
    },
    {
      title: "8. Location data and location lookup (reverse geocoding)",
      paragraphs: [
        "Location information in profiles and posts is voluntary and can be entered manually.",
        "If automatic location detection is used, the browser asks for location permission. Only after explicit consent are the coordinates transmitted to BigDataCloud to obtain a place name. Information such as city, region and country is returned.",
        "Only the resulting place name is stored – not the exact coordinates. The visibility of the location can be set in the profile (public, connections only, private).",
      ],
    },
    {
      title: "8a. Y-Dude Market: listings, offers and transactions",
      paragraphs: [
        "Anyone publishing a listing makes the entered details public: title, description, images, price, willingness to negotiate, condition, category, delivery type as well as place and postal code area. These details are visible to signed-in users.",
        "For a purchase, a transaction is stored containing the reference number, the identifiers of seller and buyer, the item, quantity, item price, shipping costs, platform fee, payment fee, seller share, total amount, currency, handover type as well as transaction, payment and shipping status with timestamps.",
        "In addition, price offers, transaction-related messages, an event log (e.g. payment started, payment confirmed, shipped, completed), refund requests with a reason and disputes with reasons are stored. For pickup, a single-use pickup code is generated.",
        "Purposes: initiation and performance of the purchase contract concluded between buyer and seller, handling and traceability of the transaction, processing of refunds and disputes as well as abuse prevention. Legal bases: contract or pre-contractual measures and legitimate interest.",
        "Seller and buyer each see the data of their shared transaction as well as the username and display name of the other party. Y-Dude is not the seller of the items; the role of the platform is described in the Terms.",
        `Retention periods for transaction and payment records due to commercial and tax law obligations: ${REVIEW_TECH_EN}`,
      ],
    },
    {
      title: "8b. Shipping data in the Market",
      paragraphs: [
        "If shipping is selected, the buyer provides a delivery address (name and address). It is assigned to the respective transaction and shown to the seller solely for performance of the purchase contract.",
        "In addition, the shipping method, carrier, tracking number, shipping costs as well as dispatch and delivery times may be stored.",
        "The delivery address is not used for advertising and is not transmitted to third parties that are not involved in the handling.",
      ],
    },
    {
      title: "8c. Market search, saved searches and statistics",
      paragraphs: [
        "Search terms and filters in the Market can, on explicit request, be stored as a saved search in the account and deleted there again.",
        "To operate the marketplace, events relating to listings are recorded, in particular views, favourites, contact requests and offers. Purposes: statistics for the respective seller, ordering of results and detection of abuse. Legal basis: legitimate interest.",
        "The seller statistics displayed only contain aggregated figures.",
        "Sellers can voluntarily publish a seller profile stating the seller type (private, commercial, professional) and optionally a company name, description, logo and website.",
      ],
    },
    {
      title: "9. Automated AI moderation",
      paragraphs: [
        "For platform safety, uploaded content is checked automatically. The check runs via a server-side queue as soon as content is created or modified.",
        "In particular, content is checked for: unlawful content, hate, violence and threats, sexual and content harmful to minors, harassment, spam, fraud and other violations of the community guidelines.",
        "The result can lead to content being approved, held back for review or blocked. This decision is initially made automatically.",
        "Held-back and reported content can additionally be reviewed manually by moderation and the decision can be changed. Decisions are logged so they remain traceable.",
        `Classification as an automated decision in an individual case within the meaning of Art. 22 GDPR: ${REVIEW_TECH_EN}`,
      ],
    },
    {
      title: "9a. Transmission to external AI services",
      paragraphs: [
        "For automated moderation, content is transmitted to external AI services (OpenAI and/or Google). The following may be transmitted:",
      ],
      bullets: [
        "Title, description and text of a post or comment",
        "the uploaded image of a post",
        "the audio recording of a SlangTag as well as its automatically generated text version (transcript)",
        "information about the content type required for the check",
      ],
    },
    {
      title: "9b. Personal data in checked content",
      paragraphs: [
        "Since content may contain personal information (e.g. images of people, voice recordings or texts referring to names), such information may be part of the transmitted content.",
        "Transcripts of SlangTags are stored to enable moderation, spam detection, search and accessibility.",
      ],
    },
    {
      title: "10. Reporting system and moderation logs",
      paragraphs: [
        "Any user can report content. Reported content is stored and reviewed. This involves processing: the reported content, the reporting person, the timestamp, the processing status, the reviewing person and the decision including a note.",
        "Moderation logs are also kept: automated moderation results, status changes to SlangTags, warnings and bans as well as administrative interventions (admin log).",
        "To prevent abuse, a technical rate limit applies to reports.",
      ],
    },
    {
      title: "11. Technical logs and server logs",
      paragraphs: [
        "Operating the platform generates technical data, in particular IP address, browser type, operating system, device type, time of access, request paths and error logs. They serve operation, security and error analysis.",
        "The application itself logs: moderation decisions, administrative interventions, security-relevant account processes (e.g. export and deletion requests, failed confirmations) as well as interaction and feed signals for personalisation.",
        `Retention period of platform and network logs at the providers used (Lovable, Supabase, Cloudflare): ${REVIEW_TECH_EN}`,
      ],
    },
    {
      title: "12. Profiling and feed delivery",
      paragraphs: [
        "The order of content in the feed is calculated based on the user's own usage. Signals such as views, dwell time, likes, comments, shares, connections, followed accounts and interest scores are processed for this purpose and held in caches.",
        "Personalisation (profiling) takes place. It serves to sort content and select displayed advertising.",
        `Legal basis and assessment of profiling as well as the necessity of a data protection impact assessment: ${REVIEW_TECH_EN}`,
      ],
    },
    {
      title: "12a. Advertising",
      paragraphs: [
        "Advertising content (image and video ads, sponsored SlangTags) can be mixed into the feed. Selection may be based on stored interest scores and advertising settings. Ad display can be disabled in the profile or settings, to the extent the respective feature allows this.",
        "Aggregated metrics are collected for advertising content (impressions, clicks, reach). Personal data is not passed on to advertisers for their own use.",
      ],
    },
    {
      title: "12b. Objecting to personalisation",
      paragraphs: [
        "At the bottom of this page the stored personalisation can be reset. This removes the signals and interest scores of the own account stored for personalisation.",
      ],
    },
    {
      title: "13. Push notifications",
      paragraphs: [
        "If a user enables notifications, the browser creates a push registration with the push service of the respective browser or platform provider. This registration consists of a delivery address provided by the provider and the associated keys.",
        "We store this registration together with information about the browser used in order to deliver notifications. Delivery addresses are technically limited to the push services of browser and operating system manufacturers.",
        "The registration is deleted when notifications are disabled, delivery permanently fails, or the account is deleted.",
      ],
    },
    {
      title: "14. Email communication and double opt-in",
      paragraphs: [
        "As part of using the service, we send emails relating to registration, email confirmation, password reset, security notices as well as material changes to the terms of use or this policy.",
        'The launch notification ("Notify Me") is voluntary and uses a double opt-in procedure: after entering the email address, a confirmation email with a single-use, time-limited confirmation link is sent. Without confirmation, no further emails are sent.',
        "Email address, language, status, time of consent as well as confirmation and dispatch timestamps are stored. Consent can be withdrawn at any time with effect for the future.",
      ],
    },
    {
      title: "15. Cookies and client-side storage",
      paragraphs: [
        "Y-Dude uses technically necessary cookies and browser storage. In practice, the following is used:",
      ],
      bullets: [
        "LocalStorage for the login session (access and refresh tokens for authentication)",
        "LocalStorage for display and usage settings, e.g. language, feed settings and notices already seen",
        "LocalStorage caches for already loaded content as well as the existing SlangTag cache for audio data, so it does not need to be transmitted again",
        "SessionStorage for short-lived states within a session",
        "a browser push registration, if notifications have been enabled",
        "cookies and verification mechanisms of Cloudflare as part of bot protection",
      ],
    },
    {
      title: "15a. Analytics and marketing cookies",
      paragraphs: [
        "Third-party analytics or marketing cookies are not currently used. Should this change, they will only be used in accordance with legal requirements and this policy will be updated accordingly.",
      ],
    },
    {
      title: "16. Cloudflare Turnstile",
      paragraphs: [
        "Cloudflare Turnstile is used to protect the registration, login, password reset and Notify Me forms.",
        "This loads a verification script from Cloudflare in the browser. In particular, the IP address, information about the browser and usage behaviour during the check, as well as the generated verification token, are technically processed.",
        "The verification token is subsequently validated server-side against Cloudflare. Without a successful server-side check, the respective action is not carried out.",
      ],
    },
    {
      title: "17. Services used (technical overview)",
      paragraphs: ["The following external services are technically used to operate the platform:"],
      bullets: [
        "Lovable – hosting, delivery and operation of the application as well as sending system and confirmation emails",
        "Supabase – database, authentication and storage of media files",
        "Cloudflare – network delivery and bot/abuse protection (Turnstile)",
        "OpenAI and Google – automated moderation of text, images and audio",
        "BigDataCloud – conversion of coordinates into place names for location selection",
        "Stripe – processing of payments for Market purchases, promotion of listings and subscriptions",
        "Push services of browser and operating system manufacturers – delivery of notifications",
      ],
    },
    {
      title: "17a. Data processing and third-country transfers",
      paragraphs: [
        "Some of the services mentioned may process data outside the European Union.",
        `Conclusion and content of data processing agreements, server locations, standard contractual clauses, adequacy decisions and additional safeguards: ${REVIEW_TECH_EN}`,
      ],
    },
    {
      title: "17b. Payment processing via Stripe",
      paragraphs: [
        "Payments for Market purchases, for the promotion of listings and for subscriptions are processed via the payment service provider Stripe.",
        "The details required for the payment process are transmitted to Stripe: amount, currency, designation of the item or package, transaction reference, user identifier and the email address used to create or match a payment customer record at Stripe.",
        "Payment method, card and account data are collected and processed exclusively by Stripe. Y-Dude only stores technical records: the provider's session and payment identifiers, amount, currency, payment status, environment (test or production), time and the identifiers of received provider notifications in order to prevent duplicate processing.",
        "For subscriptions, the subscription status, term data and the identifier of the booked package are additionally stored.",
        "In this respect Stripe processes payment data on its own responsibility. Information on processing by Stripe, including transfers to third countries, is described in Stripe's privacy notices (stripe.com).",
        "Legal basis: performance of the respective contract.",
        `Allocation of roles with the payment service provider (processor or own controllership) and additional safeguards: ${REVIEW_TECH_EN}`,
      ],
    },
    {
      title: "18. Public interfaces and automated processes",
      paragraphs: [
        "The platform operates technical endpoints for recurring tasks (moderation runs, push delivery, counter reconciliation, test operations, deletion runs). These endpoints can only be called with a server-side secret; calls without authorisation are rejected.",
        "Personal data is not publicly exposed via these endpoints.",
      ],
    },
    {
      title: "19. Retention and deletion (schedule)",
      paragraphs: [
        "Personal data is only stored for as long as necessary for the respective purpose or as required by law. Automated deletion runs clean up technical logs, signals and caches every day.",
        "The following standard periods apply, counted from creation of the record:",
      ],
      bullets: [
        "Security events for export and account deletion: 180 days.",
        "Moderation logs and SlangTag moderation history: 365 days.",
        "Reasoned moderation decisions and appeals: 730 days (appeal and evidence phase).",
        "Reports about content and profiles including the decision: 730 days.",
        "Administrative actions (admin log): 1,095 days.",
        "Queued moderation jobs: 90 days after completion.",
        "Feed signals: 90 days; interaction events: 180 days; computed feed scores: 30 days.",
        "Notifications in the inbox: 180 days; push delivery queue: 30 days.",
        "Machine translations: messages 180 days, posts 365 days.",
        "Metrics of the internal advertising test mode: 90 days.",
        "Technical operating events: 90 days; aggregated incidents: 365 days.",
        "Image variant queue: 30 days; counter buffer: 7 days.",
        "Market: listing views, favourites and contacts 400 days; saved searches 365 days; identifiers of processed payment events 180 days.",
        "Market delivery address and shipment data: anonymised after 1,095 days; the transaction itself is retained as an accounting record without the address.",
        "Market transactions and payment records: no automatic deletion – statutory retention obligation under § 147 AO and § 257 HGB (up to 10 years).",
      ],
    },
    {
      title: "20. Backups",
      paragraphs: [
        "Database and storage backups are created and managed by the platform providers used. Deleted data may therefore still be contained in backup copies for the duration of a backup cycle before it is finally removed.",
        `Retention period, storage location and access rights for backups: ${REVIEW_TECH_EN}`,
      ],
    },
    {
      title: "21. Account deletion",
      paragraphs: [
        "The account can be completely deleted in the settings. Deletion requires confirmation with the user's own password and is protected by a limit on attempts.",
        "This deletes, in particular, the profile, posts, media including original files, SlangTags, comments, interactions, connections, messages, notifications, push registrations, personalisation data, Market favourites, saved searches, the seller profile and the login account itself. The browser session is then terminated and local storage is cleared.",
        "Market listings without purchase history are deleted. Listings for which a purchase was concluded are retained as an accounting record; title, description, images and location data are removed and the listing is permanently taken out of the Market.",
        "Records of Market transactions and payments are not deleted together with the account because statutory retention obligations apply (§ 147 AO, § 257 HGB – up to 10 years). Security and moderation logs are kept only for the periods listed above for abuse prevention and accountability.",
      ],
    },

    {
      title: "22. Data export (data portability)",
      paragraphs: [
        "An export of your own data can be requested in the settings. The export requires confirmation with your own password, is rate-limited, and contains exclusively data of your own account in a machine-readable format.",
        "Export and deletion requests are logged to be able to detect abuse.",
      ],
    },
    {
      title: "23. Rights of data subjects",
      paragraphs: ["You have the right to:"],
      bullets: [
        "Access",
        "Rectification",
        "Erasure",
        "Restriction of processing",
        "Data portability",
        "Object to processing",
        "Withdraw consent given",
        "Lodge a complaint with a data protection supervisory authority",
      ],
    },
    {
      title: "23a. Requests",
      paragraphs: [
        "Requests can be sent to the contact address given in the legal notice: Tidymagic@gmail.com. Access, export and deletion are also directly available in the account settings.",
        `Competent supervisory authority: ${REVIEW_TECH_EN}`,
      ],
    },
    {
      title: "24. Data security",
      paragraphs: [
        "We use technical and organisational measures to protect personal data. Among others, the following are implemented:",
      ],
      bullets: [
        "Encrypted transmission (HTTPS)",
        "Passwords stored exclusively as hashes",
        "Access restrictions at database level per account (row level security)",
        "Server-side validation of all write operations and form protection",
        "Authorisation of internal task endpoints with server secrets",
        "Restriction of push delivery addresses to known push services",
        "Rate limiting of security-relevant processes (e.g. reports, export, deletion)",
        "Logging of administrative and security-relevant processes",
      ],
    },
    {
      title: "25. Minimum age",
      paragraphs: [
        "Y-Dude can only be used from the age of 16. During registration, the date of birth is requested and checked server-side; below the minimum age, registration cannot be technically completed.",
        "Verification using identity documents does not take place.",
      ],
    },
    {
      title: "26. Changes to this privacy policy",
      paragraphs: [
        "We reserve the right to adapt this privacy policy where this becomes necessary due to technical, legal or organisational changes.",
        "The current version is always available on the platform; version and date are stated at the beginning of this document.",
      ],
    },
  ],
};
