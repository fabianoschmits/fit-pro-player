import { useLayoutEffect } from 'react'

let lock = null
export const pageScrollY = () => lock?.y ?? window.scrollY

// Fixed positioning also prevents background rubber-banding on mobile Safari.
export function usePageScrollLock() {
  useLayoutEffect(() => {
    if (!lock) {
      const body = document.body.style, root = document.documentElement.style
      const saved = Object.fromEntries(['position','top','left','right','width','overflow'].map(key => [key,body[key]]))
      lock = { count:0, y:window.scrollY, saved, overflow:root.overflow }
      Object.assign(body,{position:'fixed',top:`-${lock.y}px`,left:'0',right:'0',width:'100%',overflow:'hidden'})
      root.overflow='hidden'
    }
    lock.count++
    return () => {
      if (--lock.count) return
      const previous=lock, root=document.documentElement.style
      lock=null
      Object.assign(document.body.style,previous.saved)
      root.overflow=previous.overflow
      const behavior=root.scrollBehavior
      root.scrollBehavior='auto'
      window.scrollTo(0,previous.y)
      root.scrollBehavior=behavior
    }
  },[])
}
