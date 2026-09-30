// React listens on its root for every event type it knows, `animationiteration` included. Once
// anything in a page listens for that event, Chrome has to wake the main thread each time any
// CSS animation starts a new round, just to deliver it — with hundreds of decorations looping
// on screen that's a full style/layout/paint pass almost every frame, even though all of them
// otherwise run on the GPU. Nothing in the app uses the event, so it's never registered.
// (Imported first in main.tsx, before React sets up its listeners.)
const add = EventTarget.prototype.addEventListener
EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, ...rest: [EventListenerOrEventListenerObject | null, (boolean | AddEventListenerOptions)?]) {
  if (type === 'animationiteration' || type === 'webkitAnimationIteration') return
  return add.call(this, type, ...rest)
} as typeof add
export {}
