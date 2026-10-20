# Sub-processor List

**Last updated:** October 20, 2026
**Version:** 1.1

This list forms Annex 3 of the Preb Data Processing Agreement (DPA). It names every company that processes Customer Data and Results (the contact data our Customers upload and enrich) on behalf of Kranz & Gupta, Indiepal GbR ("Preb"). Providers that process only account, billing, support or website data, such as Stripe, Resend, Google sign-in, Featurebase and Termly, are not sub-processors for Customer Data and are described in our Privacy Policy instead.

Each sub-processor is bound by a written data processing agreement that imposes obligations equivalent to those Preb accepts in the DPA.

## How enrichment works

When you enrich a contact, Preb sends the details you provide, such as a name, a company or a LinkedIn profile URL, to FullEnrich, our enrichment sub-processor. FullEnrich queries a waterfall of specialised data providers one after another until one of them finds a result, and separate verification providers check the deliverability of every email address found. Preb then shows you the result, with a verification level for each email address.

The data providers in this waterfall are listed under Tier 2 below, as published by FullEnrich. FullEnrich does not report which provider produced an individual result, so we cannot name the source of a specific email address or phone number.

## How we tell you about changes

We give Owners and Admins at least 30 days notice by email before we add or replace a sub-processor, unless a provider gives us less notice, in which case we pass on the notice we receive without delay. You may object within 14 days under Section 6 of the DPA. To receive these notices at an additional address, email hello@preb.co.

## Tier 1: sub-processors engaged directly by Preb

| Sub-processor | Entity and location | Activity | Data processed | Where the data is stored | Transfer mechanism |
|---|---|---|---|---|---|
| Supabase | Supabase, Inc., USA | Database, authentication, file storage, live updates | All Customer Data and Results, uploaded files | USA (AWS region us-east-1) | EU Standard Contractual Clauses (2021/914) in the Supabase data processing addendum |
| Vercel | Vercel Inc., USA | Application hosting, serverless functions, scheduled jobs, request logs | All data passing through the application while it is processed | USA | EU-US Data Privacy Framework, supplemented by Standard Contractual Clauses |
| FullEnrich | FullEnrich Corp, San Francisco, USA | Finding and verifying work emails, personal emails, phone numbers and public professional profile data; identifying people from an email address | Contact names, company names and domains, LinkedIn profile URLs, email addresses, and the Results returned; technical reference IDs | European Union (DigitalOcean) | EU Standard Contractual Clauses (2021/914) incorporated in the FullEnrich data processing agreement, Preb as data exporter. FullEnrich keeps results for 3 months, then deletes them |

## Tier 2: sub-processors engaged by our sub-processors

Our sub-processors use their own providers. We list the ones that can come into contact with Customer Data, as published by each sub-processor on the date above. The live lists are maintained by the sub-processors at the links given.

**Engaged by FullEnrich: data providers in our enrichment waterfall** (list published at fullenrich.com/sub-processor, last updated by FullEnrich on August 2, 2026):

These providers find and verify contact data inside the FullEnrich waterfall. FullEnrich engages them under its own data processing agreements. Under Article 28(4) GDPR, FullEnrich must bind each of them to data protection obligations equivalent to its own, and under Chapter V GDPR it must safeguard transfers to the providers located in the USA.

| Provider | Entity and location | Activity | Data processed | Where the data is stored |
|---|---|---|---|---|
| DigitalOcean | DigitalOcean, LLC, USA | Cloud hosting for FullEnrich | Data processed through FullEnrich | European Union |
| Enrow | Enrow, EU | Finding email addresses | Names, company names, LinkedIn URLs, email addresses | European Union |
| Icypeas | Icypeas, EU | Finding email addresses | Names, company names, LinkedIn URLs, email addresses | European Union |
| Datagma | Datagma, EU | Finding phone numbers and enriching profiles | Names, company names, LinkedIn URLs, phone numbers | European Union |
| BounceBan | BounceBan, USA | Checking email deliverability | Email addresses | USA |
| EmailListVerify | CyberPanda, EU | Checking email deliverability | Email addresses | European Union |
| ListMint | ListMint, USA | Checking email deliverability | Email addresses | USA |

**Engaged by Supabase** (list published at supabase.com/legal/subprocessors):

| Provider | Entity and location | Activity | Where the data is stored |
|---|---|---|---|
| Amazon Web Services | Amazon Web Services, Inc., USA | Cloud infrastructure for the database, storage and authentication | USA (us-east-1) |
| Cloudflare | Cloudflare, Inc., USA | Network edge, traffic routing and protection | USA and global edge |

**Engaged by Vercel** (list published at vercel.com/legal/subprocessors):

| Provider | Entity and location | Activity | Where the data is stored |
|---|---|---|---|
| Amazon Web Services | Amazon Web Services, Inc., USA | Cloud infrastructure for hosting and functions | USA |

## Change log

| Date | Change |
|---|---|
| October 20, 2026 | Explained how enrichment works and which providers take part in the FullEnrich waterfall. No sub-processor added, removed or replaced |
| October 13, 2026 | First version |

## Contact

Questions about this list: hello@preb.co. Kranz & Gupta, Indiepal GbR, Brunnenstr. 11, 53123 Bonn, Germany.
