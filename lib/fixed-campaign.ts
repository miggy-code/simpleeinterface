export const FIXED_CAMPAIGN_SUBJECT =
  "Practical AI use cases for {{company_name}}";

export const FIXED_CAMPAIGN_BODY = `Hi {{first_name}},

I came across your linkedin profile and saw you're leading {{title}} at {{company_name}} in the {{industry}} space.

I'm the founder of Throttl AI, and I also operate as a fractional COO across a few mid-sized businesses where I'm actively teaching/implementing AI into day-to-day operations, primarily focused on driving pipeline, reducing headcount needs, and improving execution speed.

I've been spending a lot of time in the weeds on what's actually working vs. what's just noise, and I thought it could be useful to share a few practical use cases that may apply to your team.

If helpful, I'm happy to walk you through a couple of tools and frameworks we're using, along with an "AI CEO toolkit" that I have developed which could be helpful to you.

Would you be open to a quick 20-minute conversation sometime next week?

Best,
Gabriel`;

export const FIXED_CAMPAIGN_EMAILS = [
  {
    subject: FIXED_CAMPAIGN_SUBJECT,
    body: FIXED_CAMPAIGN_BODY,
  },
  {
    subject: "Following up on {{company_name}}",
    body: `Hi {{first_name}},

Just wanted to bump this to the top of your inbox.

If it makes sense, I’m happy to send a few practical ideas for {{company_name}}.`,
  },
  {
    subject: "Checking back in on {{company_name}}",
    body: `Hi {{first_name}},

Circling back one last time in case this got buried.

If timing is better later, I’m happy to reconnect then.`,
  },
];
