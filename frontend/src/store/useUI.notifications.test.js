// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF,useStore } from './useStore.js'
import { useUI } from './useUI.js'
const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve()}
let showNotification
beforeEach(()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));useUI.getState().stopWork();useUI.getState().stopRest(false)
  useStore.setState({S:{...JSON.parse(JSON.stringify(DEF)),sound:false}})
  showNotification=vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('Notification',{permission:'granted',requestPermission:vi.fn()})
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:vi.fn().mockResolvedValue({showNotification})}})
  Object.defineProperty(document,'hidden',{configurable:true,value:true});Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'})
})
afterEach(()=>{useUI.getState().stopWork();useUI.getState().stopRest(false);vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals()})
describe('local exercise timer alerts',()=>{
  it('uses the existing local OS notification path and waits for manual next play',async()=>{
    useUI.getState().startRest(2);await vi.advanceTimersByTimeAsync(2000);await flush()
    expect(showNotification).toHaveBeenCalledOnce();expect(useUI.getState().timer).toBeNull();expect(useUI.getState().manualSet).toBeNull()
  })
  it('respects a disabled rest category without affecting countdown completion',async()=>{
    useStore.getState().S.notifications.rest=false;useUI.getState().startRest(2);await vi.advanceTimersByTimeAsync(2000);await flush()
    expect(showNotification).not.toHaveBeenCalled();expect(useUI.getState().timer).toBeNull()
  })
  it('adjustments and skipping never leave a local timer firing later',async()=>{
    useUI.getState().startRest(2);useUI.getState().addRest(15);await vi.advanceTimersByTimeAsync(2000);expect(showNotification).not.toHaveBeenCalled()
    useUI.getState().stopRest();await vi.advanceTimersByTimeAsync(20000);expect(showNotification).not.toHaveBeenCalled()
  })
})
