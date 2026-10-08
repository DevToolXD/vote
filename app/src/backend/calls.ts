import { child, onChildAdded, onValue, push, ref, remove, runTransaction, serverTimestamp, set, update, type Unsubscribe } from 'firebase/database'
import type { Firestore } from 'firebase/firestore'
import { R } from './messages'

// 음성 통화 (1:1 chats): WebRTC audio straight between the two phones; the Realtime
// Database only carries the setup:
//   calls/{chatId}  { from, to, state: 'ring' | 'live' | 'end', at, offer, answer?, reason?,
//                     ice: { {uid}: { push id: candidate JSON } } }
//   callIn/{uid}    { chatId, from, at }   "someone is calling you" (the worker also pushes it)
// No relay (TURN) server: on some network pairs (mostly two different mobile carriers)
// the audio can't connect, and the call ends with "연결하지 못했어요".

export type CallPhase = 'calling' | 'ringing' | 'connecting' | 'live' | 'ended'
export type EndReason = 'hangup' | 'declined' | 'missed' | 'failed' | 'busy' | 'taken' | 'mic'
export type Incoming = { chatId: string; from: string; at: number }

const ICE: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }]
const RING_MS = 40_000

type Handlers = { onPhase: (p: CallPhase) => void; onEnd: (reason: EndReason, talkedMs: number) => void }

export class CallSession {
  private pc: RTCPeerConnection | null = null
  private stream: MediaStream | null = null
  private audio: HTMLAudioElement
  private stops: Unsubscribe[] = []
  private timers: ReturnType<typeof setTimeout>[] = []
  private pending: RTCIceCandidateInit[] = []
  private remoteSet = false
  private liveAt = 0
  private done = false
  muted = false

  constructor(private db: Firestore, private me: string, readonly chatId: string, readonly peer: string, readonly role: 'caller' | 'callee', private h: Handlers) {
    // Created during the tap that starts / answers the call, so phones let it play.
    this.audio = new Audio()
    this.audio.autoplay = true
    ;(this.audio as HTMLAudioElement & { playsInline: boolean }).playsInline = true
    this.audio.play().catch(() => {})
  }

  private get node() { return ref(R(this.db), `calls/${this.chatId}`) }

  private async setup() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    } catch {
      throw new Error('mic')
    }
    const pc = new RTCPeerConnection({ iceServers: ICE })
    this.pc = pc
    this.stream.getTracks().forEach(t => pc.addTrack(t, this.stream!))
    pc.ontrack = e => { this.audio.srcObject = e.streams[0]; this.audio.play().catch(() => {}) }
    pc.onicecandidate = e => { if (e.candidate) push(child(this.node, `ice/${this.me}`), JSON.stringify(e.candidate.toJSON())).catch(() => {}) }
    let lost: ReturnType<typeof setTimeout> | undefined
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState
      if (s === 'connected') {
        clearTimeout(lost)
        if (!this.liveAt) { this.liveAt = Date.now(); this.h.onPhase('live') }
      } else if (s === 'failed') this.hangup(this.liveAt ? 'hangup' : 'failed')
      else if (s === 'disconnected') { clearTimeout(lost); lost = setTimeout(() => this.hangup(this.liveAt ? 'hangup' : 'failed'), 8000) }
    }
    // the other side's network candidates (they can arrive before the offer/answer is applied)
    this.stops.push(onChildAdded(child(this.node, `ice/${this.peer}`), s => {
      try {
        const c = JSON.parse(s.val()) as RTCIceCandidateInit
        if (this.remoteSet) pc.addIceCandidate(c).catch(() => {})
        else this.pending.push(c)
      } catch { /* malformed */ }
    }))
  }

  private async applyRemote(desc: RTCSessionDescriptionInit) {
    await this.pc!.setRemoteDescription(desc)
    this.remoteSet = true
    for (const c of this.pending.splice(0)) await this.pc!.addIceCandidate(c).catch(() => {})
  }

  /** Watches the call node: the answer arriving, or the other side ending it. */
  private watch() {
    this.stops.push(onValue(this.node, s => {
      const v = s.val()
      if (this.done) return
      if (!v) { this.finish(this.liveAt ? 'hangup' : this.role === 'caller' ? 'declined' : 'hangup'); return }
      if (v.state === 'end') { this.finish(v.reason === 'declined' ? 'declined' : v.reason === 'missed' ? 'missed' : 'hangup'); return }
      if (this.role === 'caller' && v.answer && !this.remoteSet) {
        this.h.onPhase('connecting')
        this.applyRemote(v.answer).catch(() => this.hangup('failed'))
      }
    }))
  }

  async call() {
    try {
      this.h.onPhase('calling')
      await this.setup()
      const pc = this.pc!
      // a call left over from before (an app that closed mid-call) is cleared first
      await remove(this.node).catch(() => {})
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await set(this.node, { from: this.me, to: this.peer, state: 'ring', at: serverTimestamp(), offer: { type: offer.type, sdp: offer.sdp } })
      await set(ref(R(this.db), `callIn/${this.peer}`), { chatId: this.chatId, from: this.me, at: serverTimestamp() })
      this.watch()
      this.timers.push(setTimeout(() => { if (!this.remoteSet) this.hangup('missed') }, RING_MS))
    } catch (e) {
      this.finish((e as Error).message === 'mic' ? 'mic' : 'failed')
    }
  }

  async answer() {
    try {
      this.h.onPhase('connecting')
      await this.setup()
      let offer: RTCSessionDescriptionInit | null = null
      // only one device (and only while it's still ringing) picks up
      // (null = not known locally yet: written back unchanged, so the server's value comes in)
      const r = await runTransaction(child(this.node, 'state'), st => (st === null ? null : st === 'ring' ? 'live' : undefined))
      if (!r.committed || r.snapshot.val() !== 'live') throw new Error('taken')
      await new Promise<void>(res => onValue(child(this.node, 'offer'), s => { offer = s.val(); res() }, { onlyOnce: true }))
      if (!offer) throw new Error('taken')
      await this.applyRemote(offer)
      const answer = await this.pc!.createAnswer()
      await this.pc!.setLocalDescription(answer)
      await update(this.node, { answer: { type: answer.type, sdp: answer.sdp } })
      remove(ref(R(this.db), `callIn/${this.me}`)).catch(() => {})
      this.watch()
      this.timers.push(setTimeout(() => { if (!this.liveAt) this.hangup('failed') }, 25_000))
    } catch (e) {
      const m = (e as Error).message
      this.finish(m === 'mic' ? 'mic' : m === 'taken' ? 'taken' : 'failed')
    }
  }

  setMuted(m: boolean) {
    this.muted = m
    this.stream?.getAudioTracks().forEach(t => { t.enabled = !m })
  }

  /** Ends the call for both sides. */
  hangup(reason: EndReason = 'hangup') {
    if (this.done) return
    update(this.node, { state: 'end', reason }).catch(() => {})
    if (this.role === 'caller') remove(ref(R(this.db), `callIn/${this.peer}`)).catch(() => {})
    const node = this.node
    setTimeout(() => remove(node).catch(() => {}), 4000)
    this.finish(reason)
  }

  private finish(reason: EndReason) {
    if (this.done) return
    this.done = true
    this.stops.forEach(s => s()); this.stops = []
    this.timers.forEach(clearTimeout)
    this.stream?.getTracks().forEach(t => t.stop())
    try { this.pc?.close() } catch { /* closed */ }
    this.audio.srcObject = null
    this.h.onPhase('ended')
    this.h.onEnd(reason, this.liveAt ? Date.now() - this.liveAt : 0)
  }
}

/** Someone calling me (still ringing), or null. */
export function watchIncoming(db: Firestore, me: string, cb: (c: Incoming | null) => void): Unsubscribe {
  let callStop: Unsubscribe | null = null
  const stop = onValue(ref(R(db), `callIn/${me}`), s => {
    callStop?.(); callStop = null
    const v = s.val() as Incoming | null
    if (!v?.chatId) { cb(null); return }
    // ringing only while the call itself still says so
    callStop = onValue(ref(R(db), `calls/${v.chatId}`), c => {
      const call = c.val()
      cb(call && call.state === 'ring' && call.to === me ? v : null)
    }, () => cb(null))
  }, () => cb(null))
  return () => { stop(); callStop?.() }
}

/** Declines a ringing call. */
export async function declineCall(db: Firestore, me: string, chatId: string) {
  await update(ref(R(db), `calls/${chatId}`), { state: 'end', reason: 'declined' }).catch(() => {})
  await remove(ref(R(db), `callIn/${me}`)).catch(() => {})
}

export const canCall = () => typeof RTCPeerConnection !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

export const talkLabel = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
