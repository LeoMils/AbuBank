/*
 * Communication channel-adapter registry.
 * ────────────────────────────────────────
 * The capability and the chat UI look up adapters by channel here. Built-in
 * adapters self-register on import; new channels (SMS/Email/Telegram) register
 * the same way with NO change to the cognitive controller.
 */
import type { ChannelAdapter, CommunicationChannel } from './types'

const ADAPTERS = new Map<CommunicationChannel, ChannelAdapter>()

export function registerAdapter(adapter: ChannelAdapter): void {
  ADAPTERS.set(adapter.channel, adapter)
}

export function getAdapter(channel: CommunicationChannel): ChannelAdapter | null {
  return ADAPTERS.get(channel) ?? null
}

export function listAdapters(): ChannelAdapter[] {
  return [...ADAPTERS.values()]
}

// Register the built-in adapters. WhatsApp + phone are the first two; add
// SMS/Email/Telegram the same way without touching any caller.
import { whatsappAdapter } from '../../AbuWhatsApp/whatsappAdapter'
import { phoneAdapter } from '../../AbuWhatsApp/phoneAdapter'
registerAdapter(whatsappAdapter)
registerAdapter(phoneAdapter)
