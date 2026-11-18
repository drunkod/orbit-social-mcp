import { Effect, Schema, Stream } from 'effect'
import { ChatEvent } from '@cafe/api/chat/event'


/**
 * Only used by the standalone local/Tailscale preview when Cloudflare credentials
 * are unavailable. The production CAFE WebSocket RPC backend is unchanged.
 */
export interface ChatRoomConnection {
  readonly ping: () => Effect.Effect<void, unknown>
  readonly events: () => Stream.Stream<ChatEvent, unknown>
}

export const connectPreviewRoom = (_baseUrl: string, key: string) =>
  Effect.succeed({
    ping: () => Effect.void,
    events: () => {
      const stream = new EventSource('/chats/' + encodeURIComponent(key) + '/events')
      return Stream.fromEventListener<MessageEvent>(stream, 'message').pipe(
        Stream.map(event => Schema.decodeUnknownSync(ChatEvent)(JSON.parse(event.data))),
        Stream.ensuring(Effect.sync(() => stream.close()))
      )
    }
  } satisfies ChatRoomConnection)
