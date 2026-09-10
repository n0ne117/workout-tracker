import { useState, useEffect } from 'react'

const MQ = '(max-width: 639px)'
const STANDALONE_MQ = '(display-mode: standalone)'

function isInstalledPWA() {
  return (
    window.matchMedia(STANDALONE_MQ).matches ||
    window.navigator.standalone === true
  )
}

export function useMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && (window.matchMedia(MQ).matches || isInstalledPWA())
  )
  useEffect(() => {
    if (isInstalledPWA()) return   // installed PWA is always mobile — no listener needed

    const mq = window.matchMedia(MQ)
    const fn = e => setMobile(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return mobile
}
