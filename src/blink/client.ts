import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: 'connectify-messaging-web-app-sl7pma15',
  authRequired: false // Allow guest access
})