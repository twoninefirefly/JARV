import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
// Office before office.css: the components' own CSS is emitted first, so office.css wins ties.
import Office from './Office'
import './office.css'

// The published artifact is a fragment without <html lang>; screen readers should still read German.
document.documentElement.lang = 'de'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Windows, search and the side panel fade instead of sliding or scaling when the system asks for less motion. */}
    <MotionConfig reducedMotion="user">
      <Office />
    </MotionConfig>
  </StrictMode>,
)
