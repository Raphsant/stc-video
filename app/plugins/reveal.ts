/**
 * `v-reveal` — fade-and-rise an element the first time it scrolls into view.
 *
 * Built to fail open. The element ships visible (`.stc-reveal` with no
 * modifier); the directive *adds* the hidden state on mount and removes it on
 * intersection. So if the JS never runs, never hydrates, or the observer is
 * missing, the content is simply there — the animation is the only thing lost.
 *
 * Registered as a universal plugin, not a `.client` one: the directive has to
 * resolve during SSR or Vue warns on every `v-reveal` in the tree. `mounted`
 * never runs on the server, so there is nothing to guard.
 *
 * Usage:
 *   <div v-reveal>…</div>          fires as soon as it enters the viewport
 *   <div v-reveal="120">…</div>    same, delayed 120ms (for staggering a row)
 */

// One observer for the whole page rather than one per element.
let observer: IntersectionObserver | null = null
const delays = new WeakMap<Element, number>()

function show(el: Element) {
  const delay = delays.get(el) ?? 0
  if (delay > 0) setTimeout(() => el.classList.add('shown'), delay)
  else el.classList.add('shown')
}

function getObserver() {
  if (observer) return observer
  observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        show(entry.target)
        observer!.unobserve(entry.target)
      }
    },
    // Trip slightly before the element is fully on screen so the motion reads
    // as the page settling rather than as content popping in late.
    { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
  )
  return observer
}

export default defineNuxtPlugin(nuxtApp => {
  nuxtApp.vueApp.directive<HTMLElement, number | undefined>('reveal', {
    // Custom directives without this warn during SSR. The class is applied in
    // the template, so there is nothing to add server-side.
    getSSRProps: () => ({}),

    mounted(el, binding) {
      el.classList.add('stc-reveal')

      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      if (reduced || !('IntersectionObserver' in window)) return

      delays.set(el, Number(binding.value) || 0)
      el.classList.add('armed')
      getObserver().observe(el)

      // Failsafe: nothing stays hidden past this point, whatever the observer
      // did or didn't do (element inside a scroll container it can't see,
      // display:none at mount time, an observer that never fires).
      setTimeout(() => show(el), 2500)
    },

    unmounted(el) {
      observer?.unobserve(el)
      delays.delete(el)
    },
  })
})
