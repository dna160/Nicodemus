import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'nicodemus-web',
  eventKey: process.env.INNGEST_EVENT_KEY,
});
