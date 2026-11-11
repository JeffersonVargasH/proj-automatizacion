export const channels = ['Instagram', 'Facebook', 'WhatsApp'] as const;
export type PublishingChannel = typeof channels[number];
export type ScheduledPostStatus = 'pending_connection' | 'cancelled' | 'published' | 'error';
export type ScheduledPost = {
  id: string;
  ownerId: string;
  designId: string;
  channel: PublishingChannel;
  at: string;
  caption: string;
  status: ScheduledPostStatus;
  createdAt: string;
  updatedAt: string;
};
